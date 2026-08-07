import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, of, switchMap } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { SalesApiService } from '../../core/services/sales-api.service';
import { TableApiService } from '../../core/services/table-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PaymentDialogComponent } from '../../shared/components/payment-dialog/payment-dialog.component';
import { SaleProductPickerComponent } from '../../shared/components/sale-product-picker/sale-product-picker.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { Product } from '../../shared/models/product.model';
import { AddSaleItemRequest, Sale, SaleItem } from '../../shared/models/sale.model';
import { RestaurantTable, RestaurantTableRequest } from '../../shared/models/table.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { activeSaleItems, itemMatchesRequest, saleCanChangeItems, saleCanClose } from '../../shared/util/sale-workflow';

@Component({
  selector: 'app-tabs-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, EmptyStateComponent, PageHeaderComponent, PaymentDialogComponent, SaleProductPickerComponent, StatusBadgeComponent, AccessibleDialogDirective],
  template: `
    @if (!currentSale()) {
      <app-page-header kicker="Operação" title="Comandas" description="Abra uma mesa e registre os itens com poucos cliques.">
        <div page-actions class="page-header-actions"><button type="button" class="secondary-button" (click)="openTableManager()"><i class="pi pi-cog"></i>Gerenciar mesas</button></div>
      </app-page-header>

      @if (loading()) {
        <div class="table-grid">@for (row of [1,2,3,4,5,6]; track row) { <div class="loading-row table-loading"></div> }</div>
      } @else if (error()) {
        <div class="error-panel" role="alert"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar as mesas</strong><p>{{ error() }}</p></div><button type="button" class="ghost-button" (click)="load()">Tentar novamente</button></div>
      } @else {
        <section class="table-grid" aria-label="Mesas">
          @for (table of tables(); track table.id) {
            <button type="button" class="table-tile" [class.free]="table.state === 'FREE'" [class.occupied]="table.state === 'OCCUPIED'" [class.disabled]="table.state === 'DISABLED'" [disabled]="table.state === 'DISABLED' || openingTableId() === table.id" (click)="selectTable(table)">
              <span class="table-state-dot"></span><small>{{ tableStateLabel(table) }}</small><strong>Mesa {{ table.number }}</strong><span>{{ table.label || (table.state === 'FREE' ? 'Clique para abrir' : 'Abrir comanda') }}</span>
            </button>
          } @empty { <app-empty-state icon="pi pi-table" title="Nenhuma mesa cadastrada" description="Cadastre a primeira mesa para abrir comandas." /> }
        </section>
      }
    } @else if (currentSale(); as sale) {
      <app-page-header kicker="Comanda aberta" [title]="tableTitle(sale)" [description]="'Aberta por ' + sale.openedByUserName + ' às ' + time(sale.openedAt)">
        <div page-actions class="page-header-actions"><a class="ghost-button" routerLink="/comandas"><i class="pi pi-arrow-left"></i>Mesas</a>@if (sale.status === 'OPEN' && sale.payments.length === 0) { <button type="button" class="danger-button" (click)="openSaleCancellation()"><i class="pi pi-times"></i>Cancelar comanda</button> }</div>
      </app-page-header>

      <div class="sale-workspace">
        <section class="sale-catalog-panel">
          <app-sale-product-picker [products]="products()" [disabled]="!canChangeItems()" [busyProductId]="busyProductId()" (addItem)="addProduct($event)" />
        </section>
        <aside class="sale-summary-panel">
          <header><div><span>Itens</span><strong>{{ activeItems().length }} lançamento{{ activeItems().length === 1 ? '' : 's' }}</strong></div>@if (sale.payments.length > 0) { <app-status-badge label="Itens bloqueados" tone="warning" /> }</header>
          <div class="sale-item-list">
            @for (item of activeItems(); track item.id) {
              <article class="sale-line"><div class="sale-line-copy"><strong>{{ item.productName }}</strong>@if (optionSummary(item)) { <small>{{ optionSummary(item) }}</small> }@if (item.notes) { <small>{{ item.notes }}</small> }</div><div class="quantity-control"><button type="button" aria-label="Diminuir quantidade" (click)="changeQuantity(item, item.quantity - 1)" [disabled]="!canChangeItems() || actionItemId() === item.id"><i class="pi pi-minus"></i></button><b>{{ item.quantity }}</b><button type="button" aria-label="Aumentar quantidade" (click)="changeQuantity(item, item.quantity + 1)" [disabled]="!canChangeItems() || actionItemId() === item.id"><i class="pi pi-plus"></i></button></div><strong>{{ currency(item.subtotal) }}</strong>@if (canChangeItems()) { <button type="button" class="icon-button danger-icon" title="Cancelar item" [attr.aria-label]="'Cancelar ' + item.productName" (click)="openItemCancellation(item)"><i class="pi pi-trash"></i></button> }</article>
            } @empty { <app-empty-state icon="pi pi-receipt" title="Comanda vazia" description="Clique em um produto para adicionar." /> }
          </div>
          <div class="sale-totals"><div><span>Subtotal</span><strong>{{ currency(sale.subtotal) }}</strong></div><div><span>Taxa</span><strong>{{ currency(sale.serviceFee) }}</strong></div><div><span>Desconto</span><strong>{{ currency(sale.discountAmount) }}</strong></div><div class="total"><span>Total</span><strong>{{ currency(sale.finalAmount) }}</strong></div><div><span>Pago</span><strong>{{ currency(sale.paidAmount) }}</strong></div><div class="remaining"><span>Restante</span><strong>{{ currency(sale.remainingAmount) }}</strong></div></div>
          @if (sale.status === 'OPEN') {
            <div class="sale-actions">@if (sale.remainingAmount > 0 && activeItems().length > 0) { <button type="button" class="primary-button" (click)="paymentOpen.set(true)"><i class="pi pi-wallet"></i>Receber</button> }@if (canClose()) { <button type="button" class="success-button" (click)="closeSale()" [disabled]="saving()"><i class="pi pi-check"></i>{{ saving() ? 'Fechando...' : 'Fechar comanda' }}</button> }</div>
          } @else { <div class="info-panel compact-info"><i class="pi pi-lock"></i><div><strong>Comanda {{ sale.status === 'CLOSED' ? 'fechada' : 'cancelada' }}</strong><p>Esta venda está disponível apenas para consulta.</p></div></div> }
        </aside>
      </div>
    }

    @if (paymentOpen() && currentSale(); as sale) { <app-payment-dialog [saleId]="sale.id" [originLabel]="tableTitle(sale)" [totalAmount]="sale.finalAmount" [paidAmount]="sale.paidAmount" [remainingAmount]="sale.remainingAmount" (completed)="paymentCompleted($event)" (dismissed)="paymentOpen.set(false)" /> }

    @if (cancelItemTarget(); as item) {
      <div class="modal-backdrop"><form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="cancel-item-title" [dialogCloseDisabled]="saving()" (dialogClose)="cancelItemTarget.set(null)" (ngSubmit)="cancelItem(item)"><div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Cancelar item</span><h2 id="cancel-item-title">{{ item.productName }}</h2></div><button type="button" class="icon-button" aria-label="Fechar cancelamento" (click)="cancelItemTarget.set(null)"><i class="pi pi-times"></i></button></div><div class="modal-body"><label class="field"><span>Motivo</span><textarea name="cancelReason" maxlength="500" [(ngModel)]="cancellationReason" required autofocus></textarea></label></div><div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="cancelItemTarget.set(null)">Voltar</button><button type="submit" class="danger-button" [disabled]="saving() || !cancellationReason.trim()">Cancelar item</button></div></form></div>
    }

    @if (cancelSaleOpen()) {
      <div class="modal-backdrop"><form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="cancel-sale-title" [dialogCloseDisabled]="saving()" (dialogClose)="cancelSaleOpen.set(false)" (ngSubmit)="cancelSale()"><div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Comanda</span><h2 id="cancel-sale-title">Cancelar comanda</h2></div><button type="button" class="icon-button" aria-label="Fechar cancelamento" (click)="cancelSaleOpen.set(false)"><i class="pi pi-times"></i></button></div><div class="modal-body"><label class="field"><span>Motivo</span><textarea name="cancelSaleReason" maxlength="500" [(ngModel)]="cancellationReason" required autofocus></textarea></label></div><div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="cancelSaleOpen.set(false)">Voltar</button><button type="submit" class="danger-button" [disabled]="saving() || !cancellationReason.trim()">Cancelar comanda</button></div></form></div>
    }

    @if (tableManagerOpen()) {
      <div class="modal-backdrop"><section class="modal-panel table-manager" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="table-manager-title" [dialogCloseDisabled]="saving()" (dialogClose)="tableManagerOpen.set(false)"><div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Configuração</span><h2 id="table-manager-title">Mesas</h2></div><button type="button" class="icon-button" aria-label="Fechar mesas" (click)="tableManagerOpen.set(false)"><i class="pi pi-times"></i></button></div><div class="modal-body table-manager-body"><div class="table-manager-list">@for (table of tables(); track table.id) { <button type="button" [class.active]="editingTable()?.id === table.id" (click)="editTable(table)" [disabled]="table.state === 'OCCUPIED'"><span>Mesa {{ table.number }}</span><small>{{ table.state === 'OCCUPIED' ? 'Ocupada' : table.active ? 'Ativa' : 'Desativada' }}</small></button> }<button type="button" class="new-table-button" (click)="newTable()"><i class="pi pi-plus"></i>Nova mesa</button></div><form class="table-editor" (ngSubmit)="saveTable()"><label class="field"><span>Número</span><input name="tableNumber" type="number" min="1" [(ngModel)]="tableForm.number" required /></label><label class="field"><span>Identificação <small>opcional</small></span><input name="tableLabel" maxlength="80" [(ngModel)]="tableForm.label" /></label><label class="toggle-field"><input name="tableActive" type="checkbox" [(ngModel)]="tableForm.active" /><span>Mesa ativa</span></label><button type="submit" class="primary-button" [disabled]="saving() || tableForm.number < 1"><i class="pi pi-save"></i>Salvar mesa</button></form></div></section></div>
    }
  `,
  styles: `
    .table-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: .75rem; }
    .table-tile { min-height: 8rem; display: grid; grid-template-columns: auto 1fr; align-content: center; gap: .25rem .5rem; padding: 1rem; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-raised); color: var(--text-primary); text-align: left; cursor: pointer; }
    .table-tile strong, .table-tile > span:last-child { grid-column: 1 / -1; } .table-tile strong { margin-top: .45rem; font-size: 1.2rem; } .table-tile small, .table-tile > span:last-child { color: var(--text-muted); }
    .table-state-dot { width: .55rem; height: .55rem; border-radius: 50%; background: var(--text-muted); } .table-tile.free .table-state-dot { background: var(--success); } .table-tile.occupied .table-state-dot { background: var(--warning); } .table-tile.disabled { opacity: .55; cursor: not-allowed; }
    .sale-workspace { display: grid; grid-template-columns: minmax(0, 1fr) minmax(21rem, 25rem); gap: 1rem; align-items: start; }
    .sale-catalog-panel, .sale-summary-panel { border: 1px solid var(--border-subtle); background: var(--surface-panel); border-radius: 6px; padding: 1rem; }
    .sale-summary-panel { position: sticky; top: 1rem; display: grid; gap: .8rem; max-height: calc(100vh - 9rem); }
    .sale-summary-panel > header { display: flex; justify-content: space-between; align-items: center; gap: .5rem; } .sale-summary-panel > header div { display: grid; }
    .sale-item-list { display: grid; gap: .4rem; overflow: auto; }
    .sale-line { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: .55rem; padding: .65rem 0; border-bottom: 1px solid var(--border-subtle); }
    .sale-line-copy { min-width: 0; display: grid; gap: .1rem; } .sale-line-copy small { color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .quantity-control { display: grid; grid-template-columns: 1.8rem 1.8rem 1.8rem; align-items: center; text-align: center; } .quantity-control button { height: 1.8rem; border: 1px solid var(--border-subtle); background: var(--surface-raised); color: var(--text-primary); cursor: pointer; }
    .sale-totals { display: grid; gap: .35rem; padding-top: .5rem; border-top: 1px solid var(--border-subtle); } .sale-totals > div { display: flex; justify-content: space-between; } .sale-totals .total { font-size: 1.05rem; padding-top: .4rem; } .sale-totals .remaining { color: var(--primary); }
    .sale-actions { display: grid; grid-template-columns: 1fr; gap: .5rem; } .sale-actions button { justify-content: center; }
    .table-manager { width: min(42rem, calc(100vw - 2rem)); } .table-manager-body { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; } .table-manager-list, .table-editor { display: grid; align-content: start; gap: .5rem; } .table-manager-list button { display: flex; justify-content: space-between; padding: .65rem; border: 1px solid var(--border-subtle); border-radius: 5px; background: var(--surface-raised); color: var(--text-primary); cursor: pointer; } .table-manager-list button.active { border-color: var(--primary); } .table-manager-list small { color: var(--text-muted); }
    @media (max-width: 960px) { .sale-workspace { grid-template-columns: 1fr; } .sale-summary-panel { position: static; max-height: none; } } @media (max-width: 620px) { .table-manager-body { grid-template-columns: 1fr; } .sale-line { grid-template-columns: 1fr auto; } .sale-line .quantity-control { grid-column: 1; } }
  `,
})
export class TabsPageComponent implements OnInit {
  private readonly api = inject(SalesApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly tableApi = inject(TableApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly tables = signal<RestaurantTable[]>([]);
  readonly openSales = signal<Sale[]>([]);
  readonly products = signal<Product[]>([]);
  readonly currentSale = signal<Sale | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly openingTableId = signal<number | null>(null);
  readonly busyProductId = signal<number | null>(null);
  readonly actionItemId = signal<number | null>(null);
  readonly paymentOpen = signal(false);
  readonly cancelItemTarget = signal<SaleItem | null>(null);
  readonly cancelSaleOpen = signal(false);
  readonly tableManagerOpen = signal(false);
  readonly editingTable = signal<RestaurantTable | null>(null);
  cancellationReason = '';
  tableForm: RestaurantTableRequest = { number: 1, label: null, active: true };
  readonly activeItems = computed(() => activeSaleItems(this.currentSale()));
  readonly canChangeItems = computed(() => saleCanChangeItems(this.currentSale()));
  readonly canClose = computed(() => saleCanClose(this.currentSale()));

  ngOnInit(): void { this.route.paramMap.subscribe((params) => this.load(Number(params.get('saleId')) || undefined)); }
  load(saleId?: number): void {
    this.loading.set(true); this.error.set(null);
    forkJoin({ tables: this.tableApi.getAll(), sales: this.api.list('OPEN', 'TABLE'), products: this.productApi.getAll(), current: saleId ? this.api.get(saleId) : of(null) }).pipe(finalize(() => this.loading.set(false))).subscribe({ next: ({ tables, sales, products, current }) => { this.tables.set(tables); this.openSales.set(sales); this.products.set(products); this.currentSale.set(current); }, error: (error) => this.error.set(apiErrorMessage(error)) });
  }
  selectTable(table: RestaurantTable): void {
    if (table.state === 'DISABLED' || this.openingTableId()) return;
    const existing = this.openSales().find((sale) => sale.restaurantTableId === table.id);
    if (existing) { this.router.navigate(['/comandas', existing.id]); return; }
    this.openingTableId.set(table.id);
    this.api.open({ type: 'TABLE', restaurantTableId: table.id, customerName: null, customerPhone: null, serviceFee: 0, discountAmount: 0 }).pipe(finalize(() => this.openingTableId.set(null))).subscribe({ next: (sale) => { this.openSales.update((items) => [...items, sale]); this.feedback.success('Comanda aberta.'); this.router.navigate(['/comandas', sale.id]); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }
  addProduct(request: AddSaleItemRequest): void {
    const sale = this.currentSale(); if (!sale || !this.canChangeItems()) return;
    const matching = this.activeItems().find((item) => itemMatchesRequest(item, request));
    if (matching) { this.changeQuantity(matching, matching.quantity + request.quantity); return; }
    this.busyProductId.set(request.productId);
    this.api.addItem(sale.id, request).pipe(finalize(() => this.busyProductId.set(null))).subscribe({ next: (updated) => { this.currentSale.set(updated); this.feedback.success('Produto adicionado.'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }
  changeQuantity(item: SaleItem, quantity: number): void {
    const sale = this.currentSale(); if (!sale || !this.canChangeItems() || quantity < 0) return;
    this.actionItemId.set(item.id);
    this.api.cancelItem(sale.id, item.id, { reason: 'Ajuste de quantidade' }).pipe(switchMap((cancelled) => quantity === 0 ? of(cancelled) : this.api.addItem(sale.id, { productId: item.productId, quantity, notes: item.notes, optionIds: item.options.map((option) => option.productOptionId) })), finalize(() => this.actionItemId.set(null))).subscribe({ next: (updated) => { this.currentSale.set(updated); this.feedback.success(quantity === 0 ? 'Item removido.' : 'Quantidade atualizada.'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }
  openItemCancellation(item: SaleItem): void { this.cancellationReason = ''; this.cancelItemTarget.set(item); }
  cancelItem(item: SaleItem): void { const sale = this.currentSale(); if (!sale || !this.cancellationReason.trim() || this.saving()) return; this.saving.set(true); this.api.cancelItem(sale.id, item.id, { reason: this.cancellationReason.trim() }).pipe(finalize(() => this.saving.set(false))).subscribe({ next: (updated) => { this.currentSale.set(updated); this.cancelItemTarget.set(null); this.feedback.success('Item cancelado.'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  paymentCompleted(sale: Sale): void { this.currentSale.set(sale); this.paymentOpen.set(false); }
  closeSale(): void { const sale = this.currentSale(); if (!sale || !this.canClose() || this.saving()) return; this.saving.set(true); this.api.close(sale.id).pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { this.feedback.success('Comanda fechada.'); this.router.navigateByUrl('/comandas'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  openSaleCancellation(): void { this.cancellationReason = ''; this.cancelSaleOpen.set(true); }
  cancelSale(): void { const sale = this.currentSale(); if (!sale || !this.cancellationReason.trim() || this.saving()) return; this.saving.set(true); this.api.cancel(sale.id, { reason: this.cancellationReason.trim() }).pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { this.feedback.success('Comanda cancelada.'); this.router.navigateByUrl('/comandas'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  openTableManager(): void { this.newTable(); this.tableManagerOpen.set(true); }
  newTable(): void { this.editingTable.set(null); this.tableForm = { number: Math.max(0, ...this.tables().map((table) => table.number)) + 1, label: null, active: true }; }
  editTable(table: RestaurantTable): void { if (table.state === 'OCCUPIED') return; this.editingTable.set(table); this.tableForm = { number: table.number, label: table.label, active: table.active }; }
  saveTable(): void { if (this.tableForm.number < 1 || this.saving()) return; const editing = this.editingTable(); const request = { ...this.tableForm, number: Number(this.tableForm.number), label: this.tableForm.label?.trim() || null }; this.saving.set(true); const operation = editing ? this.tableApi.update(editing.id, request) : this.tableApi.create(request); operation.pipe(finalize(() => this.saving.set(false))).subscribe({ next: (table) => { this.tables.update((items) => items.some((item) => item.id === table.id) ? items.map((item) => item.id === table.id ? table : item) : [...items, table]); this.editTable(table); this.feedback.success('Mesa salva.'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  tableStateLabel(table: RestaurantTable): string { return ({ FREE: 'Livre', OCCUPIED: 'Ocupada', DISABLED: 'Desativada' })[table.state]; }
  tableTitle(sale: Sale): string { return `Mesa ${sale.tableNumber}${sale.tableLabel ? ` · ${sale.tableLabel}` : ''}`; }
  optionSummary(item: SaleItem): string { return item.options.map((option) => option.optionName).join(', '); }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  time(value: string): string { return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
}
