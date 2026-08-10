import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, of, switchMap, tap } from 'rxjs';
import { CounterActivityService } from '../../core/services/counter-activity.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { SalesApiService } from '../../core/services/sales-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PaymentDialogComponent } from '../../shared/components/payment-dialog/payment-dialog.component';
import { SaleProductPickerComponent } from '../../shared/components/sale-product-picker/sale-product-picker.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { Product } from '../../shared/models/product.model';
import { AddSaleItemRequest, PaymentMethod, Sale, SaleItem } from '../../shared/models/sale.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { activeSaleItems, itemMatchesRequest, saleCanChangeItems, saleCanClose, saleChoiceSummary } from '../../shared/util/sale-workflow';

@Component({
  selector: 'app-counter-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    EmptyStateComponent,
    PageHeaderComponent,
    PaymentDialogComponent,
    SaleProductPickerComponent,
    StatusBadgeComponent,
    AccessibleDialogDirective,
  ],
  template: `
    @if (!currentSale()) {
      <app-page-header
        kicker="Operação"
        title="Balcão"
        description="Acompanhe as vendas em andamento e retome cada atendimento."
      >
        <div page-actions class="page-header-actions">
          <button type="button" class="primary-button" (click)="newSale()" [disabled]="saving()">
            <i class="pi pi-plus"></i>
            {{ saving() ? 'Abrindo...' : 'Nova venda no balcão' }}
          </button>
        </div>
      </app-page-header>

      @if (loading()) {
        <div class="loading-grid counter-loading-grid" aria-label="Carregando vendas">
          <div class="loading-card"></div>
          <div class="loading-card"></div>
          <div class="loading-card"></div>
        </div>
      } @else if (error()) {
        <div class="error-panel" role="alert">
          <i class="pi pi-exclamation-triangle"></i>
          <div>
            <strong>Não foi possível carregar o Balcão</strong>
            <p>{{ error() }}</p>
          </div>
          <button type="button" class="ghost-button" (click)="load()">
            <i class="pi pi-refresh"></i>
            Tentar novamente
          </button>
        </div>
      } @else {
        <section class="counter-overview" aria-label="Resumo das vendas abertas">
          <article>
            <span>Ativas</span>
            <strong>{{ openSales().length }}</strong>
            <small>permanecem aqui até o fechamento</small>
          </article>
          <article>
            <span>Itens</span>
            <strong>{{ openItemCount() }}</strong>
            <small>nas vendas em andamento</small>
          </article>
          <article>
            <span>A receber</span>
            <strong>{{ currency(openReceivable()) }}</strong>
            <small>saldo das vendas abertas</small>
          </article>
          <article>
            <span>Ticket aberto</span>
            <strong>{{ currency(openAverageTicket()) }}</strong>
            <small>média das vendas em andamento</small>
          </article>
        </section>

        <div class="counter-center-toolbar">
          <div>
            <strong>Vendas em andamento</strong>
            <small>Abra uma venda para continuar o atendimento.</small>
          </div>
          <button type="button" class="icon-button" aria-label="Atualizar vendas" title="Atualizar" (click)="load()">
            <i class="pi pi-refresh"></i>
          </button>
        </div>

        @if (openSales().length === 0) {
          <app-empty-state
            icon="pi pi-shopping-bag"
            title="Nenhuma venda em andamento"
            description="Inicie uma nova venda no balcão."
          />
        } @else {
          <section class="counter-sale-grid" aria-label="Lista de vendas em andamento">
            @for (sale of openSales(); track sale.id) {
              <article class="counter-sale-card">
                <header>
                  <div>
                    <span>Venda #{{ sale.id }}</span>
                    <h2>{{ sale.customerName || 'Venda de balcão' }}</h2>
                    <small>{{ relativeTime(sale.openedAt) }} · {{ sale.openedByUserName }}</small>
                  </div>
                  <app-status-badge
                    [label]="sale.paidAmount > 0 ? 'Parcial' : 'Aberta'"
                    [tone]="sale.paidAmount > 0 ? 'info' : 'warning'"
                  />
                </header>

                <div class="counter-state-row">
                  <span>
                    <small>Itens</small>
                    <strong>{{ saleItemQuantity(sale) }}</strong>
                  </span>
                  <span>
                    <small>Pagamento</small>
                    <strong>{{ paymentState(sale) }}</strong>
                  </span>
                </div>

                <div class="counter-sale-values">
                  <span>
                    <small>Total</small>
                    <strong>{{ currency(sale.finalAmount) }}</strong>
                  </span>
                  <span>
                    <small>Pago</small>
                    <strong>{{ currency(sale.paidAmount) }}</strong>
                  </span>
                  <span>
                    <small>Restante</small>
                    <strong>{{ currency(sale.remainingAmount) }}</strong>
                  </span>
                </div>

                <footer>
                  <div>
                    <small>Próxima ação</small>
                    <strong>{{ nextAction(sale) }}</strong>
                  </div>
                  <a class="primary-button" [routerLink]="['/balcao', sale.id]">
                    <i class="pi pi-arrow-right"></i>
                    Continuar atendimento
                  </a>
                </footer>
              </article>
            }
          </section>
        }
      }
    } @else if (currentSale(); as sale) {
      <app-page-header
        kicker="Venda rápida"
        [title]="'Venda #' + sale.id"
        description="Adicione os produtos, confira os itens e receba o pagamento."
      >
        <div page-actions class="page-header-actions">
          <a class="secondary-button" routerLink="/balcao">
            <i class="pi pi-arrow-left"></i>
            Vendas em andamento
          </a>
          <button type="button" class="icon-button" aria-label="Atualizar venda" title="Atualizar" (click)="load(sale.id)">
            <i class="pi pi-refresh"></i>
          </button>
        </div>
      </app-page-header>

      @if (error()) {
        <div class="error-panel" role="alert">
          <i class="pi pi-exclamation-triangle"></i>
          <div>
            <strong>Não foi possível atualizar o atendimento</strong>
            <p>{{ error() }}</p>
          </div>
          <button type="button" class="ghost-button" (click)="load(sale.id)">
            <i class="pi pi-refresh"></i>
            Tentar novamente
          </button>
        </div>
      } @else {
        <section class="counter-detail-status" aria-label="Situação do atendimento">
          <div>
            <small>Atendimento</small>
            <app-status-badge label="Em andamento" tone="info" />
          </div>
          <div>
            <small>Itens</small>
            <strong>{{ saleItemQuantity(sale) }}</strong>
          </div>
          <div>
            <small>Financeiro</small>
            <app-status-badge
              [label]="paymentState(sale)"
              [tone]="sale.remainingAmount === 0 ? 'success' : sale.paidAmount > 0 ? 'info' : 'warning'"
            />
          </div>
          <div class="counter-next-action">
            <small>Próxima ação</small>
            <strong>{{ nextAction(sale) }}</strong>
          </div>
        </section>

        <div class="counter-workspace">
          <section class="counter-catalog" aria-label="Cardápio do balcão">
            <app-sale-product-picker
              [products]="products()"
              [disabled]="!canChangeItems()"
              [busyProductId]="busyProductId()"
              [confirmationMessage]="productFeedback()"
              confirmLabel="Adicionar à venda"
              (addItem)="addProduct($event)"
            />
          </section>

          <aside class="counter-sale-panel" aria-label="Resumo da venda">
            <header class="counter-sale-header">
              <div>
                <span>Venda atual</span>
                <h2>Venda #{{ sale.id }}</h2>
              </div>
              <span class="counter-sync-state">
                <i class="pi" [class.pi-spin]="saving()" [class.pi-spinner]="saving()" [class.pi-cloud]="!saving()"></i>
                {{ saving() ? 'Salvando...' : 'Salvo no sistema' }}
              </span>
            </header>

            @if (!canChangeItems()) {
              <p class="order-state-note">
                <i class="pi pi-lock"></i>
                A venda possui pagamento e os itens estão bloqueados.
              </p>
            }

            <div class="counter-cart-list">
              @for (item of activeItems(); track item.id) {
                <article class="counter-cart-item">
                  <div>
                    <strong>{{ item.productName }}</strong>
                    @if (optionSummary(item)) {
                      <span>{{ optionSummary(item) }}</span>
                    }
                    @if (item.notes) {
                      <small class="auxiliary-note">
                        <i class="pi pi-comment"></i>
                        {{ item.notes }}
                      </small>
                    }
                  </div>

                  <div class="counter-cart-side">
                    <b>{{ currency(item.subtotal) }}</b>
                    @if (canChangeItems()) {
                      <div class="counter-quantity-stepper">
                        <button
                          type="button"
                          class="icon-button"
                          aria-label="Diminuir quantidade"
                          title="Diminuir"
                          (click)="changeQuantity(item, item.quantity - 1)"
                          [disabled]="item.quantity <= 1 || actionItemId() === item.id"
                        >
                          <i class="pi pi-minus"></i>
                        </button>
                        <span>{{ item.quantity }}</span>
                        <button
                          type="button"
                          class="icon-button"
                          aria-label="Aumentar quantidade"
                          title="Aumentar"
                          (click)="changeQuantity(item, item.quantity + 1)"
                          [disabled]="actionItemId() === item.id"
                        >
                          <i class="pi pi-plus"></i>
                        </button>
                        <button
                          type="button"
                          class="icon-button danger"
                          aria-label="Remover item"
                          title="Remover item"
                          (click)="removeItem(item)"
                          [disabled]="actionItemId() === item.id"
                        >
                          <i class="pi pi-trash"></i>
                        </button>
                      </div>
                    }
                  </div>
                </article>
              } @empty {
                <app-empty-state
                  icon="pi pi-shopping-cart"
                  title="Venda vazia"
                  description="Adicione o primeiro produto do atendimento."
                />
              }
            </div>

            <div class="counter-total">
              <span>Total</span>
              <strong>{{ currency(sale.finalAmount) }}</strong>
            </div>

            @if (sale.paidAmount > 0) {
              <div class="counter-sale-values">
                <span>
                  <small>Pago</small>
                  <strong>{{ currency(sale.paidAmount) }}</strong>
                </span>
                <span>
                  <small>Restante</small>
                  <strong>{{ currency(sale.remainingAmount) }}</strong>
                </span>
              </div>
            }

            @if (activeItems().length > 0 && sale.remainingAmount > 0) {
              <div class="counter-payment-actions">
                <span>Recebimento rápido</span>
                <div class="counter-quick-payments">
                  <button type="button" class="secondary-button compact-button" (click)="quickPay('PIX')" [disabled]="saving()">
                    <i class="pi pi-qrcode"></i>
                    PIX
                  </button>
                  <button type="button" class="secondary-button compact-button" (click)="quickPay('CASH')" [disabled]="saving()">
                    <i class="pi pi-money-bill"></i>
                    Dinheiro
                  </button>
                  <button type="button" class="secondary-button compact-button" (click)="quickPay('DEBIT_CARD')" [disabled]="saving()">
                    <i class="pi pi-credit-card"></i>
                    Débito
                  </button>
                  <button type="button" class="secondary-button compact-button" (click)="quickPay('CREDIT_CARD')" [disabled]="saving()">
                    <i class="pi pi-credit-card"></i>
                    Crédito
                  </button>
                </div>

                <button type="button" class="primary-button counter-primary-action" (click)="paymentOpen.set(true)" [disabled]="saving()">
                  <i class="pi pi-wallet"></i>
                  Pagamento parcial ou outro
                </button>
              </div>
            }

            @if (canClose()) {
              <button type="button" class="primary-button counter-primary-action" (click)="finishZeroSale()" [disabled]="saving()">
                <i class="pi pi-check"></i>
                Finalizar venda
              </button>
            }

            @if (sale.payments.length === 0) {
              <button type="button" class="danger-button counter-secondary-action" (click)="openSaleCancellation()" [disabled]="saving()">
                <i class="pi pi-times"></i>
                Cancelar venda
              </button>
            }
          </aside>
        </div>
      }
    }

    @if (paymentOpen() && currentSale(); as sale) {
      <app-payment-dialog
        [saleId]="sale.id"
        [originLabel]="'Balcão · Venda #' + sale.id"
        [totalAmount]="sale.finalAmount"
        [paidAmount]="sale.paidAmount"
        [remainingAmount]="sale.remainingAmount"
        (completed)="paymentCompleted($event)"
        (dismissed)="paymentOpen.set(false)"
      />
    }

    @if (cancelSaleOpen()) {
      <div class="modal-backdrop">
        <form
          class="modal-panel compact"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="counter-cancel-sale-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="cancelSaleOpen.set(false)"
          (ngSubmit)="cancelSale()"
        >
          <div class="modal-header">
            <div class="modal-heading">
              <span class="modal-eyebrow">Balcão</span>
              <h2 id="counter-cancel-sale-title">Cancelar venda</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar cancelamento" (click)="cancelSaleOpen.set(false)">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <label class="field">
              <span>Motivo</span>
              <textarea name="counterCancelSaleReason" maxlength="500" [(ngModel)]="cancellationReason" required autofocus></textarea>
            </label>
          </div>
          <div class="modal-footer modal-actions">
            <button type="button" class="ghost-button" (click)="cancelSaleOpen.set(false)">Voltar</button>
            <button type="submit" class="danger-button" [disabled]="saving() || !cancellationReason.trim()">Cancelar venda</button>
          </div>
        </form>
      </div>
    }
  `,
})
export class CounterPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(SalesApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly activity = inject(CounterActivityService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly products = signal<Product[]>([]);
  readonly openSales = signal<Sale[]>([]);
  readonly currentSale = signal<Sale | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyProductId = signal<number | null>(null);
  readonly productFeedback = signal('');
  readonly actionItemId = signal<number | null>(null);
  readonly paymentOpen = signal(false);
  readonly cancelSaleOpen = signal(false);
  cancellationReason = '';
  readonly activeItems = computed(() => activeSaleItems(this.currentSale()));
  readonly canChangeItems = computed(() => saleCanChangeItems(this.currentSale()));
  readonly canClose = computed(() => saleCanClose(this.currentSale()));
  readonly openItemCount = computed(() => this.openSales().reduce((total, sale) => total + this.saleItemQuantity(sale), 0));
  readonly openReceivable = computed(() => this.openSales().reduce((total, sale) => total + sale.remainingAmount, 0));
  readonly openAverageTicket = computed(() => this.openSales().length
    ? this.openSales().reduce((total, sale) => total + sale.finalAmount, 0) / this.openSales().length
    : 0);
  private productFeedbackTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => this.load(Number(params.get('saleId')) || undefined));
  }

  ngOnDestroy(): void {
    if (this.productFeedbackTimer) clearTimeout(this.productFeedbackTimer);
  }

  load(saleId?: number): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      products: this.productApi.getAll(),
      sales: this.api.list('OPEN', 'COUNTER'),
      current: saleId ? this.api.get(saleId) : of(null),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ products, sales, current }) => {
        this.products.set(products);
        this.openSales.set(sales);
        this.currentSale.set(current);
      },
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  newSale(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.api.open(this.openRequest()).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (sale) => {
        this.currentSale.set(sale);
        this.openSales.update((items) => [...items, sale]);
        this.router.navigate(['/balcao', sale.id]);
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  resume(sale: Sale): void {
    this.router.navigate(['/balcao', sale.id]);
  }

  addProduct(request: AddSaleItemRequest): void {
    if (this.saving() || this.busyProductId()) return;
    const sale = this.currentSale();

    if (!sale) {
      this.busyProductId.set(request.productId);
      this.api.open(this.openRequest()).pipe(
        tap((opened) => {
          this.currentSale.set(opened);
          this.openSales.update((items) => [...items.filter((item) => item.id !== opened.id), opened]);
          this.router.navigate(['/balcao', opened.id]);
        }),
        switchMap((opened) => this.api.addItem(opened.id, request)),
        finalize(() => this.busyProductId.set(null)),
      ).subscribe({
        next: (updated) => {
          this.currentSale.set(updated);
          this.openSales.update((items) => [...items.filter((item) => item.id !== updated.id), updated]);
          this.showProductFeedback(request.productId);
        },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
      return;
    }

    if (!this.canChangeItems()) return;
    const matching = this.activeItems().find((item) => itemMatchesRequest(item, request));
    if (matching) {
      this.changeQuantity(matching, matching.quantity + request.quantity, true);
      return;
    }

    this.busyProductId.set(request.productId);
    this.api.addItem(sale.id, request).pipe(finalize(() => this.busyProductId.set(null))).subscribe({
      next: (updated) => {
        this.currentSale.set(updated);
        this.showProductFeedback(request.productId);
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  changeQuantity(item: SaleItem, quantity: number, fromCatalog = false): void {
    const sale = this.currentSale();
    if (!sale || !this.canChangeItems() || quantity < 1) return;

    this.actionItemId.set(item.id);
    this.api.updateItemQuantity(sale.id, item.id, { quantity }).pipe(
      finalize(() => this.actionItemId.set(null)),
    ).subscribe({
      next: (updated) => {
        this.currentSale.set(updated);
        if (fromCatalog) this.showProductFeedback(item.productId);
        else this.feedback.success('Quantidade atualizada.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  removeItem(item: SaleItem): void {
    const sale = this.currentSale();
    if (!sale || !this.canChangeItems() || this.actionItemId() != null) return;

    this.actionItemId.set(item.id);
    this.api.removeItem(sale.id, item.id).pipe(
      finalize(() => this.actionItemId.set(null)),
    ).subscribe({
      next: (updated) => {
        this.currentSale.set(updated);
        this.openSales.update((items) => [updated, ...items.filter((current) => current.id !== updated.id)]);
        this.feedback.success('Item removido da venda.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  quickPay(method: PaymentMethod): void {
    const sale = this.currentSale();
    if (!sale || sale.remainingAmount <= 0 || this.saving()) return;

    this.saving.set(true);
    this.api.pay(sale.id, { method, amount: sale.remainingAmount }).pipe(
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: (updated) => this.handlePayment(updated),
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  paymentCompleted(sale: Sale): void {
    this.paymentOpen.set(false);
    this.handlePayment(sale);
  }

  finishZeroSale(): void {
    const sale = this.currentSale();
    if (!sale || !this.canClose() || sale.finalAmount !== 0 || this.saving()) return;

    this.saving.set(true);
    this.api.close(sale.id).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => this.completeSale('Venda finalizada.'),
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  openSaleCancellation(): void {
    this.cancellationReason = '';
    this.cancelSaleOpen.set(true);
  }

  cancelSale(): void {
    const sale = this.currentSale();
    if (!sale || !this.cancellationReason.trim() || this.saving()) return;

    this.saving.set(true);
    this.api.cancel(sale.id, { reason: this.cancellationReason.trim() }).pipe(
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: () => {
        this.cancelSaleOpen.set(false);
        this.completeSale('Venda cancelada.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  optionSummary(item: SaleItem): string {
    return saleChoiceSummary(item.options);
  }

  saleItemQuantity(sale: Sale): number {
    return activeSaleItems(sale).reduce((total, item) => total + item.quantity, 0);
  }

  paymentState(sale: Sale): string {
    if (sale.remainingAmount === 0) return 'Pago';
    return sale.paidAmount > 0 ? 'Parcial' : 'Pendente';
  }

  nextAction(sale: Sale): string {
    if (this.saleItemQuantity(sale) === 0) return 'Adicionar produtos';
    if (sale.remainingAmount > 0) return sale.paidAmount > 0 ? 'Completar pagamento' : 'Receber';
    return 'Finalizar venda';
  }

  relativeTime(value: string): string {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
    if (!Number.isFinite(minutes)) return 'Horário indisponível';
    if (minutes < 60) return `há ${minutes} min`;
    return `há ${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  private handlePayment(sale: Sale): void {
    if (sale.status === 'CLOSED') this.completeSale('Venda concluída.');
    else {
      this.currentSale.set(sale);
      this.feedback.success(sale.remainingAmount > 0 ? 'Pagamento parcial registrado.' : 'Pagamento registrado.');
    }
  }

  private completeSale(message: string): void {
    const id = this.currentSale()?.id;
    this.currentSale.set(null);
    this.openSales.update((items) => items.filter((item) => item.id !== id));
    this.router.navigateByUrl('/balcao');
    this.activity.refresh();
    this.feedback.success(message);
  }

  private showProductFeedback(productId: number): void {
    if (this.productFeedbackTimer) clearTimeout(this.productFeedbackTimer);
    const productName = this.products().find((product) => product.id === productId)?.name ?? 'Produto';
    this.productFeedback.set(`${productName} adicionado`);
    this.productFeedbackTimer = setTimeout(() => this.productFeedback.set(''), 1800);
  }

  private openRequest() {
    return { type: 'COUNTER' as const, tableNumber: null, customerName: null, customerPhone: null, serviceFee: 0, discountAmount: 0 };
  }
}
