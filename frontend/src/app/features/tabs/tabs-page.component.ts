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
  imports: [CommonModule, FormsModule, RouterLink, EmptyStateComponent, PageHeaderComponent, PaymentDialogComponent, SaleProductPickerComponent, SectionCardComponent, StatusBadgeComponent, AccessibleDialogDirective],
  template: `
    <app-page-header
      kicker="Atendimento de mesas"
      title="Comandas"
      description="Abra, acompanhe, receba e feche comandas pelo numero da mesa."
    >
      <div page-actions class="page-header-actions">
        @if (currentSale()) {
          <a class="ghost-button" routerLink="/comandas"><i class="pi pi-arrow-left"></i>Voltar</a>
        }
        <button type="button" class="primary-button" [disabled]="saving()" (click)="openForm()">
          <i class="pi pi-plus"></i>Nova comanda
        </button>
      </div>
    </app-page-header>

    @if (!currentSale()) {
      <app-section-card eyebrow="Mesas" title="Comandas abertas">
        @if (loading()) {
          <div class="collection-grid">
            @for (item of [1, 2, 3, 4]; track item) {
              <div class="collection-card loading-card"></div>
            }
          </div>
        } @else if (error()) {
          <div class="error-panel" role="alert">
            <i class="pi pi-exclamation-triangle"></i>
            <div><strong>Nao foi possivel carregar</strong><p>{{ error() }}</p></div>
            <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button>
          </div>
        } @else if (openSales().length === 0) {
          <app-empty-state icon="pi pi-receipt" title="Nenhuma comanda aberta" description="Abra uma comanda pelo numero da mesa." />
        } @else {
          <div class="collection-grid">
            @for (sale of openSales(); track sale.id) {
              <a class="collection-card clickable collection-card-button" [routerLink]="['/comandas', sale.id]">
                <div class="collection-icon"><i class="pi pi-receipt"></i></div>
                <div class="collection-main">
                  <strong>Comanda #{{ sale.id }} · Mesa {{ sale.tableNumber ?? '-' }}</strong>
                  <span>Aberta por {{ sale.openedByUserName }}</span>
                  <small>{{ relativeTime(sale.openedAt) }}</small>
                </div>
                <div class="collection-side">
                  <app-status-badge [label]="sale.paidAmount > 0 ? 'Parcial' : 'Aberta'" [tone]="sale.paidAmount > 0 ? 'info' : 'warning'" />
                  <b>{{ currency(sale.finalAmount) }}</b>
                  <small>{{ sale.remainingAmount > 0 ? 'Atender mesa' : 'Conferir fechamento' }}</small>
                </div>
              </a>
            }
          </div>
        }
      </app-section-card>
    } @else if (currentSale(); as sale) {
      <app-section-card eyebrow="Detalhe" [title]="saleTitle(sale)">
        @if (loading()) {
          <div class="loading-grid"><div class="loading-row"></div><div class="loading-row"></div><div class="loading-row"></div></div>
        } @else if (error()) {
          <div class="error-panel" role="alert">
            <i class="pi pi-exclamation-triangle"></i>
            <div><strong>Nao foi possivel carregar a comanda</strong><p>{{ error() }}</p></div>
            <button type="button" class="ghost-button" (click)="load(sale.id)"><i class="pi pi-refresh"></i>Tentar novamente</button>
          </div>
        } @else {
          <div class="detail-grid tab-detail-summary">
            <div><span>Comanda</span><strong>#{{ sale.id }}</strong></div>
            <div><span>Mesa</span><strong>{{ sale.tableNumber ?? '-' }}</strong></div>
            <div><span>Abertura</span><strong>{{ relativeTime(sale.openedAt) }}</strong></div>
            <div><span>Total</span><strong>{{ currency(sale.finalAmount) }}</strong></div>
            <div><span>Pago</span><strong>{{ currency(sale.paidAmount) }}</strong></div>
            <div><span>Restante</span><strong>{{ currency(sale.remainingAmount) }}</strong></div>
          </div>

          <div class="sale-workspace">
            <section class="sale-catalog-panel">
              <app-sale-product-picker [products]="products()" [disabled]="!canChangeItems()" [busyProductId]="busyProductId()" (addItem)="addProduct($event)" />
            </section>
            <aside class="sale-summary-panel">
              <header>
                <div><span>Itens atuais</span><strong>{{ activeItems().length }} lancamento{{ activeItems().length === 1 ? '' : 's' }}</strong></div>
                @if (sale.payments.length > 0) { <app-status-badge label="Itens bloqueados" tone="warning" /> }
              </header>
              <div class="sale-item-list">
                @for (item of activeItems(); track item.id) {
                  <article class="sale-line">
                    <div class="sale-line-copy">
                      <strong>{{ item.productName }}</strong>
                      @if (optionSummary(item)) { <small>{{ optionSummary(item) }}</small> }
                      @if (item.notes) { <small>{{ item.notes }}</small> }
                    </div>
                    <div class="quantity-control">
                      <button type="button" aria-label="Diminuir quantidade" (click)="changeQuantity(item, item.quantity - 1)" [disabled]="!canChangeItems() || actionItemId() === item.id"><i class="pi pi-minus"></i></button>
                      <b>{{ item.quantity }}</b>
                      <button type="button" aria-label="Aumentar quantidade" (click)="changeQuantity(item, item.quantity + 1)" [disabled]="!canChangeItems() || actionItemId() === item.id"><i class="pi pi-plus"></i></button>
                    </div>
                    <strong>{{ currency(item.subtotal) }}</strong>
                    @if (canChangeItems()) {
                      <button type="button" class="icon-button danger-icon" title="Cancelar item" [attr.aria-label]="'Cancelar ' + item.productName" (click)="openItemCancellation(item)"><i class="pi pi-trash"></i></button>
                    }
                  </article>
                } @empty {
                  <app-empty-state icon="pi pi-receipt" title="Comanda vazia" description="Clique em um produto para adicionar." />
                }
              </div>
              <div class="sale-totals">
                <div><span>Subtotal</span><strong>{{ currency(sale.subtotal) }}</strong></div>
                <div><span>Taxa</span><strong>{{ currency(sale.serviceFee) }}</strong></div>
                <div><span>Desconto</span><strong>{{ currency(sale.discountAmount) }}</strong></div>
                <div class="total"><span>Total</span><strong>{{ currency(sale.finalAmount) }}</strong></div>
                <div><span>Pago</span><strong>{{ currency(sale.paidAmount) }}</strong></div>
                <div class="remaining"><span>Restante</span><strong>{{ currency(sale.remainingAmount) }}</strong></div>
              </div>
              <div class="sale-actions">
                @if (sale.remainingAmount > 0 && activeItems().length > 0) {
                  <button type="button" class="primary-button" (click)="paymentOpen.set(true)"><i class="pi pi-wallet"></i>Receber</button>
                }
                @if (canClose()) {
                  <button type="button" class="success-button" (click)="closeSale()" [disabled]="saving()"><i class="pi pi-check"></i>{{ saving() ? 'Fechando...' : 'Fechar comanda' }}</button>
                }
                @if (sale.status === 'OPEN' && sale.payments.length === 0) {
                  <button type="button" class="text-danger-button" (click)="openSaleCancellation()">Cancelar comanda</button>
                }
              </div>
            </aside>
          </div>
        }
      </app-section-card>
    }

    @if (formOpen()) {
      <div class="modal-backdrop" (click)="formOpen.set(false)">
        <form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="tab-form-dialog-title" [dialogCloseDisabled]="saving()" (dialogClose)="formOpen.set(false)" (click)="$event.stopPropagation()" (ngSubmit)="create()">
          <div class="modal-header">
            <div class="modal-heading"><span class="modal-eyebrow">Mesa</span><h2 id="tab-form-dialog-title">Nova comanda</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" [disabled]="saving()" (click)="formOpen.set(false)"><i class="pi pi-times"></i></button>
          </div>
          <div class="modal-body">
            <label class="field full"><span>Numero da mesa</span><input name="tableNumber" type="number" min="1" step="1" [(ngModel)]="form.tableNumber" required autofocus /></label>
          </div>
          <div class="modal-footer modal-actions">
            <button type="button" class="ghost-button" [disabled]="saving()" (click)="formOpen.set(false)">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-receipt"></i>{{ saving() ? 'Abrindo...' : 'Abrir comanda' }}</button>
          </div>
        </form>
      </div>
    }

    @if (paymentOpen() && currentSale(); as sale) {
      <app-payment-dialog [saleId]="sale.id" [originLabel]="tableTitle(sale)" [totalAmount]="sale.finalAmount" [paidAmount]="sale.paidAmount" [remainingAmount]="sale.remainingAmount" (completed)="paymentCompleted($event)" (dismissed)="paymentOpen.set(false)" />
    }

    @if (cancelItemTarget(); as item) {
      <div class="modal-backdrop"><form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="cancel-item-title" [dialogCloseDisabled]="saving()" (dialogClose)="cancelItemTarget.set(null)" (ngSubmit)="cancelItem(item)"><div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Cancelar item</span><h2 id="cancel-item-title">{{ item.productName }}</h2></div><button type="button" class="icon-button" aria-label="Fechar cancelamento" (click)="cancelItemTarget.set(null)"><i class="pi pi-times"></i></button></div><div class="modal-body"><label class="field"><span>Motivo</span><textarea name="cancelReason" maxlength="500" [(ngModel)]="cancellationReason" required autofocus></textarea></label></div><div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="cancelItemTarget.set(null)">Voltar</button><button type="submit" class="danger-button" [disabled]="saving() || !cancellationReason.trim()">Cancelar item</button></div></form></div>
    }

    @if (cancelSaleOpen()) {
      <div class="modal-backdrop"><form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="cancel-sale-title" [dialogCloseDisabled]="saving()" (dialogClose)="cancelSaleOpen.set(false)" (ngSubmit)="cancelSale()"><div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Comanda</span><h2 id="cancel-sale-title">Cancelar comanda</h2></div><button type="button" class="icon-button" aria-label="Fechar cancelamento" (click)="cancelSaleOpen.set(false)"><i class="pi pi-times"></i></button></div><div class="modal-body"><label class="field"><span>Motivo</span><textarea name="cancelSaleReason" maxlength="500" [(ngModel)]="cancellationReason" required autofocus></textarea></label></div><div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="cancelSaleOpen.set(false)">Voltar</button><button type="submit" class="danger-button" [disabled]="saving() || !cancellationReason.trim()">Cancelar comanda</button></div></form></div>
    }
  `,
  styles: `
    .collection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); gap: .75rem; }
    .collection-card { min-height: 7rem; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: .85rem; align-items: center; padding: 1rem; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-raised); color: var(--text-primary); text-decoration: none; }
    .collection-card.clickable { cursor: pointer; }
    .collection-icon { width: 2.5rem; height: 2.5rem; display: grid; place-items: center; border-radius: 6px; background: var(--surface-panel); color: var(--primary); }
    .collection-main, .collection-side { display: grid; gap: .18rem; }
    .collection-main { min-width: 0; }
    .collection-main span, .collection-main small, .collection-side small { color: var(--text-muted); }
    .collection-side { justify-items: end; text-align: right; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: .65rem; margin-bottom: 1rem; }
    .detail-grid > div { display: grid; gap: .2rem; padding: .75rem; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-raised); }
    .detail-grid span { color: var(--text-muted); font-size: .78rem; }
    .sale-workspace { display: grid; grid-template-columns: minmax(0, 1fr) minmax(21rem, 25rem); gap: 1rem; align-items: start; }
    .sale-catalog-panel, .sale-summary-panel { border: 1px solid var(--border-subtle); background: var(--surface-panel); border-radius: 6px; padding: 1rem; }
    .sale-summary-panel { position: sticky; top: 1rem; display: grid; gap: .8rem; max-height: calc(100vh - 9rem); }
    .sale-summary-panel > header { display: flex; justify-content: space-between; align-items: center; gap: .5rem; }
    .sale-summary-panel > header div { display: grid; }
    .sale-item-list { display: grid; gap: .4rem; overflow: auto; }
    .sale-line { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: .55rem; padding: .65rem 0; border-bottom: 1px solid var(--border-subtle); }
    .sale-line-copy { min-width: 0; display: grid; gap: .1rem; }
    .sale-line-copy small { color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .quantity-control { display: grid; grid-template-columns: 1.8rem 1.8rem 1.8rem; align-items: center; text-align: center; }
    .quantity-control button { height: 1.8rem; border: 1px solid var(--border-subtle); background: var(--surface-raised); color: var(--text-primary); cursor: pointer; }
    .sale-totals { display: grid; gap: .35rem; padding-top: .5rem; border-top: 1px solid var(--border-subtle); }
    .sale-totals > div { display: flex; justify-content: space-between; }
    .sale-totals .total { font-size: 1.05rem; padding-top: .4rem; }
    .sale-totals .remaining { color: var(--primary); }
    .sale-actions { display: grid; gap: .5rem; }
    .sale-actions button { justify-content: center; }
    .text-danger-button { border: 0; background: transparent; color: var(--danger-text); cursor: pointer; }
    @media (max-width: 960px) { .sale-workspace { grid-template-columns: 1fr; } .sale-summary-panel { position: static; max-height: none; } }
    @media (max-width: 620px) { .collection-card { grid-template-columns: auto 1fr; } .collection-side { grid-column: 1 / -1; justify-items: start; text-align: left; } .sale-line { grid-template-columns: 1fr auto; } .sale-line .quantity-control { grid-column: 1; } }
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

  ngOnInit(): void { this.route.paramMap.subscribe((params) => this.load(Number(params.get('saleId')) || undefined)); }

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
          this.error.set('A venda informada nao e uma comanda de mesa.');
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
      this.feedback.error('Informe um numero de mesa valido.');
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
    const sale = this.currentSale(); if (!sale || !this.canChangeItems()) return;
    const matching = this.activeItems().find((item) => itemMatchesRequest(item, request));
    if (matching) { this.changeQuantity(matching, matching.quantity + request.quantity); return; }
    this.busyProductId.set(request.productId);
    this.api.addItem(sale.id, request).pipe(finalize(() => this.busyProductId.set(null))).subscribe({
      next: (updated) => this.applySale(updated, 'Produto adicionado.'),
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  changeQuantity(item: SaleItem, quantity: number): void {
    const sale = this.currentSale(); if (!sale || !this.canChangeItems() || quantity < 0) return;
    this.actionItemId.set(item.id);
    this.api.cancelItem(sale.id, item.id, { reason: 'Ajuste de quantidade' }).pipe(
      switchMap((cancelled) => quantity === 0 ? of(cancelled) : this.api.addItem(sale.id, { productId: item.productId, quantity, notes: item.notes, optionIds: item.options.map((option) => option.productOptionId) })),
      finalize(() => this.actionItemId.set(null)),
    ).subscribe({
      next: (updated) => this.applySale(updated, quantity === 0 ? 'Item removido.' : 'Quantidade atualizada.'),
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  openItemCancellation(item: SaleItem): void { this.cancellationReason = ''; this.cancelItemTarget.set(item); }

  cancelItem(item: SaleItem): void {
    const sale = this.currentSale(); if (!sale || !this.cancellationReason.trim() || this.saving()) return;
    this.saving.set(true);
    this.api.cancelItem(sale.id, item.id, { reason: this.cancellationReason.trim() }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (updated) => {
        this.cancelItemTarget.set(null);
        this.applySale(updated, 'Item cancelado.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  paymentCompleted(sale: Sale): void { this.paymentOpen.set(false); this.applySale(sale); }

  closeSale(): void {
    const sale = this.currentSale(); if (!sale || !this.canClose() || this.saving()) return;
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

  openSaleCancellation(): void { this.cancellationReason = ''; this.cancelSaleOpen.set(true); }

  cancelSale(): void {
    const sale = this.currentSale(); if (!sale || !this.cancellationReason.trim() || this.saving()) return;
    this.saving.set(true);
    this.api.cancel(sale.id, { reason: this.cancellationReason.trim() }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.cancelSaleOpen.set(false);
        this.feedback.success('Comanda cancelada.');
        this.openSales.update((items) => items.filter((item) => item.id !== sale.id));
        this.router.navigateByUrl('/comandas');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  saleTitle(sale: Sale): string { return `Comanda #${sale.id} · Mesa ${sale.tableNumber ?? '-'}`; }
  tableTitle(sale: Sale): string { return `Mesa ${sale.tableNumber ?? '-'}`; }
  optionSummary(item: SaleItem): string { return item.options.map((option) => option.optionName).join(', '); }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  relativeTime(value: string): string {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
    if (!Number.isFinite(minutes)) return 'Horario indisponivel';
    if (minutes < 60) return `ha ${minutes} min`;
    return `ha ${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }

  private applySale(updated: Sale, message?: string): void {
    this.currentSale.set(updated);
    if (updated.status === 'OPEN') {
      this.openSales.update((items) => [updated, ...items.filter((item) => item.id !== updated.id)]);
    }
    if (message) this.feedback.success(message);
  }
}
