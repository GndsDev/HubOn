import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PaymentDialogComponent } from '../../shared/components/payment-dialog/payment-dialog.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { OrderItem, OrderItemRequest, RestaurantOrder } from '../../shared/models/order.model';
import { Product, ProductOptionGroup, ProductVariant } from '../../shared/models/product.model';
import { Tab } from '../../shared/models/tab.model';
import {
  automaticVariantId,
  isCatalogProductSellable,
  operationalVariantLabel,
  optionSelectionsAreValid,
  priceRangeSummary,
  sellableVariants,
} from '../../shared/util/catalog-workflow';
import { apiErrorMessage } from '../../shared/util/api-error';

@Component({
  selector: 'app-tabs-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    EmptyStateComponent,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
    AccessibleDialogDirective,
    PaymentDialogComponent,
  ],
  template: `
    <app-page-header kicker="Atendimento de mesas" title="Comandas" description="Abra, acompanhe, receba e feche as comandas de mesa.">
      <div page-actions class="page-header-actions">
        @if (activeTabId()) {
          <a class="ghost-button" routerLink="/comandas"><i class="pi pi-arrow-left"></i>Voltar</a>
        }
        <button type="button" class="primary-button" (click)="openForm()"><i class="pi pi-plus"></i>Nova comanda</button>
      </div>
    </app-page-header>

    @if (!activeTabId()) {
      <app-section-card eyebrow="Mesas" title="Comandas abertas">
        @if (loading()) {
          <div class="collection-grid">@for (item of [1,2,3,4]; track item) { <div class="collection-card loading-card"></div> }</div>
        } @else if (error()) {
          <div class="error-panel"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar</strong><p>{{ error() }}</p></div>
            <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button>
          </div>
        } @else if (tabs().length === 0) {
          <app-empty-state icon="pi pi-receipt" title="Nenhuma comanda aberta" description="Abra uma comanda pelo número da mesa." />
        } @else {
          <div class="collection-grid">
            @for (tab of tabs(); track tab.id) {
              <a class="collection-card clickable collection-card-button" [routerLink]="['/comandas', tab.id]">
                <div class="collection-icon"><i class="pi pi-receipt"></i></div>
                <div class="collection-main">
                  <strong>Comanda #{{ tab.id }} · Mesa {{ tab.tableNumber ?? '-' }}</strong>
                  <span>Aberta por {{ tab.openedByUserName }}</span>
                  <small>{{ relativeTime(tab.openedAt) }}</small>
                </div>
                <div class="collection-side">
                  <app-status-badge [label]="listStateLabel(tab)" [tone]="listStateTone(tab)" />
                  <b>{{ currency(tab.finalAmount) }}</b>
                  <small>{{ listNextAction(tab) }}</small>
                </div>
              </a>
            }
          </div>
        }
      </app-section-card>
    } @else {
      <app-section-card eyebrow="Detalhe" [title]="selected()?.displayLabel ?? 'Comanda'">
        @if (detailLoading()) {
          <div class="loading-grid"><div class="loading-row"></div><div class="loading-row"></div><div class="loading-row"></div></div>
        } @else if (detailError()) {
          <div class="error-panel"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar a comanda</strong><p>{{ detailError() }}</p></div>
            <button type="button" class="ghost-button" (click)="refreshDetail()"><i class="pi pi-refresh"></i>Tentar novamente</button>
          </div>
        } @else if (selected(); as tab) {
          <div class="detail-grid tab-detail-summary">
            <div><span>Comanda</span><strong>#{{ tab.id }}</strong></div>
            <div><span>Mesa</span><strong>{{ tab.tableNumber ?? '-' }}</strong></div>
            <div><span>Abertura</span><strong>{{ relativeTime(tab.openedAt) }}</strong></div>
            <div><span>Estado</span><strong>{{ detailStateLabel(tab) }}</strong></div>
            <div><span>Total</span><strong>{{ currency(tab.finalAmount) }}</strong></div>
            <div><span>Pago</span><strong>{{ currency(tab.paidAmount) }}</strong></div>
            <div><span>Restante</span><strong>{{ currency(tab.remainingAmount) }}</strong></div>
          </div>

          @if (isPaidInFull(tab)) {
            <p class="order-state-note tab-wide-note"><i class="pi pi-lock"></i>Comanda já paga. Novos pedidos estão bloqueados; conclua as pendências operacionais antes de fechar.</p>
          }

          <div class="split-actions tab-detail-toolbar">
            <button type="button" class="secondary-button" (click)="openOrderForm()" [disabled]="!canAddOrder(tab)">
              <i class="pi pi-plus"></i>Adicionar pedido
            </button>
            <a class="ghost-button" routerLink="/pedidos"><i class="pi pi-shopping-cart"></i>Abrir Pedidos</a>
          </div>

          @if (orders().length === 0) {
            <app-empty-state icon="pi pi-shopping-cart" title="Comanda vazia" description="Adicione um pedido ou cancele a comanda vazia." />
          } @else {
            <div class="order-list tab-order-list">
              @for (order of orders(); track order.id) {
                <article class="order-card">
                  <div class="order-card-head">
                    <div>
                      <span>Pedido #{{ order.id }}</span>
                      <strong>{{ orderStatusLabel(order) }}</strong>
                      @if (order.notes) { <small>Observação: {{ order.notes }}</small> }
                      @if (order.cancellationReason) { <small>Cancelado: {{ order.cancellationReason }}</small> }
                    </div>
                    <app-status-badge [label]="orderStatusLabel(order)" [tone]="orderStatusTone(order)" />
                  </div>

                  <div class="order-item-list detailed-order-items">
                    @for (item of order.items; track item.id) {
                      <div class="detailed-order-item" [class.cancelled]="item.status === 'CANCELED'">
                        <div>
                          <span>{{ item.quantity }}x {{ item.displayNameSnapshot || item.productNameSnapshot }}</span>
                          @for (option of item.options; track option.id) { <small>{{ option.groupName }}: {{ option.optionName }}</small> }
                          @if (item.notes) { <small>Observação: {{ item.notes }}</small> }
                          @if (item.cancellationReason) { <small>Cancelado: {{ item.cancellationReason }}</small> }
                        </div>
                        <div class="order-item-side">
                          <app-status-badge [label]="itemStatusLabel(item)" [tone]="itemStatusTone(item.status)" />
                          <b>{{ currency(item.subtotal) }}</b>
                          @if (canCancelItem(tab, order, item)) {
                            <button type="button" class="text-action danger-text" (click)="openCancelItem(order, item)">Cancelar item</button>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <div class="order-card-footer">
                    <strong>{{ currency(orderTotal(order)) }}</strong>
                    <div class="action-cluster">
                      @if (canEditOrder(tab, order)) {
                        <button type="button" class="ghost-button compact-button" (click)="openEditOrder(order)"><i class="pi pi-pencil"></i>Editar rascunho</button>
                        <button type="button" class="primary-button compact-button" (click)="confirm(order)"><i class="pi pi-check"></i>Confirmar pedido</button>
                      }
                      @if (canCancelOrder(tab, order)) {
                        <button type="button" class="text-action danger-text" (click)="openCancelOrder(order)">Cancelar pedido</button>
                      }
                    </div>
                  </div>
                </article>
              }
            </div>
          }

          <div class="modal-footer modal-actions tab-page-footer">
            @if (canReceivePayment() && tab.remainingAmount > 0) {
              <button type="button" class="primary-button" (click)="paymentOpen.set(true)"><i class="pi pi-wallet"></i>{{ tab.paidAmount > 0 ? 'Completar pagamento' : 'Registrar pagamento' }}</button>
            }
            @if (canCancelEmptyTab(tab)) {
              <button type="button" class="danger-button secondary-danger" (click)="pendingCancel.set(tab)"><i class="pi pi-times-circle"></i>Cancelar comanda vazia</button>
            }
            <button type="button" class="primary-button" [disabled]="!canClose(tab)" (click)="close(tab)"><i class="pi pi-check-circle"></i>Fechar comanda</button>
          </div>

          @if (closureIssues(tab).length) {
            <div class="closure-reasons" aria-live="polite">
              @for (issue of closureIssues(tab); track issue) {
                <span><i class="pi pi-info-circle"></i>{{ issue }}</span>
              }
            </div>
          }
        }
      </app-section-card>
    }

    @if (formOpen()) {
      <div class="modal-backdrop" (click)="formOpen.set(false)">
        <form
          class="modal-panel compact"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="tab-form-dialog-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="formOpen.set(false)"
          (click)="$event.stopPropagation()"
          (ngSubmit)="create()"
        >
          <div class="modal-header">
            <div class="modal-heading"><span class="modal-eyebrow">Mesa</span><h2 id="tab-form-dialog-title">Nova comanda</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="formOpen.set(false)"><i class="pi pi-times"></i></button>
          </div>
          <div class="modal-body">
            <label class="field full">
              <span>Número da mesa</span>
              <input name="tableNumber" type="number" min="1" step="1" [(ngModel)]="form.tableNumber" required autofocus />
            </label>
          </div>
          <div class="modal-footer modal-actions">
            <button type="button" class="ghost-button" (click)="formOpen.set(false)">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-receipt"></i>{{ saving() ? 'Abrindo...' : 'Abrir comanda' }}</button>
          </div>
        </form>
      </div>
    }

    @if (orderFormOpen() && selected(); as tab) {
      <div class="modal-backdrop" (click)="closeOrderForm()">
        <form class="modal-panel wide order-builder-panel" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="tab-order-dialog-title" [dialogCloseDisabled]="saving()" (dialogClose)="closeOrderForm()" (click)="$event.stopPropagation()" (ngSubmit)="saveDraft()">
          <div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">{{ tab.displayLabel }}</span><h2 id="tab-order-dialog-title">{{ editingOrder() ? 'Editar pedido' : 'Adicionar pedido' }}</h2></div><button type="button" class="icon-button" aria-label="Fechar" (click)="closeOrderForm()"><i class="pi pi-times"></i></button></div>
          <div class="modal-body order-builder-body">
            <label class="field full"><span>Observação geral</span><textarea name="notes" [(ngModel)]="orderForm.notes" maxlength="500" autofocus></textarea></label>
            <div class="form-section-title"><div><span>Itens do pedido</span><small>Preço e disponibilidade são validados pelo sistema.</small></div><button type="button" class="secondary-button compact-button" (click)="addItem()"><i class="pi pi-plus"></i>Adicionar item</button></div>
            <div class="order-builder-items">
              @for (item of orderForm.items; track $index; let index = $index) {
                <section class="order-builder-item">
                  <div class="order-builder-main">
                    <label class="field"><span>Produto</span><select [name]="'product-' + index" [(ngModel)]="item.productId" (ngModelChange)="onProductChange(item, $event)"><option [ngValue]="0" disabled>Selecione</option>@for (product of products(); track product.id) { <option [ngValue]="product.id">{{ product.name }} · {{ priceSummary(product) }}</option> }</select></label>
                    @if (activeVariants(item.productId).length > 1) { <label class="field"><span>Variação</span><select [name]="'variant-' + index" [(ngModel)]="item.variantId" (ngModelChange)="item.optionIds = []"><option [ngValue]="0" disabled>Selecione</option>@for (variant of activeVariants(item.productId); track variant.id) { <option [ngValue]="variant.id">{{ variant.name }} · {{ currency(variant.price) }}</option> }</select></label> }
                    @else if (selectedVariant(item); as variant) { <div class="selected-variant"><span>Variação</span><strong>{{ variantLabel(variant) }}</strong><small>{{ currency(variant.price) }}</small></div> }
                    <label class="field quantity-field"><span>Qtd.</span><input [name]="'quantity-' + index" type="number" min="1" [(ngModel)]="item.quantity" /></label>
                    <label class="field"><span>Observação</span><input [name]="'notes-' + index" [(ngModel)]="item.notes" placeholder="Ex.: sem cebola" /></label>
                    <button type="button" class="icon-button danger-icon" title="Remover item" aria-label="Remover item" (click)="removeItem(index)" [disabled]="orderForm.items.length === 1"><i class="pi pi-trash"></i></button>
                  </div>
                  @if (optionGroups(item.productId).length) {
                    <div class="order-choice-groups">
                      @for (group of optionGroups(item.productId); track group.id) {
                        <fieldset class="order-choice-group"><legend>{{ group.name }} @if (group.required) { <small>Obrigatório</small> }</legend><div class="choice-pills">@for (option of activeOptions(group); track option.id) { <label [class.selected]="item.optionIds.includes(option.id)"><input [type]="group.maximumSelections === 1 ? 'radio' : 'checkbox'" [name]="'choice-' + index + '-' + group.id" [checked]="item.optionIds.includes(option.id)" (change)="toggleOption(item, group, option.id)" /><span>{{ option.name }} @if (option.additionalPrice) { <small>+ {{ currency(option.additionalPrice) }}</small> }</span></label> }</div><small>Escolha de {{ group.minimumSelections }} a {{ group.maximumSelections }}.</small></fieldset>
                      }
                    </div>
                  }
                </section>
              }
            </div>
          </div>
          <div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="closeOrderForm()">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-save"></i>{{ saving() ? 'Salvando...' : 'Salvar rascunho' }}</button></div>
        </form>
      </div>
    }

    @if (cancelOpen()) {
      <div class="modal-backdrop" (click)="closeCancel()"><form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="cancel-title" [dialogCloseDisabled]="saving()" (dialogClose)="closeCancel()" (click)="$event.stopPropagation()" (ngSubmit)="confirmCancellation()"><div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Auditoria</span><h2 id="cancel-title">{{ cancelItem() ? 'Cancelar item' : 'Cancelar pedido' }}</h2></div><button type="button" class="icon-button" aria-label="Fechar" (click)="closeCancel()"><i class="pi pi-times"></i></button></div><div class="modal-body"><label class="field"><span>Motivo</span><textarea name="cancelReason" [(ngModel)]="cancelReason" maxlength="500" required autofocus></textarea></label></div><div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="closeCancel()">Voltar</button><button type="submit" class="danger-button" [disabled]="saving()"><i class="pi pi-times"></i>Confirmar cancelamento</button></div></form></div>
    }

    @if (pendingCancel(); as tab) {
      <div class="modal-backdrop" (click)="pendingCancel.set(null)">
        <section class="modal-panel compact" appAccessibleDialog role="alertdialog" aria-modal="true" aria-labelledby="tab-cancel-title" (dialogClose)="pendingCancel.set(null)" (click)="$event.stopPropagation()">
          <div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Confirmação</span><h2 id="tab-cancel-title">Cancelar a comanda #{{ tab.id }}?</h2></div><button type="button" class="icon-button" aria-label="Fechar" (click)="pendingCancel.set(null)"><i class="pi pi-times"></i></button></div>
          <div class="modal-body"><p class="modal-description">Comanda vazia será encerrada sem venda registrada.</p></div>
          <div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="pendingCancel.set(null)">Voltar</button><button type="button" class="danger-button" (click)="cancel(tab)"><i class="pi pi-times-circle"></i>Confirmar cancelamento</button></div>
        </section>
      </div>
    }

    @if (paymentOpen() && selected(); as tab) {
      <app-payment-dialog
        [tabId]="tab.id"
        [originLabel]="tab.displayLabel"
        [totalAmount]="tab.finalAmount"
        [paidAmount]="tab.paidAmount"
        [remainingAmount]="tab.remainingAmount"
        (dismissed)="paymentOpen.set(false)"
        (completed)="onPaymentCompleted()"
      />
    }
  `,
})
export class TabsPageComponent implements OnInit {
  private readonly api = inject(TabApiService);
  private readonly orderApi = inject(OrderApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tabs = signal<Tab[]>([]);
  readonly orders = signal<RestaurantOrder[]>([]);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly detailError = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly orderFormOpen = signal(false);
  readonly editingOrder = signal<RestaurantOrder | null>(null);
  readonly selected = signal<Tab | null>(null);
  readonly activeTabId = signal<number | null>(null);
  readonly pendingCancel = signal<Tab | null>(null);
  readonly paymentOpen = signal(false);
  readonly cancelOpen = signal(false);
  readonly cancelOrder = signal<RestaurantOrder | null>(null);
  readonly cancelItem = signal<OrderItem | null>(null);
  form = { tableNumber: 1 };
  cancelReason = '';
  orderForm: { notes: string; items: OrderItemRequest[] } = { notes: '', items: [] };

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tabId = Number(params.get('tabId'));
      this.activeTabId.set(Number.isFinite(tabId) && tabId > 0 ? tabId : null);
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getOpen().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (tabs) => {
        this.tabs.set(tabs.filter((tab) => tab.type === 'TABLE'));
        if (this.activeTabId()) this.refreshDetail();
        else this.clearDetail();
      },
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  refreshDetail(): void {
    const tabId = this.activeTabId();
    if (!tabId) return;
    this.detailLoading.set(true);
    this.detailError.set(null);
    forkJoin({
      tab: this.api.getById(tabId),
      orders: this.orderApi.getByTab(tabId),
      products: this.productApi.getAll(),
    }).pipe(finalize(() => this.detailLoading.set(false))).subscribe({
      next: ({ tab, orders, products }) => {
        if (tab.type !== 'TABLE') {
          this.detailError.set('A comanda informada não é de mesa.');
          return;
        }
        this.selected.set(tab);
        this.orders.set(orders);
        this.products.set(products.filter(isCatalogProductSellable));
        this.tabs.update((current) => current.some((candidate) => candidate.id === tab.id)
          ? current.map((candidate) => candidate.id === tab.id ? tab : candidate)
          : [tab, ...current]);
      },
      error: (error) => this.detailError.set(apiErrorMessage(error)),
    });
  }

  openForm(): void {
    if (!this.auth.currentUser()) {
      this.feedback.error('Faça login antes de abrir a comanda.');
      return;
    }
    this.form = { tableNumber: 1 };
    this.formOpen.set(true);
  }

  create(): void {
    if (!this.auth.currentUser()) {
      this.feedback.error('Faça login antes de abrir a comanda.');
      return;
    }
    const tableNumber = Number(this.form.tableNumber);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
      this.feedback.error('Informe um número de mesa válido.');
      return;
    }
    this.saving.set(true);
    this.api.open({ tableNumber, tableId: null, serviceFee: 0, discountAmount: 0 })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (tab) => {
          this.feedback.success('Comanda aberta com sucesso.');
          this.formOpen.set(false);
          this.router.navigate(['/comandas', tab.id]);
        },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  openOrderForm(): void {
    const tab = this.selected();
    if (!tab || !this.canAddOrder(tab)) {
      this.feedback.info('A comanda já foi paga. Não é possível adicionar novos pedidos.');
      return;
    }
    if (!this.products().length) {
      this.feedback.info('Não há produtos disponíveis.');
      return;
    }
    this.editingOrder.set(null);
    this.orderForm = { notes: '', items: [this.emptyItem()] };
    this.orderFormOpen.set(true);
  }

  openEditOrder(order: RestaurantOrder): void {
    this.editingOrder.set(order);
    this.orderForm = {
      notes: order.notes ?? '',
      items: order.items
        .filter((item) => item.status === 'DRAFT')
        .map((item) => ({
          productId: item.productId,
          variantId: item.variantId ?? 0,
          quantity: item.quantity,
          notes: item.notes,
          optionIds: item.options.map((option) => option.optionId).filter((id): id is number => id != null),
        })),
    };
    if (!this.orderForm.items.length) this.orderForm.items = [this.emptyItem()];
    this.orderFormOpen.set(true);
  }

  closeOrderForm(): void {
    if (!this.saving()) this.orderFormOpen.set(false);
  }

  saveDraft(): void {
    const tab = this.selected();
    if (!tab) return;
    if (!this.canAddOrder(tab)) {
      this.feedback.error('A comanda já foi paga. Não é possível adicionar novos pedidos.');
      return;
    }
    if (this.orderForm.items.some((item) => !item.productId || !item.variantId || item.quantity < 1 || !this.validSelections(item))) {
      this.feedback.error('Revise os produtos, variações e escolhas obrigatórias.');
      return;
    }
    this.saving.set(true);
    const payload = { tabId: tab.id, type: 'TABLE' as const, notes: this.orderForm.notes.trim() || null, items: this.orderForm.items };
    const current = this.editingOrder();
    const operation = current ? this.orderApi.updateDraft(current.id, payload) : this.orderApi.create(payload);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.feedback.success('Rascunho salvo. Revise e confirme o pedido.');
        this.orderFormOpen.set(false);
        this.refreshDetail();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  confirm(order: RestaurantOrder): void {
    this.orderApi.confirm(order.id).subscribe({
      next: () => { this.feedback.success('Pedido confirmado.'); this.refreshDetail(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  openCancelOrder(order: RestaurantOrder): void {
    this.cancelOrder.set(order);
    this.cancelItem.set(null);
    this.cancelReason = '';
    this.cancelOpen.set(true);
  }

  openCancelItem(order: RestaurantOrder, item: OrderItem): void {
    this.cancelOrder.set(order);
    this.cancelItem.set(item);
    this.cancelReason = '';
    this.cancelOpen.set(true);
  }

  closeCancel(): void {
    if (!this.saving()) this.cancelOpen.set(false);
  }

  confirmCancellation(): void {
    const order = this.cancelOrder();
    const item = this.cancelItem();
    const reason = this.cancelReason.trim();
    if (!order || !reason) {
      this.feedback.error('Informe o motivo do cancelamento.');
      return;
    }
    this.saving.set(true);
    const operation = item ? this.orderApi.cancelItem(order.id, item.id, reason) : this.orderApi.cancel(order.id, reason);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.feedback.success(item ? 'Item cancelado.' : 'Pedido cancelado.');
        this.cancelOpen.set(false);
        this.refreshDetail();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  onPaymentCompleted(): void {
    this.paymentOpen.set(false);
    this.refreshDetail();
  }

  close(tab: Tab): void {
    if (!this.canClose(tab)) return;
    this.api.close(tab.id).subscribe({
      next: () => {
        this.feedback.success('Comanda fechada com sucesso.');
        this.router.navigate(['/comandas']);
        this.load();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  cancel(tab: Tab): void {
    this.api.cancel(tab.id).subscribe({
      next: () => {
        this.feedback.success('Comanda cancelada com sucesso.');
        this.pendingCancel.set(null);
        this.router.navigate(['/comandas']);
        this.load();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  canReceivePayment(): boolean {
    return this.auth.hasAnyRole(['OWNER', 'ADMIN', 'CASHIER']);
  }

  canAddOrder(tab: Tab): boolean {
    return tab.status === 'OPEN' && !this.isPaidInFull(tab);
  }

  canEditOrder(tab: Tab, order: RestaurantOrder): boolean {
    return this.canAddOrder(tab) && order.status === 'CREATED';
  }

  canCancelOrder(tab: Tab, order: RestaurantOrder): boolean {
    return tab.status === 'OPEN' && tab.paidAmount === 0 && order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
  }

  canCancelItem(tab: Tab, order: RestaurantOrder, item: OrderItem): boolean {
    return this.canCancelOrder(tab, order) && item.status !== 'DELIVERED' && item.status !== 'CANCELED';
  }

  canCancelEmptyTab(tab: Tab): boolean {
    return tab.status === 'OPEN'
      && tab.paidAmount === 0
      && this.orders().every((order) => order.status === 'CANCELLED');
  }

  canClose(tab: Tab): boolean {
    return this.closureIssues(tab).length === 0;
  }

  closureIssues(tab: Tab): string[] {
    const issues: string[] = [];
    if (tab.remainingAmount > 0) issues.push('Saldo pendente');
    if (this.orders().some((order) => order.status === 'CREATED' || order.items.some((item) => item.status === 'DRAFT'))) issues.push('Pedido em rascunho');
    if (this.countItems('WAITING_PREPARATION') > 0) issues.push('Itens aguardando preparo');
    if (this.countItems('IN_PREPARATION') > 0) issues.push('Itens em preparo');
    if (this.countItems('READY') > 0) issues.push('Itens prontos aguardando entrega');
    if (this.confirmedOrderCount() === 0) issues.push('Comanda vazia');
    return issues;
  }

  isPaidInFull(tab: Tab): boolean {
    return tab.paidAmount > 0 && tab.remainingAmount === 0;
  }

  detailStateLabel(tab: Tab): string {
    if (this.canClose(tab)) return 'Pronta para fechar';
    if (this.isPaidInFull(tab)) return 'Paga';
    if (tab.paidAmount > 0) return 'Pagamento parcial';
    if (this.orders().some((order) => order.status === 'CREATED')) return 'Rascunho';
    return this.orders().length ? 'Em atendimento' : 'Vazia';
  }

  listStateLabel(tab: Tab): string {
    if (this.isPaidInFull(tab)) return 'Paga';
    if (tab.paidAmount > 0) return 'Parcial';
    return 'Aberta';
  }

  listStateTone(tab: Tab): string {
    if (this.isPaidInFull(tab)) return 'success';
    if (tab.paidAmount > 0) return 'info';
    return 'warning';
  }

  listNextAction(tab: Tab): string {
    if (this.isPaidInFull(tab)) return 'Conferir fechamento';
    return tab.paidAmount > 0 ? 'Completar pagamento' : 'Atender mesa';
  }

  orderStatusLabel(order: RestaurantOrder): string {
    return {
      CREATED: 'Rascunho',
      SENT_TO_KITCHEN: 'Aguardando preparo',
      PREPARING: 'Em preparo',
      READY: 'Pronto',
      DELIVERED: 'Entregue',
      CANCELLED: 'Cancelado',
    }[order.status];
  }

  orderStatusTone(order: RestaurantOrder): string {
    return { CREATED: 'neutral', SENT_TO_KITCHEN: 'info', PREPARING: 'warning', READY: 'success', DELIVERED: 'success', CANCELLED: 'danger' }[order.status];
  }

  itemStatusLabel(item: OrderItem): string {
    return {
      DRAFT: 'Rascunho',
      WAITING_PREPARATION: 'Aguardando preparo',
      IN_PREPARATION: 'Em preparo',
      READY: 'Pronto',
      DELIVERED: 'Entregue',
      CANCELED: 'Cancelado',
    }[item.status];
  }

  itemStatusTone(status: OrderItem['status']): string {
    return { DRAFT: 'neutral', WAITING_PREPARATION: 'info', IN_PREPARATION: 'warning', READY: 'success', DELIVERED: 'success', CANCELED: 'danger' }[status];
  }

  orderTotal(order: RestaurantOrder): number {
    return order.items.filter((item) => item.status !== 'CANCELED').reduce((total, item) => total + item.subtotal, 0);
  }

  addItem(): void {
    this.orderForm.items.push(this.emptyItem());
  }

  removeItem(index: number): void {
    if (this.orderForm.items.length > 1) this.orderForm.items.splice(index, 1);
  }

  activeVariants(productId: number): ProductVariant[] {
    return sellableVariants(this.products().find((product) => product.id === productId));
  }

  selectedVariant(item: OrderItemRequest): ProductVariant | null {
    return this.activeVariants(item.productId).find((variant) => variant.id === item.variantId) ?? null;
  }

  optionGroups(productId: number): ProductOptionGroup[] {
    return this.products().find((product) => product.id === productId)?.optionGroups.filter((group) => group.active) ?? [];
  }

  activeOptions(group: ProductOptionGroup) {
    return group.options.filter((option) => option.active);
  }

  onProductChange(item: OrderItemRequest, productId: number): void {
    item.productId = productId;
    item.optionIds = [];
    item.variantId = automaticVariantId(this.products().find((product) => product.id === productId));
  }

  toggleOption(item: OrderItemRequest, group: ProductOptionGroup, optionId: number): void {
    const groupOptionIds = new Set(group.options.map((option) => option.id));
    const selectedInGroup = item.optionIds.filter((id) => groupOptionIds.has(id));
    if (item.optionIds.includes(optionId)) {
      item.optionIds = item.optionIds.filter((id) => id !== optionId);
      return;
    }
    if (group.maximumSelections === 1) item.optionIds = item.optionIds.filter((id) => !groupOptionIds.has(id));
    else if (selectedInGroup.length >= group.maximumSelections) {
      this.feedback.info(`Escolha no máximo ${group.maximumSelections} opção(ões) em ${group.name}.`);
      return;
    }
    item.optionIds.push(optionId);
  }

  priceSummary(product: Product): string {
    return priceRangeSummary(product.minimumVariantPrice, product.maximumVariantPrice, (value) => this.currency(value), true);
  }

  variantLabel(variant: ProductVariant): string {
    return operationalVariantLabel(variant.name);
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  relativeTime(value: string): string {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    return minutes < 60 ? `há ${minutes} min` : `há ${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }

  private clearDetail(): void {
    this.selected.set(null);
    this.orders.set([]);
    this.detailError.set(null);
  }

  private confirmedOrderCount(): number {
    return this.orders()
      .filter((order) => order.status !== 'CREATED' && order.status !== 'CANCELLED')
      .filter((order) => order.items.some((item) => item.status !== 'DRAFT' && item.status !== 'CANCELED'))
      .length;
  }

  private countItems(status: OrderItem['status']): number {
    return this.orders()
      .flatMap((order) => order.items)
      .filter((item) => item.status === status)
      .reduce((count, item) => count + item.quantity, 0);
  }

  private validSelections(item: OrderItemRequest): boolean {
    return optionSelectionsAreValid(this.optionGroups(item.productId), item.optionIds);
  }

  private emptyItem(): OrderItemRequest {
    return { productId: 0, variantId: 0, quantity: 1, notes: '', optionIds: [] };
  }
}
