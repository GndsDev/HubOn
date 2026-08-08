import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin, of, switchMap, tap } from 'rxjs';
import { CounterActivityService } from '../../core/services/counter-activity.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { SalesApiService } from '../../core/services/sales-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PaymentDialogComponent } from '../../shared/components/payment-dialog/payment-dialog.component';
import { SaleProductPickerComponent } from '../../shared/components/sale-product-picker/sale-product-picker.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { Product } from '../../shared/models/product.model';
import { AddSaleItemRequest, PaymentMethod, Sale, SaleItem } from '../../shared/models/sale.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { activeSaleItems, itemMatchesRequest, saleCanChangeItems, saleCanClose } from '../../shared/util/sale-workflow';

@Component({
  selector: 'app-counter-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    PageHeaderComponent,
    PaymentDialogComponent,
    SaleProductPickerComponent,
    AccessibleDialogDirective,
  ],
  template: `
    <app-page-header
      kicker="Venda rápida"
      title="Balcão"
      description="Adicione produtos, receba e siga para a próxima venda."
    >
      <div page-actions class="page-header-actions">
        <button type="button" class="secondary-button" (click)="newSale()" [disabled]="saving()">
          <i class="pi pi-plus"></i>
          Nova venda
        </button>
      </div>
    </app-page-header>

    @if (openSales().length > 1 || (openSales().length === 1 && currentSale()?.id !== openSales()[0].id)) {
      <nav class="active-counter-sales" aria-label="Vendas em andamento">
        <span>Em andamento</span>
        @for (sale of openSales(); track sale.id) {
          <button
            type="button"
            [class.active]="currentSale()?.id === sale.id"
            (click)="resume(sale)"
          >
            Venda #{{ sale.id }}
            <small>{{ currency(sale.finalAmount) }}</small>
          </button>
        }
      </nav>
    }

    @if (loading()) {
      <div class="loading-grid">
        <div class="loading-row"></div>
        <div class="loading-row"></div>
        <div class="loading-row"></div>
      </div>
    } @else if (error()) {
      <div class="error-panel" role="alert">
        <i class="pi pi-exclamation-triangle"></i>
        <div>
          <strong>Não foi possível carregar o balcão</strong>
          <p>{{ error() }}</p>
        </div>
        <button type="button" class="ghost-button" (click)="load()">Tentar novamente</button>
      </div>
    } @else {
      <div class="counter-workspace">
        <section class="counter-catalog-panel" aria-label="Catálogo">
          <header class="workspace-panel-header">
            <div>
              <span>Catálogo</span>
              <strong>Produtos para venda</strong>
            </div>
          </header>

          <app-sale-product-picker
            [products]="products()"
            [disabled]="Boolean(currentSale()) && !canChangeItems()"
            [busyProductId]="busyProductId()"
            (addItem)="addProduct($event)"
          />
        </section>

        <aside class="counter-sale-panel" aria-label="Venda atual">
          @if (currentSale(); as sale) {
            <header class="workspace-panel-header">
              <div>
                <span>Venda atual</span>
                <strong>Venda #{{ sale.id }}</strong>
              </div>
              @if (sale.payments.length > 0) {
                <span class="locked-label">
                  <i class="pi pi-lock"></i>
                  Itens bloqueados
                </span>
              }
            </header>

            <div class="sale-item-list">
              @for (item of activeItems(); track item.id) {
                <article class="sale-line">
                  <div class="sale-line-copy">
                    <strong>{{ item.productName }}</strong>
                    @if (optionSummary(item)) {
                      <small>{{ optionSummary(item) }}</small>
                    }
                    @if (item.notes) {
                      <small>{{ item.notes }}</small>
                    }
                  </div>

                  <div class="quantity-control">
                    <button
                      type="button"
                      aria-label="Diminuir quantidade"
                      (click)="changeQuantity(item, item.quantity - 1)"
                      [disabled]="!canChangeItems() || item.quantity <= 1 || actionItemId() === item.id"
                    >
                      <i class="pi pi-minus"></i>
                    </button>
                    <b>{{ item.quantity }}</b>
                    <button
                      type="button"
                      aria-label="Aumentar quantidade"
                      (click)="changeQuantity(item, item.quantity + 1)"
                      [disabled]="!canChangeItems() || actionItemId() === item.id"
                    >
                      <i class="pi pi-plus"></i>
                    </button>
                  </div>

                  <strong class="line-total">{{ currency(item.subtotal) }}</strong>

                  @if (canChangeItems()) {
                    <button
                      type="button"
                      class="icon-button danger-icon"
                      title="Cancelar item"
                      [attr.aria-label]="'Cancelar ' + item.productName"
                      (click)="openItemCancellation(item)"
                    >
                      <i class="pi pi-trash"></i>
                    </button>
                  }
                </article>
              } @empty {
                <app-empty-state
                  icon="pi pi-shopping-bag"
                  title="Venda vazia"
                  description="Clique em um produto para começar."
                />
              }
            </div>

            <div class="counter-total">
              <span>Total</span>
              <strong>{{ currency(sale.finalAmount) }}</strong>
              @if (sale.paidAmount > 0) {
                <small>Pago {{ currency(sale.paidAmount) }} · Restante {{ currency(sale.remainingAmount) }}</small>
              }
            </div>

            @if (sale.status === 'OPEN' && activeItems().length > 0 && sale.remainingAmount > 0) {
              <div class="quick-pay">
                <button type="button" (click)="quickPay('PIX')" [disabled]="saving()">
                  <i class="pi pi-qrcode"></i>
                  PIX
                </button>
                <button type="button" (click)="quickPay('CASH')" [disabled]="saving()">
                  <i class="pi pi-money-bill"></i>
                  Dinheiro
                </button>
                <button type="button" (click)="quickPay('DEBIT_CARD')" [disabled]="saving()">
                  <i class="pi pi-credit-card"></i>
                  Débito
                </button>
                <button type="button" (click)="quickPay('CREDIT_CARD')" [disabled]="saving()">
                  <i class="pi pi-credit-card"></i>
                  Crédito
                </button>
              </div>

              <button type="button" class="ghost-button full-action" (click)="paymentOpen.set(true)" [disabled]="saving()">
                <i class="pi pi-wallet"></i>
                Pagamento parcial ou outro
              </button>
            }

            @if (sale.status === 'OPEN' && canClose()) {
              <button type="button" class="success-button full-action" (click)="finishZeroSale()" [disabled]="saving()">
                <i class="pi pi-check"></i>
                Finalizar venda
              </button>
            }

            @if (sale.status === 'OPEN' && sale.payments.length === 0) {
              <button type="button" class="text-danger-button" (click)="openSaleCancellation()">Cancelar venda</button>
            }
          } @else {
            <app-empty-state
              icon="pi pi-shopping-bag"
              title="Pronto para vender"
              description="Clique em um produto. A venda será aberta automaticamente."
            />
          }
        </aside>
      </div>
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

    @if (cancelItemTarget(); as item) {
      <div class="modal-backdrop">
        <form
          class="modal-panel compact"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="counter-cancel-item-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="cancelItemTarget.set(null)"
          (ngSubmit)="cancelItem(item)"
        >
          <div class="modal-header">
            <div class="modal-heading">
              <span class="modal-eyebrow">Cancelar item</span>
              <h2 id="counter-cancel-item-title">{{ item.productName }}</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar cancelamento" (click)="cancelItemTarget.set(null)">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <label class="field">
              <span>Motivo</span>
              <textarea name="counterCancelReason" maxlength="500" [(ngModel)]="cancellationReason" required autofocus></textarea>
            </label>
          </div>
          <div class="modal-footer modal-actions">
            <button type="button" class="ghost-button" (click)="cancelItemTarget.set(null)">Voltar</button>
            <button type="submit" class="danger-button" [disabled]="saving() || !cancellationReason.trim()">Cancelar item</button>
          </div>
        </form>
      </div>
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
  styles: `
    .active-counter-sales {
      display: flex;
      align-items: center;
      gap: .45rem;
      overflow-x: auto;
    }

    .active-counter-sales > span {
      color: var(--color-text-muted);
      font-size: .8rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .active-counter-sales button {
      display: flex;
      flex: 0 0 auto;
      gap: .5rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-pill);
      background: var(--surface-control-bg);
      color: var(--color-text);
      cursor: pointer;
      padding: .45rem .7rem;
    }

    .active-counter-sales button.active {
      border-color: var(--border-interactive);
      background: var(--surface-selected-bg);
    }

    .active-counter-sales small {
      color: var(--color-text-muted);
    }

    .counter-workspace {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(22rem, 26rem);
      gap: 1rem;
      align-items: start;
    }

    .counter-catalog-panel,
    .counter-sale-panel {
      display: grid;
      gap: .9rem;
      min-width: 0;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--gradient-card), var(--surface-card-bg);
      box-shadow: var(--shadow-card);
      padding: 1rem;
    }

    .counter-sale-panel {
      position: sticky;
      top: 1rem;
      max-height: calc(100vh - 9rem);
    }

    .workspace-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .75rem;
      border-bottom: 1px solid var(--color-border-soft);
      padding-bottom: .75rem;
    }

    .workspace-panel-header div {
      display: grid;
      gap: .15rem;
    }

    .workspace-panel-header span,
    .locked-label {
      color: var(--color-text-muted);
      font-size: .75rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .workspace-panel-header strong {
      color: var(--color-text-strong);
    }

    .locked-label {
      display: inline-flex;
      align-items: center;
      gap: .35rem;
      color: var(--color-warning-text);
    }

    .sale-item-list {
      display: grid;
      gap: .45rem;
      min-height: 10rem;
      overflow: auto;
    }

    .sale-line {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto auto;
      align-items: center;
      gap: .55rem;
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-sm);
      background: var(--surface-row-bg);
      padding: .65rem;
    }

    .sale-line-copy {
      display: grid;
      gap: .12rem;
      min-width: 0;
    }

    .sale-line-copy small {
      overflow: hidden;
      color: var(--color-text-muted);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .quantity-control {
      display: grid;
      grid-template-columns: 1.8rem 1.8rem 1.8rem;
      align-items: center;
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-xs);
      overflow: hidden;
      text-align: center;
    }

    .quantity-control button {
      height: 1.8rem;
      border: 0;
      background: var(--surface-control-bg);
      color: var(--color-text);
      cursor: pointer;
    }

    .quantity-control b {
      color: var(--color-text-strong);
      font-size: .85rem;
    }

    .line-total {
      color: var(--color-text-strong);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .counter-total {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: end;
      border: 1px solid var(--border-interactive);
      border-radius: var(--radius-md);
      background: var(--surface-selected-bg);
      padding: .85rem;
    }

    .counter-total span,
    .counter-total small {
      color: var(--color-text-muted);
    }

    .counter-total strong {
      color: var(--color-value-accent);
      font-size: 1.6rem;
      font-variant-numeric: tabular-nums;
    }

    .counter-total small {
      grid-column: 1 / -1;
      margin-top: .2rem;
    }

    .quick-pay {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: .5rem;
    }

    .quick-pay button {
      display: flex;
      min-height: 2.8rem;
      align-items: center;
      justify-content: center;
      gap: .45rem;
      border: 1px solid var(--border-interactive);
      border-radius: var(--radius-control);
      background: var(--button-primary-bg);
      color: var(--button-primary-color);
      cursor: pointer;
      font: inherit;
      font-weight: 800;
    }

    .full-action {
      width: 100%;
      justify-content: center;
    }

    .text-danger-button {
      border: 0;
      background: transparent;
      color: var(--color-danger-text);
      cursor: pointer;
      font: inherit;
      font-weight: 800;
    }

    @media (max-width: 1100px) {
      .counter-workspace {
        grid-template-columns: 1fr;
      }

      .counter-sale-panel {
        position: static;
        max-height: none;
      }
    }

    @media (max-width: 620px) {
      .sale-line {
        grid-template-columns: 1fr auto;
      }

      .sale-line .quantity-control {
        grid-column: 1;
        justify-self: start;
      }
    }
  `,
})
export class CounterPageComponent implements OnInit {
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
  readonly actionItemId = signal<number | null>(null);
  readonly paymentOpen = signal(false);
  readonly cancelItemTarget = signal<SaleItem | null>(null);
  readonly cancelSaleOpen = signal(false);
  cancellationReason = '';
  readonly activeItems = computed(() => activeSaleItems(this.currentSale()));
  readonly canChangeItems = computed(() => saleCanChangeItems(this.currentSale()));
  readonly canClose = computed(() => saleCanClose(this.currentSale()));
  readonly Boolean = Boolean;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => this.load(Number(params.get('saleId')) || undefined));
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
          this.feedback.success('Produto adicionado.');
        },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
      return;
    }

    if (!this.canChangeItems()) return;
    const matching = this.activeItems().find((item) => itemMatchesRequest(item, request));
    if (matching) {
      this.changeQuantity(matching, matching.quantity + request.quantity);
      return;
    }

    this.busyProductId.set(request.productId);
    this.api.addItem(sale.id, request).pipe(finalize(() => this.busyProductId.set(null))).subscribe({
      next: (updated) => {
        this.currentSale.set(updated);
        this.feedback.success('Produto adicionado.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  changeQuantity(item: SaleItem, quantity: number): void {
    const sale = this.currentSale();
    if (!sale || !this.canChangeItems() || quantity < 1) return;

    this.actionItemId.set(item.id);
    this.api.updateItemQuantity(sale.id, item.id, { quantity }).pipe(
      finalize(() => this.actionItemId.set(null)),
    ).subscribe({
      next: (updated) => {
        this.currentSale.set(updated);
        this.feedback.success('Quantidade atualizada.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  openItemCancellation(item: SaleItem): void {
    this.cancellationReason = '';
    this.cancelItemTarget.set(item);
  }

  cancelItem(item: SaleItem): void {
    const sale = this.currentSale();
    if (!sale || !this.cancellationReason.trim() || this.saving()) return;

    this.saving.set(true);
    this.api.cancelItem(sale.id, item.id, { reason: this.cancellationReason.trim() }).pipe(
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: (updated) => {
        this.currentSale.set(updated);
        this.cancelItemTarget.set(null);
        this.feedback.success('Item cancelado.');
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
    return item.options.map((option) => option.optionName).join(', ');
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

  private openRequest() {
    return { type: 'COUNTER' as const, tableNumber: null, customerName: null, customerPhone: null, serviceFee: 0, discountAmount: 0 };
  }
}
