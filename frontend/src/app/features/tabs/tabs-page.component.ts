import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, of, switchMap } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { SalesApiService } from '../../core/services/sales-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PaymentDialogComponent } from '../../shared/components/payment-dialog/payment-dialog.component';
import { SaleProductPickerComponent } from '../../shared/components/sale-product-picker/sale-product-picker.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { Product } from '../../shared/models/product.model';
import { AddSaleItemRequest, Sale, SaleItem } from '../../shared/models/sale.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { activeSaleItems, itemMatchesRequest, saleCanChangeItems, saleCanClose } from '../../shared/util/sale-workflow';

@Component({
  selector: 'app-tabs-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    EmptyStateComponent,
    PageHeaderComponent,
    PaymentDialogComponent,
    SaleProductPickerComponent,
    SectionCardComponent,
    StatusBadgeComponent,
    AccessibleDialogDirective,
  ],
  template: `
    <app-page-header
      kicker="Atendimento"
      title="Comandas"
      description="Abra, acompanhe, receba e feche comandas pelo número da mesa."
    >
      <div page-actions class="page-header-actions">
        @if (currentSale()) {
          <a class="ghost-button" routerLink="/comandas">
            <i class="pi pi-arrow-left"></i>
            Voltar
          </a>
        }

        <button
          type="button"
          class="primary-button"
          [disabled]="saving()"
          (click)="openForm()"
        >
          <i class="pi pi-plus"></i>
          Nova comanda
        </button>
      </div>
    </app-page-header>

    @if (!currentSale()) {
      <app-section-card eyebrow="Atendimento" title="Comandas abertas">
        @if (loading()) {
          <div class="tab-card-grid">
            @for (item of [1, 2, 3, 4]; track item) {
              <div class="tab-card loading-card"></div>
            }
          </div>
        } @else if (error()) {
          <div class="error-panel" role="alert">
            <i class="pi pi-exclamation-triangle"></i>
            <div>
              <strong>Não foi possível carregar</strong>
              <p>{{ error() }}</p>
            </div>
            <button type="button" class="ghost-button" (click)="load()">
              <i class="pi pi-refresh"></i>
              Tentar novamente
            </button>
          </div>
        } @else if (openSales().length === 0) {
          <app-empty-state
            icon="pi pi-receipt"
            title="Nenhuma comanda aberta"
            description="Abra uma comanda pelo número da mesa."
          />
        } @else {
          <div class="tab-card-grid">
            @for (sale of openSales(); track sale.id) {
              <a class="tab-card clickable" [routerLink]="['/comandas', sale.id]">
                <div class="tab-card-icon">
                  <i class="pi pi-receipt"></i>
                </div>

                <div class="tab-card-main">
                  <span>Comanda #{{ sale.id }}</span>
                  <strong>Mesa {{ sale.tableNumber ?? '-' }}</strong>
                  <small>Aberta por {{ sale.openedByUserName }}</small>
                  <small>{{ relativeTime(sale.openedAt) }}</small>
                </div>

                <div class="tab-card-side">
                  <app-status-badge
                    [label]="sale.paidAmount > 0 ? 'Parcial' : 'Aberta'"
                    [tone]="sale.paidAmount > 0 ? 'info' : 'warning'"
                  />
                  <strong>{{ currency(sale.finalAmount) }}</strong>
                  <small>{{ sale.remainingAmount > 0 ? 'Atender mesa' : 'Conferir fechamento' }}</small>
                </div>
              </a>
            }
          </div>
        }
      </app-section-card>
    } @else if (currentSale(); as sale) {
      <app-section-card eyebrow="Comanda" [title]="saleTitle(sale)">
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
              <strong>Não foi possível carregar a comanda</strong>
              <p>{{ error() }}</p>
            </div>
            <button type="button" class="ghost-button" (click)="load(sale.id)">
              <i class="pi pi-refresh"></i>
              Tentar novamente
            </button>
          </div>
        } @else {
          <div class="detail-grid tab-detail-summary">
            <div>
              <span>Comanda</span>
              <strong>#{{ sale.id }}</strong>
            </div>
            <div>
              <span>Mesa</span>
              <strong>{{ sale.tableNumber ?? '-' }}</strong>
            </div>
            <div>
              <span>Abertura</span>
              <strong>{{ relativeTime(sale.openedAt) }}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{{ currency(sale.finalAmount) }}</strong>
            </div>
            <div>
              <span>Pago</span>
              <strong>{{ currency(sale.paidAmount) }}</strong>
            </div>
            <div class="summary-highlight">
              <span>Restante</span>
              <strong>{{ currency(sale.remainingAmount) }}</strong>
            </div>
          </div>

          <div class="sale-workspace">
            <section class="sale-catalog-panel" aria-label="Catálogo">
              <header class="workspace-panel-header">
                <div>
                  <span>Catálogo</span>
                  <strong>Produtos</strong>
                </div>
                @if (!canChangeItems()) {
                  <app-status-badge label="Itens bloqueados" tone="warning" />
                }
              </header>

              <app-sale-product-picker
                [products]="products()"
                [disabled]="!canChangeItems()"
                [busyProductId]="busyProductId()"
                (addItem)="addProduct($event)"
              />
            </section>

            <aside class="sale-summary-panel" aria-label="Resumo da comanda">
              <header class="workspace-panel-header">
                <div>
                  <span>Resumo da comanda</span>
                  <strong>{{ activeItems().length }} item{{ activeItems().length === 1 ? '' : 's' }}</strong>
                </div>
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
                        [disabled]="!canChangeItems() || actionItemId() === item.id"
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
                    icon="pi pi-receipt"
                    title="Comanda vazia"
                    description="Clique em um produto para adicionar."
                  />
                }
              </div>

              <div class="sale-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>{{ currency(sale.subtotal) }}</strong>
                </div>
                <div>
                  <span>Taxa</span>
                  <strong>{{ currency(sale.serviceFee) }}</strong>
                </div>
                <div>
                  <span>Desconto</span>
                  <strong>{{ currency(sale.discountAmount) }}</strong>
                </div>
                <div class="total">
                  <span>Total</span>
                  <strong>{{ currency(sale.finalAmount) }}</strong>
                </div>
                <div>
                  <span>Pago</span>
                  <strong>{{ currency(sale.paidAmount) }}</strong>
                </div>
                <div class="remaining">
                  <span>Restante</span>
                  <strong>{{ currency(sale.remainingAmount) }}</strong>
                </div>
              </div>

              <div class="sale-actions">
                @if (sale.remainingAmount > 0 && activeItems().length > 0) {
                  <button type="button" class="primary-button" (click)="paymentOpen.set(true)">
                    <i class="pi pi-wallet"></i>
                    Receber
                  </button>
                }

                @if (canClose()) {
                  <button type="button" class="success-button" (click)="closeSale()" [disabled]="saving()">
                    <i class="pi pi-check"></i>
                    {{ saving() ? 'Fechando...' : 'Fechar comanda' }}
                  </button>
                }

                @if (sale.status === 'OPEN' && sale.payments.length === 0) {
                  <button type="button" class="text-danger-button" (click)="openSaleCancellation()">
                    Cancelar comanda
                  </button>
                }
              </div>
            </aside>
          </div>
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
            <div class="modal-heading">
              <span class="modal-eyebrow">Mesa</span>
              <h2 id="tab-form-dialog-title">Nova comanda</h2>
            </div>
            <button
              type="button"
              class="icon-button"
              aria-label="Fechar"
              [disabled]="saving()"
              (click)="formOpen.set(false)"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <label class="field full">
              <span>Número da mesa</span>
              <input
                name="tableNumber"
                type="number"
                min="1"
                step="1"
                [(ngModel)]="form.tableNumber"
                required
                autofocus
              />
            </label>
          </div>

          <div class="modal-footer modal-actions">
            <button type="button" class="ghost-button" [disabled]="saving()" (click)="formOpen.set(false)">
              Cancelar
            </button>
            <button type="submit" class="primary-button" [disabled]="saving()">
              <i class="pi pi-receipt"></i>
              {{ saving() ? 'Abrindo...' : 'Abrir comanda' }}
            </button>
          </div>
        </form>
      </div>
    }

    @if (paymentOpen() && currentSale(); as sale) {
      <app-payment-dialog
        [saleId]="sale.id"
        [originLabel]="tableTitle(sale)"
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
          aria-labelledby="cancel-item-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="cancelItemTarget.set(null)"
          (ngSubmit)="cancelItem(item)"
        >
          <div class="modal-header">
            <div class="modal-heading">
              <span class="modal-eyebrow">Cancelar item</span>
              <h2 id="cancel-item-title">{{ item.productName }}</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar cancelamento" (click)="cancelItemTarget.set(null)">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <label class="field">
              <span>Motivo</span>
              <textarea name="cancelReason" maxlength="500" [(ngModel)]="cancellationReason" required autofocus></textarea>
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
          aria-labelledby="cancel-sale-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="cancelSaleOpen.set(false)"
          (ngSubmit)="cancelSale()"
        >
          <div class="modal-header">
            <div class="modal-heading">
              <span class="modal-eyebrow">Comanda</span>
              <h2 id="cancel-sale-title">Cancelar comanda</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar cancelamento" (click)="cancelSaleOpen.set(false)">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <label class="field">
              <span>Motivo</span>
              <textarea name="cancelSaleReason" maxlength="500" [(ngModel)]="cancellationReason" required autofocus></textarea>
            </label>
          </div>

          <div class="modal-footer modal-actions">
            <button type="button" class="ghost-button" (click)="cancelSaleOpen.set(false)">Voltar</button>
            <button type="submit" class="danger-button" [disabled]="saving() || !cancellationReason.trim()">Cancelar comanda</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    .tab-card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
      gap: .85rem;
    }

    .tab-card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: .9rem;
      min-height: 8rem;
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-md);
      background: var(--gradient-card), var(--surface-row-bg);
      color: var(--color-text);
      box-shadow: var(--shadow-row);
      padding: 1rem;
      text-decoration: none;
      transition: border-color var(--duration-fast) ease, background var(--duration-fast) ease, transform var(--duration-fast) ease;
    }

    .tab-card:hover {
      border-color: var(--border-interactive);
      background: var(--surface-row-hover-bg);
      transform: translateY(-1px);
    }

    .tab-card-icon {
      display: grid;
      width: 2.75rem;
      height: 2.75rem;
      place-items: center;
      border: 1px solid var(--border-interactive);
      border-radius: var(--radius-sm);
      background: var(--surface-selected-bg);
      color: var(--color-icon-strong);
    }

    .tab-card-main,
    .tab-card-side {
      display: grid;
      gap: .25rem;
      min-width: 0;
    }

    .tab-card-main span,
    .tab-card-main small,
    .tab-card-side small {
      color: var(--color-text-muted);
    }

    .tab-card-main strong {
      color: var(--color-text-strong);
      font-size: 1.15rem;
    }

    .tab-card-side {
      justify-items: end;
      text-align: right;
    }

    .tab-card-side strong {
      color: var(--color-value-accent);
      font-size: 1.12rem;
      font-variant-numeric: tabular-nums;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
      gap: .65rem;
      margin-bottom: 1rem;
    }

    .detail-grid > div {
      display: grid;
      gap: .22rem;
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-sm);
      background: var(--surface-row-bg);
      padding: .75rem;
      box-shadow: var(--shadow-row);
    }

    .detail-grid span {
      color: var(--color-text-muted);
      font-size: .78rem;
      font-weight: 800;
    }

    .summary-highlight {
      border-color: var(--border-interactive) !important;
      background: var(--surface-selected-bg) !important;
    }

    @media (max-width: 680px) {
      .tab-card {
        grid-template-columns: auto 1fr;
      }

      .tab-card-side {
        grid-column: 1 / -1;
        justify-items: start;
        text-align: left;
      }

    }
  `,
})
export class TabsPageComponent implements OnInit {
  private readonly api = inject(SalesApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly openSales = signal<Sale[]>([]);
  readonly products = signal<Product[]>([]);
  readonly currentSale = signal<Sale | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyProductId = signal<number | null>(null);
  readonly actionItemId = signal<number | null>(null);
  readonly paymentOpen = signal(false);
  readonly cancelItemTarget = signal<SaleItem | null>(null);
  readonly cancelSaleOpen = signal(false);
  readonly formOpen = signal(false);
  form = { tableNumber: 1 };
  cancellationReason = '';
  readonly activeItems = computed(() => activeSaleItems(this.currentSale()));
  readonly canChangeItems = computed(() => saleCanChangeItems(this.currentSale()));
  readonly canClose = computed(() => saleCanClose(this.currentSale()));

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => this.load(Number(params.get('saleId')) || undefined));
  }

  load(saleId?: number): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      sales: this.api.list('OPEN', 'TABLE'),
      products: this.productApi.getAll(),
      current: saleId ? this.api.get(saleId) : of(null),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ sales, products, current }) => {
        this.openSales.set(sales.filter((sale) => sale.type === 'TABLE' && sale.status === 'OPEN'));
        this.products.set(products);
        if (current && current.type !== 'TABLE') {
          this.currentSale.set(null);
          this.error.set('A venda informada não é uma comanda de mesa.');
          return;
        }
        this.currentSale.set(current);
      },
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  openForm(): void {
    if (this.saving()) return;
    this.form = { tableNumber: 1 };
    this.formOpen.set(true);
  }

  create(): void {
    if (this.saving()) return;
    const tableNumber = Number(this.form.tableNumber);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
      this.feedback.error('Informe um número de mesa válido.');
      return;
    }

    this.saving.set(true);
    this.api.open({ type: 'TABLE', tableNumber, customerName: null, customerPhone: null, serviceFee: 0, discountAmount: 0 })
      .pipe(finalize(() => this.saving.set(false))).subscribe({
        next: (sale) => {
          this.formOpen.set(false);
          this.openSales.update((items) => [sale, ...items.filter((item) => item.id !== sale.id)]);
          this.feedback.success('Comanda aberta.');
          this.router.navigate(['/comandas', sale.id]);
        },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  addProduct(request: AddSaleItemRequest): void {
    const sale = this.currentSale();
    if (!sale || !this.canChangeItems()) return;

    const matching = this.activeItems().find((item) => itemMatchesRequest(item, request));
    if (matching) {
      this.changeQuantity(matching, matching.quantity + request.quantity);
      return;
    }

    this.busyProductId.set(request.productId);
    this.api.addItem(sale.id, request).pipe(finalize(() => this.busyProductId.set(null))).subscribe({
      next: (updated) => this.applySale(updated, 'Produto adicionado.'),
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  changeQuantity(item: SaleItem, quantity: number): void {
    const sale = this.currentSale();
    if (!sale || !this.canChangeItems() || quantity < 0) return;

    this.actionItemId.set(item.id);
    this.api.cancelItem(sale.id, item.id, { reason: 'Ajuste de quantidade' }).pipe(
      switchMap((cancelled) => quantity === 0
        ? of(cancelled)
        : this.api.addItem(sale.id, {
          productId: item.productId,
          quantity,
          notes: item.notes,
          optionIds: item.options.map((option) => option.productOptionId),
        }),
      ),
      finalize(() => this.actionItemId.set(null)),
    ).subscribe({
      next: (updated) => this.applySale(updated, quantity === 0 ? 'Item removido.' : 'Quantidade atualizada.'),
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
        this.cancelItemTarget.set(null);
        this.applySale(updated, 'Item cancelado.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  paymentCompleted(sale: Sale): void {
    this.paymentOpen.set(false);
    this.applySale(sale);
  }

  closeSale(): void {
    const sale = this.currentSale();
    if (!sale || !this.canClose() || this.saving()) return;

    this.saving.set(true);
    this.api.close(sale.id).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.feedback.success('Comanda fechada.');
        this.openSales.update((items) => items.filter((item) => item.id !== sale.id));
        this.router.navigateByUrl('/comandas');
      },
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
        this.feedback.success('Comanda cancelada.');
        this.openSales.update((items) => items.filter((item) => item.id !== sale.id));
        this.router.navigateByUrl('/comandas');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  saleTitle(sale: Sale): string {
    return `Comanda #${sale.id} · Mesa ${sale.tableNumber ?? '-'}`;
  }

  tableTitle(sale: Sale): string {
    return `Mesa ${sale.tableNumber ?? '-'}`;
  }

  optionSummary(item: SaleItem): string {
    return item.options.map((option) => option.optionName).join(', ');
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  relativeTime(value: string): string {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
    if (!Number.isFinite(minutes)) return 'Horário indisponível';
    if (minutes < 60) return `há ${minutes} min`;
    return `há ${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }

  private applySale(updated: Sale, message?: string): void {
    this.currentSale.set(updated);
    if (updated.status === 'OPEN') {
      this.openSales.update((items) => [updated, ...items.filter((item) => item.id !== updated.id)]);
    }
    if (message) this.feedback.success(message);
  }
}
