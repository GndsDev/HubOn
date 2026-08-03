import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, Observable, of, switchMap, timer } from 'rxjs';
import { CounterActivityService } from '../../core/services/counter-activity.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaymentDialogComponent } from '../../shared/components/payment-dialog/payment-dialog.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { OrderItemRequest, OrderItemStatus, RestaurantOrder } from '../../shared/models/order.model';
import { Product, ProductOptionGroup, ProductVariant } from '../../shared/models/product.model';
import {
  CounterAttendanceState,
  CounterFinancialState,
  CounterHistoryFilters,
  CounterNextAction,
  CounterPreparationState,
  CounterSaleDetail,
  CounterSaleSummary,
} from '../../shared/models/tab.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import {
  isCatalogProductSellable,
  operationalVariantLabel,
  optionSelectionsAreValid,
  sellableVariants,
} from '../../shared/util/catalog-workflow';

interface CounterCartItem extends OrderItemRequest {
  key: number;
  productName: string;
  variantName: string;
  optionNames: string[];
  unitPrice: number;
  preparationFlow: Product['preparationFlow'];
}

type CounterCenterView = 'ACTIVE' | 'TODAY' | 'HISTORY';

@Component({
  selector: 'app-counter-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusBadgeComponent,
    AccessibleDialogDirective,
    PaymentDialogComponent,
  ],
  template: `
    @if (saleId() == null) {
      <app-page-header
        kicker="Operação"
        title="Balcão"
        description="Acompanhe cada venda até o pagamento, a entrega e o fechamento."
      >
        <div page-actions class="page-header-actions">
          <button type="button" class="primary-button" (click)="startSale()" [disabled]="saving()">
            <i class="pi pi-plus"></i>{{ saving() ? 'Abrindo...' : 'Nova venda no balcão' }}
          </button>
        </div>
      </app-page-header>

      @if (loading()) {
        <div class="loading-grid counter-loading-grid" aria-label="Carregando atendimentos">
          <div class="loading-card"></div><div class="loading-card"></div><div class="loading-card"></div>
        </div>
      } @else if (error()) {
        <div class="error-panel" role="alert">
          <i class="pi pi-exclamation-triangle"></i>
          <div><strong>Não foi possível carregar o Balcão</strong><p>{{ error() }}</p></div>
          <button type="button" class="ghost-button" (click)="loadCenter()"><i class="pi pi-refresh"></i>Tentar novamente</button>
        </div>
      } @else {
        <section class="counter-overview" aria-label="Resumo dos atendimentos">
          <article><span>Ativos</span><strong>{{ activeSales().length }}</strong><small>permanecem aqui até o fechamento</small></article>
          <article><span>Em preparo</span><strong>{{ activePreparationCount() }}</strong><small>itens em andamento</small></article>
          <article><span>Prontos</span><strong>{{ readySalesCount() }}</strong><small>aguardando entrega</small></article>
          <article><span>A receber</span><strong>{{ currency(activeReceivable()) }}</strong><small>saldo das vendas abertas</small></article>
        </section>

        <div class="counter-center-toolbar">
          <div class="segmented-control" aria-label="Visualização dos atendimentos">
            <button type="button" [class.active]="centerView() === 'ACTIVE'" (click)="selectCenterView('ACTIVE')">
              Ativos <span>{{ activeSales().length }}</span>
            </button>
            <button type="button" [class.active]="centerView() === 'TODAY'" (click)="selectCenterView('TODAY')">
              Finalizados hoje <span>{{ finishedToday().length }}</span>
            </button>
            <button type="button" [class.active]="centerView() === 'HISTORY'" (click)="selectCenterView('HISTORY')">
              Histórico
            </button>
          </div>
          <button type="button" class="icon-button" aria-label="Atualizar atendimentos" title="Atualizar" (click)="loadCenter()">
            <i class="pi pi-refresh"></i>
          </button>
        </div>

        @if (centerView() === 'HISTORY') {
          <section class="counter-history-filters" aria-label="Filtros do histórico">
            <label class="field"><span>De</span><input type="date" [(ngModel)]="historyFilters.from" /></label>
            <label class="field"><span>Até</span><input type="date" [(ngModel)]="historyFilters.to" /></label>
            <label class="field"><span>Número</span><input type="number" min="1" [(ngModel)]="historyFilters.number" /></label>
            <label class="field"><span>Cliente</span><input [(ngModel)]="historyFilters.customer" /></label>
            <label class="field"><span>Situação</span><select [(ngModel)]="historyFilters.status"><option value="">Todas</option><option value="CLOSED">Finalizada</option><option value="CANCELLED">Cancelada</option></select></label>
            <label class="field"><span>Operador</span><input [(ngModel)]="historyFilters.operator" /></label>
            <button type="button" class="primary-button" (click)="loadHistory()" [disabled]="historyLoading()"><i class="pi pi-search"></i>Buscar</button>
          </section>
        }

        @if (visibleSales().length === 0) {
          <app-empty-state
            icon="pi pi-shopping-bag"
            [title]="emptyCenterTitle()"
            [description]="emptyCenterDescription()"
          />
        } @else {
          <section class="counter-sale-grid" aria-label="Lista de atendimentos">
            @for (sale of visibleSales(); track sale.id) {
              <article class="counter-sale-card" [class.counter-sale-ready]="isReadyForHandoff(sale)">
                <header>
                  <div>
                    <span>Venda #{{ sale.number }}</span>
                    <h2>{{ sale.customerName || 'Cliente não identificado' }}</h2>
                    <small>{{ dateTime(sale.openedAt) }} · {{ sale.openedByUserName }}</small>
                  </div>
                  <app-status-badge [label]="attendanceLabel(sale.attendanceState)" [tone]="attendanceTone(sale.attendanceState)" />
                </header>

                <div class="counter-state-row">
                  <span><small>Preparo</small><strong>{{ preparationLabel(sale.preparationState) }}</strong></span>
                  <span><small>Pagamento</small><strong>{{ financialLabel(sale.financialState) }}</strong></span>
                </div>

                @if (sale.itemCount > 0) {
                  <div class="counter-item-breakdown">
                    <span><b>{{ sale.itemCount }}</b> {{ sale.itemCount === 1 ? 'item' : 'itens' }}</span>
                    @if (sale.readyItemCount > 0) { <span><i class="pi pi-bell"></i>{{ sale.readyItemCount }} pronto{{ sale.readyItemCount === 1 ? '' : 's' }}</span> }
                    @if (sale.waitingItemCount + sale.inPreparationItemCount > 0) { <span><i class="pi pi-clock"></i>{{ sale.waitingItemCount + sale.inPreparationItemCount }} em preparo</span> }
                  </div>
                }

                <div class="counter-sale-values">
                  <span><small>Total</small><strong>{{ currency(sale.totalAmount) }}</strong></span>
                  <span><small>Pago</small><strong>{{ currency(sale.paidAmount) }}</strong></span>
                  <span><small>Restante</small><strong>{{ currency(sale.remainingAmount) }}</strong></span>
                </div>

                <footer>
                  <div><small>Próxima ação</small><strong>{{ nextActionLabel(sale.nextAction) }}</strong></div>
                  <a class="primary-button" [routerLink]="['/balcao', sale.id]">
                    <i class="pi pi-arrow-right"></i>{{ sale.tabStatus === 'OPEN' ? 'Continuar atendimento' : 'Ver atendimento' }}
                  </a>
                </footer>
              </article>
            }
          </section>
        }
      }
    } @else {
      <app-page-header
        kicker="Atendimento de balcão"
        [title]="summary()?.displayLabel || 'Carregando atendimento'"
        [description]="detailDescription()"
      >
        <div page-actions class="page-header-actions">
          <a class="secondary-button" routerLink="/balcao"><i class="pi pi-arrow-left"></i>Atendimentos</a>
          <button type="button" class="icon-button" aria-label="Atualizar atendimento" title="Atualizar" (click)="refreshDetail()" [disabled]="saving()">
            <i class="pi pi-refresh"></i>
          </button>
        </div>
      </app-page-header>

      @if (loading()) {
        <div class="loading-grid"><div class="loading-card"></div><div class="loading-card"></div></div>
      } @else if (error()) {
        <div class="error-panel" role="alert">
          <i class="pi pi-exclamation-triangle"></i>
          <div><strong>Não foi possível abrir o atendimento</strong><p>{{ error() }}</p></div>
          <button type="button" class="ghost-button" (click)="loadDetail()"><i class="pi pi-refresh"></i>Tentar novamente</button>
        </div>
      } @else if (detail(); as current) {
        <section class="counter-detail-status" aria-label="Situação do atendimento">
          <div><small>Atendimento</small><app-status-badge [label]="attendanceLabel(current.summary.attendanceState)" [tone]="attendanceTone(current.summary.attendanceState)" /></div>
          <div><small>Preparo</small><app-status-badge [label]="preparationLabel(current.summary.preparationState)" [tone]="preparationTone(current.summary.preparationState)" /></div>
          <div><small>Financeiro</small><app-status-badge [label]="financialLabel(current.summary.financialState)" [tone]="financialTone(current.summary.financialState)" /></div>
          <div class="counter-next-action"><small>Próxima ação</small><strong>{{ nextActionLabel(current.summary.nextAction) }}</strong></div>
        </section>

        @if (isAssembly()) {
          <div class="counter-workspace">
            <section class="counter-catalog" aria-label="Cardápio do balcão">
              <div class="counter-catalog-toolbar">
                <label class="search-box">
                  <i class="pi pi-search"></i>
                  <input type="search" placeholder="Buscar produto" aria-label="Buscar produto" [(ngModel)]="searchTerm" />
                </label>
                <div class="segmented-control counter-category-filter" aria-label="Filtrar por categoria">
                  <button type="button" [class.active]="categoryFilter === 'ALL'" (click)="categoryFilter = 'ALL'">Todos</button>
                  @for (category of categories(); track category) {
                    <button type="button" [class.active]="categoryFilter === category" (click)="categoryFilter = category">{{ category }}</button>
                  }
                </div>
              </div>

              @if (filteredProducts.length === 0) {
                <app-empty-state icon="pi pi-shopping-bag" title="Nenhum produto disponível" description="Ajuste a busca ou a disponibilidade do cardápio." />
              } @else {
                <div class="counter-product-grid">
                  @for (product of filteredProducts; track product.id) {
                    <button type="button" class="counter-product" (click)="openProduct(product)" [disabled]="saving()">
                      <span>{{ product.categoryName }}</span>
                      <strong>{{ product.name }}</strong>
                      <small>{{ product.preparationFlow === 'DIRECT_SERVICE' ? 'Entrega direta' : 'Requer preparo' }}</small>
                      <b>{{ productPrice(product) }}</b>
                    </button>
                  }
                </div>
              }
            </section>

            <aside class="counter-sale-panel" aria-label="Resumo do pedido">
              <header class="counter-sale-header">
                <div><span>Pedido em montagem</span><h2>{{ current.summary.displayLabel }}</h2></div>
                <span class="counter-sync-state"><i class="pi" [class.pi-spin]="saving()" [class.pi-spinner]="saving()" [class.pi-cloud]="!saving()"></i>{{ saving() ? 'Salvando...' : 'Salvo no sistema' }}</span>
              </header>

              <details class="counter-customer-details">
                <summary>Identificação opcional do cliente</summary>
                <div class="form-grid">
                  <label class="field"><span>Nome</span><input [(ngModel)]="customer.name" maxlength="120" /></label>
                  <label class="field"><span>Telefone</span><input [(ngModel)]="customer.phone" maxlength="30" inputmode="tel" /></label>
                  <label class="field full"><span>Referência</span><input [(ngModel)]="customer.identification" maxlength="160" /></label>
                </div>
                <button type="button" class="ghost-button" (click)="saveCustomer()" [disabled]="saving()"><i class="pi pi-save"></i>Salvar identificação</button>
              </details>

              <div class="counter-cart-list">
                @for (item of cart(); track item.key) {
                  <article class="counter-cart-item">
                    <div>
                      <strong>{{ item.productName }}</strong>
                      <span>{{ item.variantName }}</span>
                      @if (item.optionNames.length) { <small>{{ item.optionNames.join(', ') }}</small> }
                      @if (item.notes) { <small>Observação: {{ item.notes }}</small> }
                    </div>
                    <div class="counter-cart-side">
                      <b>{{ currency(item.unitPrice * item.quantity) }}</b>
                      <div class="counter-quantity-stepper">
                        <button type="button" class="icon-button" aria-label="Editar item" title="Editar" (click)="editCartItem(item)" [disabled]="saving()"><i class="pi pi-pencil"></i></button>
                        <button type="button" class="icon-button" aria-label="Diminuir quantidade" title="Diminuir" (click)="changeQuantity(item.key, -1)" [disabled]="saving()"><i class="pi pi-minus"></i></button>
                        <span>{{ item.quantity }}</span>
                        <button type="button" class="icon-button" aria-label="Aumentar quantidade" title="Aumentar" (click)="changeQuantity(item.key, 1)" [disabled]="saving()"><i class="pi pi-plus"></i></button>
                        <button type="button" class="icon-button danger" aria-label="Remover item" title="Remover" (click)="removeItem(item.key)" [disabled]="saving()"><i class="pi pi-trash"></i></button>
                      </div>
                    </div>
                  </article>
                } @empty {
                  <app-empty-state icon="pi pi-shopping-cart" title="Pedido vazio" description="Adicione o primeiro produto. O atendimento já está salvo e pode ser retomado depois." />
                }
              </div>

              <div class="counter-total"><span>Total estimado</span><strong>{{ currency(cartTotal()) }}</strong></div>
              <button type="button" class="primary-button counter-primary-action" (click)="confirmOrder()" [disabled]="saving() || cart().length === 0">
                <i class="pi pi-check"></i>{{ saving() ? 'Salvando...' : 'Confirmar pedido' }}
              </button>
              <button type="button" class="danger-button counter-secondary-action" (click)="cancelOpen.set(true)" [disabled]="saving()">
                <i class="pi pi-trash"></i>Descartar atendimento
              </button>
            </aside>
          </div>
        } @else {
          <div class="counter-operation-layout">
            <section class="counter-order-detail" aria-label="Itens do atendimento">
              <header><div><span>Pedido confirmado</span><h2>Itens e andamento</h2></div><strong>{{ current.summary.itemCount }} {{ current.summary.itemCount === 1 ? 'item' : 'itens' }}</strong></header>
              <div class="counter-confirmed-items">
                @for (order of activeOrders(); track order.id) {
                  @for (item of order.items; track item.id) {
                    @if (item.status !== 'CANCELED') {
                      <article>
                        <div>
                          <strong>{{ item.displayNameSnapshot }}</strong>
                          <small>{{ item.quantity }} un. · {{ item.preparationFlow === 'DIRECT_SERVICE' ? 'Entrega direta' : 'Preparo' }}</small>
                          @if (item.options.length) { <small>{{ optionSummary(item.options) }}</small> }
                          @if (item.notes) { <small>Observação: {{ item.notes }}</small> }
                        </div>
                        <div class="counter-confirmed-side">
                          <app-status-badge [label]="itemStatusLabel(item.status, current.summary)" [tone]="itemStatusTone(item.status)" />
                          <strong>{{ currency(item.subtotal) }}</strong>
                          @if (item.status === 'IN_PREPARATION') {
                            <button type="button" class="primary-button compact-button" (click)="markReady(order.id, item.id)" [disabled]="saving()"><i class="pi pi-check"></i>Marcar como pronto</button>
                          } @else if (item.status === 'READY' && current.summary.remainingAmount === 0) {
                            <button type="button" class="primary-button compact-button" (click)="deliverItem(order.id, item.id)" [disabled]="saving()"><i class="pi pi-check-circle"></i>Marcar como entregue</button>
                          }
                        </div>
                      </article>
                    }
                  }
                }
              </div>

              @if (current.summary.readyItemCount > 0 || current.summary.waitingItemCount + current.summary.inPreparationItemCount > 0) {
                <div class="counter-item-breakdown large">
                  @if (current.summary.readyItemCount > 0) { <span><i class="pi pi-bell"></i><b>{{ current.summary.readyItemCount }}</b> pronto{{ current.summary.readyItemCount === 1 ? '' : 's' }}</span> }
                  @if (current.summary.waitingItemCount > 0) { <span><i class="pi pi-clock"></i><b>{{ current.summary.waitingItemCount }}</b> aguardando preparo</span> }
                  @if (current.summary.inPreparationItemCount > 0) { <span><i class="pi pi-spin pi-spinner"></i><b>{{ current.summary.inPreparationItemCount }}</b> em preparo</span> }
                  @if (current.summary.deliveredItemCount > 0) { <span><i class="pi pi-check-circle"></i><b>{{ current.summary.deliveredItemCount }}</b> entregue{{ current.summary.deliveredItemCount === 1 ? '' : 's' }}</span> }
                </div>
              }
            </section>

            <aside class="counter-action-panel" aria-label="Próxima ação do atendimento">
              <div class="counter-financial-summary">
                <span><small>Total</small><strong>{{ currency(current.summary.totalAmount) }}</strong></span>
                <span><small>Pago</small><strong>{{ currency(current.summary.paidAmount) }}</strong></span>
                <span class="remaining"><small>Restante</small><strong>{{ currency(current.summary.remainingAmount) }}</strong></span>
              </div>

              @if (current.summary.tabStatus !== 'OPEN') {
                <div class="info-panel compact-info"><i class="pi pi-check-circle"></i><div><strong>{{ current.summary.tabStatus === 'CLOSED' ? 'Atendimento finalizado' : 'Atendimento cancelado' }}</strong><p>Esta venda permanece disponível para consulta no histórico.</p></div></div>
              } @else if (current.summary.nextAction === 'REGISTER_PAYMENT' || current.summary.nextAction === 'COMPLETE_PAYMENT') {
                <div class="counter-action-copy"><span>Próxima ação</span><h2>{{ current.summary.nextAction === 'COMPLETE_PAYMENT' ? 'Completar pagamento' : 'Registrar pagamento' }}</h2><p>O preparo dos itens começa automaticamente quando o saldo chegar a zero.</p></div>
                <button type="button" class="primary-button counter-primary-action" (click)="paymentOpen.set(true)"><i class="pi pi-wallet"></i>{{ current.summary.nextAction === 'COMPLETE_PAYMENT' ? 'Completar pagamento' : 'Registrar pagamento' }}</button>
              } @else if (current.summary.nextAction === 'FOLLOW_PREPARATION') {
                <div class="counter-action-copy"><span>Próxima ação</span><h2>Acompanhar preparo</h2><p>Marque cada item como pronto assim que o preparo terminar.</p></div>
                <button type="button" class="ghost-button counter-secondary-action" (click)="refreshDetail()" [disabled]="saving()"><i class="pi pi-refresh"></i>Atualizar andamento</button>
              } @else if (current.summary.nextAction === 'DELIVER') {
                <div class="counter-action-copy"><span>Próxima ação</span><h2>Entregar itens prontos</h2><p>Use a ação de cada item para registrar a entrega ao cliente.</p></div>
              } @else if (current.summary.nextAction === 'FINALIZE') {
                <div class="counter-action-copy"><span>Próxima ação</span><h2>Finalizar venda</h2><p>O pedido foi entregue e não há saldo pendente.</p></div>
                <button type="button" class="primary-button counter-primary-action" (click)="finalizeSale()" [disabled]="saving()"><i class="pi pi-lock"></i>Finalizar venda</button>
              } @else {
                <div class="info-panel compact-info"><i class="pi pi-info-circle"></i><div><strong>Atendimento atualizado</strong><p>Não há uma ação operacional disponível neste estado.</p></div></div>
              }

              @if (current.summary.cancellationAllowed && current.summary.tabStatus === 'OPEN') {
                <button type="button" class="danger-button counter-secondary-action" (click)="cancelOpen.set(true)" [disabled]="saving()"><i class="pi pi-times"></i>Cancelar venda</button>
              }
            </aside>
          </div>
        }
      }
    }

    @if (selectedProduct(); as product) {
      <div class="modal-backdrop" (click)="closeProduct()">
        <form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="counter-product-title" (dialogClose)="closeProduct()" (click)="$event.stopPropagation()" (ngSubmit)="saveCartItem()">
          <div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">{{ product.categoryName }}</span><h2 id="counter-product-title">{{ product.name }}</h2></div><button type="button" class="icon-button" aria-label="Fechar" (click)="closeProduct()"><i class="pi pi-times"></i></button></div>
          <div class="modal-body"><label class="field"><span>Variação</span><select name="variant" [(ngModel)]="productForm.variantId" autofocus required>@for (variant of availableVariants(product); track variant.id) { <option [ngValue]="variant.id">{{ variantLabel(variant) }} · {{ currency(variant.price) }}</option> }</select></label>@for (group of activeGroups(product); track group.id) { <fieldset class="counter-option-group"><legend>{{ group.name }} <small>{{ group.required ? 'Obrigatório' : 'Opcional' }} · até {{ group.maximumSelections }}</small></legend>@for (option of activeOptions(group); track option.id) { <label><input type="checkbox" [checked]="productForm.optionIds.includes(option.id)" (change)="toggleOption(group, option.id)" /> <span>{{ option.name }}</span><b>{{ option.additionalPrice ? '+' + currency(option.additionalPrice) : 'Incluso' }}</b></label> }</fieldset> }<div class="form-grid"><label class="field"><span>Quantidade</span><input name="quantity" type="number" min="1" step="1" [(ngModel)]="productForm.quantity" required /></label><label class="field"><span>Observação</span><input name="notes" [(ngModel)]="productForm.notes" maxlength="500" /></label></div></div>
          <div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="closeProduct()">Voltar</button><button type="submit" class="primary-button" [disabled]="!productFormValid(product) || saving()"><i [class]="editingCartKey() == null ? 'pi pi-plus' : 'pi pi-check'"></i>{{ editingCartKey() == null ? 'Adicionar' : 'Salvar item' }} · {{ currency(configuredUnitPrice(product) * productForm.quantity) }}</button></div>
        </form>
      </div>
    }

    @if (cancelOpen()) {
      <div class="modal-backdrop" (click)="cancelOpen.set(false)">
        <form class="modal-panel compact" appAccessibleDialog role="alertdialog" aria-modal="true" aria-labelledby="counter-cancel-title" (dialogClose)="cancelOpen.set(false)" (click)="$event.stopPropagation()" (ngSubmit)="cancelSale()">
          <div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Confirmação</span><h2 id="counter-cancel-title">{{ isAssembly() ? 'Descartar este atendimento?' : 'Cancelar esta venda?' }}</h2></div><button type="button" class="icon-button" aria-label="Fechar" (click)="cancelOpen.set(false)"><i class="pi pi-times"></i></button></div>
          <div class="modal-body"><p class="modal-description">O atendimento sairá da lista de ativos, mas continuará disponível no histórico.</p><label class="field"><span>Motivo</span><textarea name="cancelReason" [(ngModel)]="cancelReason" maxlength="500" required autofocus></textarea></label></div>
          <div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="cancelOpen.set(false)">Voltar</button><button type="submit" class="danger-button" [disabled]="saving() || !cancelReason.trim()"><i class="pi pi-times"></i>Confirmar cancelamento</button></div>
        </form>
      </div>
    }

    @if (paymentOpen() && detail(); as current) {
      <app-payment-dialog
        [tabId]="current.summary.id"
        [originLabel]="current.summary.displayLabel"
        [totalAmount]="current.summary.totalAmount"
        [paidAmount]="current.summary.paidAmount"
        [remainingAmount]="current.summary.remainingAmount"
        (dismissed)="paymentOpen.set(false)"
        (completed)="onPaymentCompleted()"
      />
    }
  `,
})
export class CounterPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly productApi = inject(ProductApiService);
  private readonly tabApi = inject(TabApiService);
  private readonly orderApi = inject(OrderApiService);
  private readonly activity = inject(CounterActivityService);
  private readonly feedback = inject(FeedbackService);
  private nextCartKey = 1;

  readonly saleId = signal<number | null>(null);
  readonly products = signal<Product[]>([]);
  readonly categories = computed(() => [...new Set(this.products().map((product) => product.categoryName))].sort());
  readonly cart = signal<CounterCartItem[]>([]);
  readonly cartTotal = computed(() => this.cart().reduce((total, item) => total + item.unitPrice * item.quantity, 0));
  readonly detail = signal<CounterSaleDetail | null>(null);
  readonly summary = computed(() => this.detail()?.summary ?? null);
  readonly activeSales = signal<CounterSaleSummary[]>([]);
  readonly finishedToday = signal<CounterSaleSummary[]>([]);
  readonly history = signal<CounterSaleSummary[]>([]);
  readonly centerView = signal<CounterCenterView>('ACTIVE');
  readonly visibleSales = computed(() => this.centerView() === 'ACTIVE'
    ? this.activeSales()
    : this.centerView() === 'TODAY'
      ? this.finishedToday()
      : this.history());
  readonly activePreparationCount = computed(() => this.activeSales().filter((sale) =>
    ['WAITING_PAYMENT', 'WAITING', 'IN_PREPARATION', 'PARTIALLY_READY'].includes(sale.preparationState),
  ).length);
  readonly readySalesCount = computed(() => this.activeSales().filter((sale) => this.isReadyForHandoff(sale)).length);
  readonly activeReceivable = computed(() => this.activeSales().reduce((total, sale) => total + sale.remainingAmount, 0));
  readonly selectedProduct = signal<Product | null>(null);
  readonly editingCartKey = signal<number | null>(null);
  readonly loading = signal(true);
  readonly historyLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly cancelOpen = signal(false);
  readonly paymentOpen = signal(false);

  searchTerm = '';
  categoryFilter = 'ALL';
  customer = { name: '', phone: '', identification: '' };
  productForm = { variantId: 0, optionIds: [] as number[], quantity: 1, notes: '' };
  cancelReason = '';
  historyFilters: CounterHistoryFilters = { from: '', to: '', number: null, customer: '', status: '', operator: '' };

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const rawId = params.get('counterTabId');
      const parsedId = rawId == null ? null : Number(rawId);
      this.saleId.set(Number.isInteger(parsedId) && Number(parsedId) > 0 ? parsedId : null);
      this.error.set(rawId != null && this.saleId() == null ? 'O número do atendimento é inválido.' : null);
      if (rawId != null && this.saleId() == null) {
        this.loading.set(false);
        return;
      }
      this.saleId() == null ? this.loadCenter() : this.loadDetail();
    });

    timer(15_000, 15_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.saleId() != null && !this.saving() && this.summary()?.tabStatus === 'OPEN') {
        this.refreshDetail(false);
      }
    });
  }

  loadCenter(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      active: this.tabApi.getActiveCounterSales(),
      today: this.tabApi.getCounterSalesFinishedToday(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ active, today }) => {
        this.activeSales.set(active);
        this.finishedToday.set(today);
        this.activity.refresh();
      },
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  loadDetail(): void {
    const id = this.saleId();
    if (id == null) return;
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      products: this.productApi.getAll(),
      detail: this.tabApi.getCounterSale(id),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ products, detail }) => {
        this.products.set(products.filter(isCatalogProductSellable));
        this.applyDetail(detail);
      },
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  refreshDetail(showFeedback = true): void {
    const id = this.saleId();
    if (id == null || this.saving()) return;
    this.saving.set(true);
    this.tabApi.getCounterSale(id).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (detail) => {
        this.applyDetail(detail);
        this.activity.refresh();
        if (showFeedback) this.feedback.success('Atendimento atualizado.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  startSale(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.tabApi.openCounter({ customerName: null, customerPhone: null, identificationNote: null, serviceFee: 0, discountAmount: 0 })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (tab) => {
          this.activity.refresh();
          this.router.navigate(['/balcao', tab.id]);
        },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  selectCenterView(view: CounterCenterView): void {
    this.centerView.set(view);
    if (view === 'HISTORY' && this.history().length === 0) this.loadHistory();
  }

  loadHistory(): void {
    this.historyLoading.set(true);
    this.tabApi.getCounterHistory(this.historyFilters).pipe(finalize(() => this.historyLoading.set(false))).subscribe({
      next: (history) => this.history.set(history),
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  get filteredProducts(): Product[] {
    const term = this.searchTerm.trim().toLocaleLowerCase('pt-BR');
    return this.products().filter((product) =>
      (this.categoryFilter === 'ALL' || product.categoryName === this.categoryFilter)
      && (!term || `${product.name} ${product.categoryName}`.toLocaleLowerCase('pt-BR').includes(term)),
    );
  }

  openProduct(product: Product): void {
    const variants = sellableVariants(product);
    this.editingCartKey.set(null);
    this.productForm = { variantId: variants[0]?.id ?? 0, optionIds: [], quantity: 1, notes: '' };
    this.selectedProduct.set(product);
  }

  editCartItem(item: CounterCartItem): void {
    const product = this.products().find((candidate) => candidate.id === item.productId);
    if (!product) {
      this.feedback.error('O produto deste item não está mais disponível para edição.');
      return;
    }
    this.editingCartKey.set(item.key);
    this.productForm = {
      variantId: item.variantId,
      optionIds: [...item.optionIds],
      quantity: item.quantity,
      notes: item.notes ?? '',
    };
    this.selectedProduct.set(product);
  }

  closeProduct(): void {
    this.selectedProduct.set(null);
    this.editingCartKey.set(null);
  }

  toggleOption(group: ProductOptionGroup, optionId: number): void {
    const selected = this.productForm.optionIds;
    if (selected.includes(optionId)) {
      this.productForm.optionIds = selected.filter((id) => id !== optionId);
      return;
    }
    const groupIds = new Set(this.activeOptions(group).map((option) => option.id));
    if (selected.filter((id) => groupIds.has(id)).length >= group.maximumSelections) {
      this.feedback.info(`Selecione no máximo ${group.maximumSelections} opção(ões) em ${group.name}.`);
      return;
    }
    this.productForm.optionIds = [...selected, optionId];
  }

  saveCartItem(): void {
    const product = this.selectedProduct();
    if (!product || !this.productFormValid(product) || this.saving()) return;
    const variant = this.availableVariants(product).find((item) => item.id === this.productForm.variantId)!;
    const selectedOptions = product.optionGroups.flatMap((group) => group.options)
      .filter((option) => this.productForm.optionIds.includes(option.id));
    const editingKey = this.editingCartKey();
    const item: CounterCartItem = {
      key: editingKey ?? this.nextCartKey++,
      productId: product.id,
      variantId: variant.id,
      quantity: Number(this.productForm.quantity),
      notes: this.optional(this.productForm.notes),
      optionIds: [...this.productForm.optionIds],
      productName: product.name,
      variantName: operationalVariantLabel(variant.name),
      optionNames: selectedOptions.map((option) => option.name),
      unitPrice: variant.price + selectedOptions.reduce((total, option) => total + option.additionalPrice, 0),
      preparationFlow: product.preparationFlow,
    };
    const updated = editingKey == null
      ? [...this.cart(), item]
      : this.cart().map((candidate) => candidate.key === editingKey ? item : candidate);
    this.closeProduct();
    this.persistCart(updated, editingKey == null ? 'Item adicionado e salvo.' : 'Item atualizado e salvo.');
  }

  removeItem(key: number): void {
    this.persistCart(this.cart().filter((item) => item.key !== key), 'Item removido.');
  }

  changeQuantity(key: number, change: number): void {
    const updated = this.cart()
      .map((item) => item.key === key ? { ...item, quantity: Math.max(0, item.quantity + change) } : item)
      .filter((item) => item.quantity > 0);
    this.persistCart(updated);
  }

  saveCustomer(): void {
    const id = this.saleId();
    if (id == null || this.saving()) return;
    this.saving.set(true);
    this.tabApi.updateCounterSale(id, {
      customerName: this.optional(this.customer.name),
      customerPhone: this.optional(this.customer.phone),
      identificationNote: this.optional(this.customer.identification),
    }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (detail) => {
        this.applyDetail(detail);
        this.activity.refresh();
        this.feedback.success('Identificação salva.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  confirmOrder(): void {
    const order = this.draftOrder();
    if (!order || this.cart().length === 0 || this.saving()) return;
    this.saving.set(true);
    this.orderApi.confirm(order.id).pipe(
      switchMap(() => this.tabApi.getCounterSale(this.saleId()!)),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: (detail) => {
        this.applyDetail(detail);
        this.activity.refresh();
        this.feedback.success('Pedido confirmado e encaminhado corretamente.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  onPaymentCompleted(): void {
    this.paymentOpen.set(false);
    this.refreshDetail(false);
    this.activity.refresh();
  }

  markReady(orderId: number, itemId: number): void {
    this.updateOperationalItem(orderId, itemId, 'READY', 'Item marcado como pronto.');
  }

  deliverItem(orderId: number, itemId: number): void {
    this.updateOperationalItem(orderId, itemId, 'DELIVERED', 'Item marcado como entregue.');
  }

  finalizeSale(): void {
    const id = this.saleId();
    if (id == null || this.saving()) return;
    this.saving.set(true);
    this.tabApi.finishCounterSale(id).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.activity.refresh();
        this.feedback.success('Venda finalizada e movida para o histórico.');
        this.router.navigateByUrl('/balcao');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  cancelSale(): void {
    const detail = this.detail();
    if (!detail || !this.cancelReason.trim() || this.saving()) return;
    const order = detail.orders.find((candidate) => candidate.status !== 'CANCELLED');
    this.saving.set(true);
    const cancelOrder: Observable<unknown> = order
      ? this.orderApi.cancel(order.id, this.cancelReason.trim())
      : of(null);
    cancelOrder.pipe(
      switchMap(() => this.tabApi.cancel(detail.summary.id)),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: () => {
        this.cancelOpen.set(false);
        this.activity.refresh();
        this.feedback.success('Atendimento cancelado e mantido no histórico.');
        this.router.navigateByUrl('/balcao');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  draftOrder(): RestaurantOrder | null {
    return this.detail()?.orders.find((order) => order.status === 'CREATED') ?? null;
  }

  activeOrders(): RestaurantOrder[] {
    return this.detail()?.orders.filter((order) => order.status !== 'CANCELLED') ?? [];
  }

  isAssembly(): boolean {
    return this.summary()?.attendanceState === 'ASSEMBLING';
  }

  availableVariants(product: Product): ProductVariant[] { return sellableVariants(product); }
  activeGroups(product: Product): ProductOptionGroup[] { return product.optionGroups.filter((group) => group.active); }
  activeOptions(group: ProductOptionGroup) { return group.options.filter((option) => option.active); }
  variantLabel(variant: ProductVariant): string { return operationalVariantLabel(variant.name); }

  productFormValid(product: Product): boolean {
    return this.productForm.quantity >= 1
      && this.availableVariants(product).some((variant) => variant.id === this.productForm.variantId)
      && optionSelectionsAreValid(this.activeGroups(product), this.productForm.optionIds);
  }

  configuredUnitPrice(product: Product): number {
    const variant = this.availableVariants(product).find((item) => item.id === this.productForm.variantId);
    const optionPrice = product.optionGroups.flatMap((group) => group.options)
      .filter((option) => this.productForm.optionIds.includes(option.id))
      .reduce((total, option) => total + option.additionalPrice, 0);
    return (variant?.price ?? 0) + optionPrice;
  }

  productPrice(product: Product): string {
    if (product.minimumVariantPrice == null) return 'Sem preço';
    return product.minimumVariantPrice === product.maximumVariantPrice
      ? this.currency(product.minimumVariantPrice)
      : `A partir de ${this.currency(product.minimumVariantPrice)}`;
  }

  attendanceLabel(state: CounterAttendanceState): string {
    return ({ ASSEMBLING: 'Em montagem', CONFIRMED: 'Confirmado', IN_PROGRESS: 'Em andamento', READY_TO_FINISH: 'Pronto para finalizar', FINISHED: 'Finalizado', CANCELLED: 'Cancelado' })[state];
  }

  preparationLabel(state: CounterPreparationState): string {
    return ({ NOT_APPLICABLE: 'Sem preparo', WAITING_PAYMENT: 'Aguardando pagamento', WAITING: 'Aguardando preparo', IN_PREPARATION: 'Em preparo', PARTIALLY_READY: 'Parcialmente pronto', READY: 'Pronto', DELIVERED: 'Entregue' })[state];
  }

  financialLabel(state: CounterFinancialState): string {
    return ({ UNPAID: 'Não pago', PARTIALLY_PAID: 'Parcialmente pago', PAID: 'Pago', CANCELLED: 'Cancelado' })[state];
  }

  nextActionLabel(action: CounterNextAction): string {
    return ({ ADD_ITEMS: 'Adicionar itens', CONFIRM_ORDER: 'Confirmar pedido', FOLLOW_PREPARATION: 'Acompanhar preparo', REGISTER_PAYMENT: 'Registrar pagamento', COMPLETE_PAYMENT: 'Completar pagamento', DELIVER: 'Marcar como entregue', FINALIZE: 'Finalizar venda', VIEW: 'Consultar atendimento', NONE: 'Nenhuma ação' })[action];
  }

  attendanceTone(state: CounterAttendanceState): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
    return ({ ASSEMBLING: 'neutral', CONFIRMED: 'info', IN_PROGRESS: 'warning', READY_TO_FINISH: 'success', FINISHED: 'success', CANCELLED: 'danger' })[state] as 'neutral' | 'info' | 'warning' | 'success' | 'danger';
  }

  preparationTone(state: CounterPreparationState): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
    return ({ NOT_APPLICABLE: 'neutral', WAITING_PAYMENT: 'warning', WAITING: 'warning', IN_PREPARATION: 'info', PARTIALLY_READY: 'warning', READY: 'success', DELIVERED: 'success' })[state] as 'neutral' | 'info' | 'warning' | 'success' | 'danger';
  }

  financialTone(state: CounterFinancialState): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
    return ({ UNPAID: 'warning', PARTIALLY_PAID: 'info', PAID: 'success', CANCELLED: 'danger' })[state] as 'neutral' | 'info' | 'warning' | 'success' | 'danger';
  }

  isReadyForHandoff(sale: CounterSaleSummary): boolean {
    return sale.draftItemCount === 0
      && sale.waitingItemCount === 0
      && sale.inPreparationItemCount === 0
      && sale.readyItemCount > 0
      && sale.readyItemCount + sale.deliveredItemCount === sale.itemCount
      && sale.deliveredItemCount < sale.itemCount;
  }

  itemStatusLabel(status: OrderItemStatus, summary?: CounterSaleSummary): string {
    if (status === 'WAITING_PREPARATION' && (summary?.remainingAmount ?? 0) > 0) return 'Aguardando pagamento';
    return ({ DRAFT: 'Rascunho', WAITING_PREPARATION: 'Aguardando preparo', IN_PREPARATION: 'Em preparo', READY: 'Pronto', DELIVERED: 'Entregue', CANCELED: 'Cancelado' })[status];
  }

  itemStatusTone(status: OrderItemStatus): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
    return ({ DRAFT: 'neutral', WAITING_PREPARATION: 'warning', IN_PREPARATION: 'info', READY: 'success', DELIVERED: 'success', CANCELED: 'danger' })[status] as 'neutral' | 'info' | 'warning' | 'success' | 'danger';
  }

  optionSummary(options: RestaurantOrder['items'][number]['options']): string {
    return options.map((option) => option.optionName).join(', ');
  }

  detailDescription(): string {
    const summary = this.summary();
    if (!summary) return 'Carregando os dados salvos no sistema.';
    if (summary.tabStatus === 'CLOSED') return 'Venda finalizada. Consulte os itens, valores e andamento registrado.';
    if (summary.tabStatus === 'CANCELLED') return 'Atendimento cancelado e preservado para consulta.';
    return `Aberto em ${this.dateTime(summary.openedAt)} por ${summary.openedByUserName}.`;
  }

  emptyCenterTitle(): string {
    if (this.centerView() === 'ACTIVE') return 'Nenhuma venda de balcão ativa';
    if (this.centerView() === 'TODAY') return 'Nenhuma venda finalizada hoje';
    return 'Nenhum atendimento encontrado';
  }

  emptyCenterDescription(): string {
    if (this.centerView() === 'ACTIVE') return 'Inicie uma nova venda para começar o atendimento.';
    if (this.centerView() === 'TODAY') return 'As vendas concluídas aparecerão aqui durante o dia.';
    return 'Ajuste os filtros para consultar outros atendimentos.';
  }

  dateTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
  }

  private persistCart(items: CounterCartItem[], successMessage?: string): void {
    const detail = this.detail();
    if (!detail || this.saving()) return;
    const draft = this.draftOrder();
    if (!draft && items.length === 0) {
      this.cart.set([]);
      return;
    }
    const payload = {
      tabId: detail.summary.id,
      type: 'COUNTER' as const,
      notes: null,
      items: items.map(({ productId, variantId, quantity, notes, optionIds }) => ({ productId, variantId, quantity, notes, optionIds })),
    };
    this.saving.set(true);
    const operation = draft ? this.orderApi.updateDraft(draft.id, payload) : this.orderApi.create(payload);
    operation.pipe(
      switchMap(() => this.tabApi.getCounterSale(detail.summary.id)),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: (updated) => {
        this.applyDetail(updated);
        this.activity.refresh();
        if (successMessage) this.feedback.success(successMessage);
      },
      error: (error) => {
        this.feedback.error(`${apiErrorMessage(error)} O pedido foi recarregado para evitar divergências.`);
        this.refreshDetail(false);
      },
    });
  }

  private updateOperationalItem(orderId: number, itemId: number, status: OrderItemStatus, message: string): void {
    const id = this.saleId();
    if (id == null || this.saving()) return;
    this.saving.set(true);
    this.orderApi.updateItemStatus(orderId, itemId, status).pipe(
      switchMap(() => this.tabApi.getCounterSale(id)),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: (detail) => {
        this.applyDetail(detail);
        this.activity.refresh();
        this.feedback.success(message);
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  private applyDetail(detail: CounterSaleDetail): void {
    this.detail.set(detail);
    this.customer = {
      name: detail.summary.customerName ?? '',
      phone: detail.customerPhone ?? '',
      identification: detail.identificationNote ?? '',
    };
    this.restoreDraftCart(detail);
  }

  private restoreDraftCart(detail: CounterSaleDetail): void {
    const draft = detail.orders.find((order) => order.status === 'CREATED');
    if (!draft) {
      this.cart.set([]);
      return;
    }
    const restored = draft.items
      .filter((item) => item.status === 'DRAFT')
      .map((item): CounterCartItem => {
        const product = this.products().find((candidate) => candidate.id === item.productId);
        const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
        return {
          key: this.nextCartKey++,
          productId: item.productId,
          variantId: item.variantId ?? 0,
          quantity: item.quantity,
          notes: item.notes,
          optionIds: item.options.map((option) => option.optionId).filter((id): id is number => id != null),
          productName: item.productNameSnapshot,
          variantName: operationalVariantLabel(item.variantNameSnapshot ?? variant?.name ?? 'Padrão'),
          optionNames: item.options.map((option) => option.optionName),
          unitPrice: item.unitPriceSnapshot,
          preparationFlow: item.preparationFlow,
        };
      });
    this.cart.set(restored);
  }

  private optional(value: string): string | null {
    const normalized = value.trim();
    return normalized || null;
  }
}
