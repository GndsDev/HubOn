import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, of } from 'rxjs';
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
import { activeSaleItems, itemMatchesRequest, saleCanChangeItems, saleCanClose, saleChoiceSummary } from '../../shared/util/sale-workflow';

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
      kicker="Vendas abertas"
      title="Comandas"
      description="Abra e acompanhe comandas identificadas pelo número da mesa."
    >
      <div page-actions class="page-header-actions">
        @if (currentSale()) {
          <a class="ghost-button" routerLink="/comandas">
            <i class="pi pi-arrow-left"></i>
            Voltar
          </a>
        }

        <button type="button" class="primary-button" [disabled]="saving()" (click)="openForm()">
          <i class="pi pi-plus"></i>
          Nova comanda
        </button>
      </div>
    </app-page-header>

    @if (!currentSale()) {
      <app-section-card eyebrow="Operação" title="Comandas abertas">
        @if (loading()) {
          <div class="collection-grid">
            @for (item of [1, 2, 3, 4]; track item) {
              <div class="collection-card loading-card"></div>
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
          <div class="collection-grid">
            @for (sale of openSales(); track sale.id) {
              <a
                class="collection-card clickable collection-card-button"
                [routerLink]="['/comandas', sale.id]"
              >
                <div class="collection-icon">
                  <i class="pi pi-receipt"></i>
                </div>

                <div class="collection-main">
                  <strong>Comanda #{{ sale.id }} · Mesa {{ sale.tableNumber ?? '-' }}</strong>
                  <span>Aberta por {{ sale.openedByUserName }}</span>
                  <small>{{ relativeTime(sale.openedAt) }}</small>
                </div>

                <div class="collection-side">
                  <app-status-badge
                    [label]="sale.paidAmount > 0 ? 'Parcial' : 'Aberta'"
                    [tone]="sale.paidAmount > 0 ? 'info' : 'warning'"
                  />
                  <b>{{ currency(sale.finalAmount) }}</b>
                  <small>{{ sale.remainingAmount > 0 ? 'Continuar comanda' : 'Fechar comanda' }}</small>
                </div>
              </a>
            }
          </div>
        }
      </app-section-card>
    } @else if (currentSale(); as sale) {
      <app-section-card class="tab-detail-card" eyebrow="Detalhe" [title]="saleTitle(sale)">
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
          <div class="tab-detail-summary">
            <div class="detail-grid tab-context-summary">
              <div>
                <span>Comanda</span>
                <strong>#{{ sale.id }}</strong>
              </div>
              <div>
                <span>Número da mesa</span>
                <strong>{{ sale.tableNumber ?? '-' }}</strong>
              </div>
              <div>
                <span>Abertura</span>
                <strong>{{ relativeTime(sale.openedAt) }}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{{ sale.paidAmount > 0 ? 'Pagamento parcial' : 'Em andamento' }}</strong>
              </div>
            </div>

            <div class="detail-grid tab-financial-summary">
              <div class="financial-detail total">
                <span>Total</span>
                <strong>{{ currency(sale.finalAmount) }}</strong>
              </div>
              <div class="financial-detail paid">
                <span>Pago</span>
                <strong>{{ currency(sale.paidAmount) }}</strong>
              </div>
              <div class="financial-detail remaining">
                <span>Restante</span>
                <strong>{{ currency(sale.remainingAmount) }}</strong>
              </div>
            </div>
          </div>

          @if (!canChangeItems()) {
            <p class="order-state-note tab-wide-note">
              <i class="pi pi-lock"></i>
              A comanda possui pagamento e os itens estão bloqueados.
            </p>
          }

          <div class="split-actions tab-detail-toolbar">
            <button
              type="button"
              class="secondary-button"
              [class.active-toggle]="productPanelOpen()"
              [attr.aria-expanded]="productPanelOpen()"
              [disabled]="!canChangeItems() || saving()"
              (click)="productPanelOpen.set(!productPanelOpen())"
            >
              <i [class]="productPanelOpen() ? 'pi pi-chevron-up' : 'pi pi-plus'"></i>
              {{ productPanelOpen() ? 'Fechar cardápio' : 'Adicionar produtos' }}
            </button>

            <a class="ghost-button" routerLink="/historico">
              <i class="pi pi-history"></i>
              Ver histórico
            </a>
          </div>

          <article
            class="order-card tab-catalog-panel"
            [class.tab-catalog-panel-hidden]="!productPanelOpen() || !canChangeItems()"
            [attr.aria-hidden]="productPanelOpen() && canChangeItems() ? null : 'true'"
          >
            <div class="order-card-head">
              <div>
                <span>Cardápio</span>
                <strong>Escolha os produtos da comanda</strong>
              </div>
              <button type="button" class="icon-button" aria-label="Ocultar produtos" (click)="productPanelOpen.set(false)">
                <i class="pi pi-times"></i>
              </button>
            </div>

            <app-sale-product-picker
              [products]="products()"
              [disabled]="!canChangeItems()"
              [busyProductId]="busyProductId()"
              [confirmationMessage]="productFeedback()"
              confirmLabel="Adicionar à comanda"
              (addItem)="addProduct($event)"
            />
          </article>

          @if (activeItems().length === 0) {
            <app-empty-state
              icon="pi pi-shopping-cart"
              title="Comanda vazia"
              description="Adicione produtos ou cancele a comanda vazia."
            />
          } @else {
            <div class="order-list tab-order-list">
              <article class="order-card">
                <div class="order-card-head">
                  <div>
                    <span>Venda #{{ sale.id }}</span>
                    <strong>Itens da comanda</strong>
                  </div>
                  <app-status-badge
                    [label]="canChangeItems() ? 'Em atendimento' : 'Itens bloqueados'"
                    [tone]="canChangeItems() ? 'info' : 'warning'"
                  />
                </div>

                <div class="order-item-list detailed-order-items">
                  @for (item of activeItems(); track item.id) {
                    <div class="detailed-order-item">
                      <div>
                        <span>{{ item.quantity }}x {{ item.productName }}</span>
                        @if (optionSummary(item)) {
                          <small>{{ optionSummary(item) }}</small>
                        }
                        @if (item.notes) {
                          <small class="auxiliary-note">
                            <i class="pi pi-comment"></i>
                            {{ item.notes }}
                          </small>
                        }
                      </div>

                      <div class="order-item-side">
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
                          </div>
                        }

                        <b>{{ currency(item.subtotal) }}</b>

                        @if (canChangeItems()) {
                          <button
                            type="button"
                            class="text-action danger-text"
                            [disabled]="actionItemId() === item.id"
                            (click)="removeItem(item)"
                          >
                            <i class="pi pi-trash"></i>
                            Remover item
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>

                <div class="order-card-footer">
                  <strong>{{ currency(sale.finalAmount) }}</strong>
                  <span>{{ activeItems().length }} item{{ activeItems().length === 1 ? '' : 's' }} lançado{{ activeItems().length === 1 ? '' : 's' }}</span>
                </div>
              </article>
            </div>
          }

          <div class="tab-page-footer">
            @if (sale.payments.length === 0) {
              <button
                type="button"
                class="danger-button secondary-danger"
                [disabled]="saving()"
                (click)="openSaleCancellation()"
              >
                <i class="pi pi-times-circle"></i>
                Cancelar comanda
              </button>
            }

            @if (activeItems().length > 0 && sale.remainingAmount > 0) {
              <button type="button" class="primary-button" [disabled]="saving()" (click)="paymentOpen.set(true)">
                <i class="pi pi-wallet"></i>
                {{ sale.paidAmount > 0 ? 'Completar pagamento' : 'Receber' }}
              </button>
            }

            <button type="button" class="primary-button" [disabled]="!canClose() || saving()" (click)="closeSale()">
              <i class="pi pi-check-circle"></i>
              Fechar comanda
            </button>
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
              <span class="modal-eyebrow">Comanda</span>
              <h2 id="tab-form-dialog-title">Nova comanda</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar" [disabled]="saving()" (click)="formOpen.set(false)">
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
            <button type="button" class="ghost-button" [disabled]="saving()" (click)="formOpen.set(false)">Cancelar</button>
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
})
export class TabsPageComponent implements OnInit, OnDestroy {
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
  readonly productFeedback = signal('');
  readonly actionItemId = signal<number | null>(null);
  readonly paymentOpen = signal(false);
  readonly productPanelOpen = signal(false);
  readonly cancelSaleOpen = signal(false);
  readonly formOpen = signal(false);
  form = { tableNumber: 1 };
  cancellationReason = '';
  readonly activeItems = computed(() => activeSaleItems(this.currentSale()));
  readonly canChangeItems = computed(() => saleCanChangeItems(this.currentSale()));
  readonly canClose = computed(() => saleCanClose(this.currentSale()));
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
    this.productPanelOpen.set(false);
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
          this.error.set('A venda informada não é uma comanda.');
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
      this.changeQuantity(matching, matching.quantity + request.quantity, true);
      return;
    }

    this.busyProductId.set(request.productId);
    this.api.addItem(sale.id, request).pipe(finalize(() => this.busyProductId.set(null))).subscribe({
      next: (updated) => {
        this.applySale(updated);
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
        this.applySale(updated, fromCatalog ? undefined : 'Quantidade atualizada.');
        if (fromCatalog) this.showProductFeedback(item.productId);
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
      next: (updated) => this.applySale(updated, 'Item removido da comanda.'),
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
    return saleChoiceSummary(item.options);
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

  private showProductFeedback(productId: number): void {
    if (this.productFeedbackTimer) clearTimeout(this.productFeedbackTimer);
    const productName = this.products().find((product) => product.id === productId)?.name ?? 'Produto';
    this.productFeedback.set(`${productName} adicionado`);
    this.productFeedbackTimer = setTimeout(() => this.productFeedback.set(''), 1800);
  }
}
