import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { StockApiService } from '../../core/services/stock-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { Product } from '../../shared/models/product.model';
import {
  ProductStockLink,
  ProductStockLinkRequest,
  StockItem,
  StockItemRequest,
  StockMovement,
  StockMovementType,
  UnitOfMeasure,
} from '../../shared/models/stock.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { formatStockValue, unitLabel } from '../../shared/util/unit-format';

type StockView = 'ITEMS' | 'MOVEMENTS' | 'LINKS';
type ManualMovement = 'ENTRY' | 'EXIT' | 'LOSS' | 'ADJUSTMENT';

@Component({
  selector: 'app-stock-page',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, PageHeaderComponent, StatusBadgeComponent, AccessibleDialogDirective],
  template: `
    <app-page-header kicker="Controle" title="Estoque" description="Saldo atual, movimentações e baixa automática por produto.">
      <div page-actions class="page-header-actions"><button type="button" class="secondary-button" (click)="openMovement()"><i class="pi pi-arrow-right-arrow-left"></i>Movimentar</button><button type="button" class="primary-button" (click)="openItem()"><i class="pi pi-plus"></i>Novo item</button></div>
    </app-page-header>

    <nav class="segmented-control stock-tabs" aria-label="Visualização do estoque"><button type="button" [class.active]="view() === 'ITEMS'" (click)="view.set('ITEMS')">Itens</button><button type="button" [class.active]="view() === 'MOVEMENTS'" (click)="view.set('MOVEMENTS')">Histórico</button><button type="button" [class.active]="view() === 'LINKS'" (click)="view.set('LINKS')">Baixa automática</button></nav>

    @if (loading()) { <div class="loading-grid"><div class="loading-row"></div><div class="loading-row"></div><div class="loading-row"></div></div> }
    @else if (error()) { <div class="error-panel" role="alert"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar o estoque</strong><p>{{ error() }}</p></div><button type="button" class="ghost-button" (click)="load()">Tentar novamente</button></div> }
    @else if (view() === 'ITEMS') {
      <section class="stock-panel">
        <div class="stock-toolbar"><label class="search-box"><i class="pi pi-search"></i><input type="search" placeholder="Buscar item" [(ngModel)]="searchTerm" aria-label="Buscar item de estoque" /></label><span>{{ alertCount() }} alerta{{ alertCount() === 1 ? '' : 's' }} de estoque</span></div>
        @if (filteredItems().length) { <div class="stock-table"><div class="stock-head" aria-hidden="true"><span>Item</span><span>Saldo atual</span><span>Mínimo</span><span>Situação</span><span>Ativo</span><span>Ações</span></div>@for (item of filteredItems(); track item.id) { <article class="stock-row"><div><strong>{{ item.name }}</strong>@if (item.description) { <small>{{ item.description }}</small> }</div><strong>{{ stockValue(item.currentStock, item.unit) }}</strong><span>{{ stockValue(item.minimumStock, item.unit) }}</span><app-status-badge [label]="statusLabel(item)" [tone]="statusTone(item)" /><app-status-badge [label]="item.active ? 'Ativo' : 'Inativo'" [tone]="item.active ? 'success' : 'neutral'" /><div class="row-actions"><button type="button" class="icon-button" title="Movimentar" [attr.aria-label]="'Movimentar ' + item.name" (click)="openMovement(item)"><i class="pi pi-arrow-right-arrow-left"></i></button><button type="button" class="icon-button" title="Editar" [attr.aria-label]="'Editar ' + item.name" (click)="openItem(item)"><i class="pi pi-pencil"></i></button><button type="button" class="icon-button" [title]="item.active ? 'Desativar' : 'Ativar'" (click)="toggleItem(item)" [disabled]="busyId() === item.id"><i [class]="item.active ? 'pi pi-pause' : 'pi pi-play'"></i></button></div></article> }</div> } @else { <app-empty-state icon="pi pi-warehouse" title="Nenhum item encontrado" description="Cadastre os itens que precisam de controle de saldo." /> }
      </section>
    } @else if (view() === 'MOVEMENTS') {
      <section class="stock-panel"><div class="stock-toolbar"><div><strong>Histórico de movimentações</strong><small>Registros não podem ser editados.</small></div><button type="button" class="secondary-button" (click)="openMovement()"><i class="pi pi-plus"></i>Nova movimentação</button></div>@if (movements().length) { <div class="movement-table"><div class="movement-head" aria-hidden="true"><span>Data</span><span>Item</span><span>Tipo</span><span>Quantidade</span><span>Saldo</span><span>Motivo</span></div>@for (movement of movements(); track movement.id) { <article class="movement-row"><time>{{ dateTime(movement.createdAt) }}</time><strong>{{ movement.stockItemName }}</strong><span>{{ movementTypeLabel(movement.type) }}</span><strong [class.negative]="movement.deltaQuantity < 0">{{ signedQuantity(movement) }}</strong><span>{{ stockValue(movement.resultingBalance, movement.unit) }}</span><span>{{ movement.reason || automaticReason(movement) }}</span></article> }</div> } @else { <app-empty-state icon="pi pi-history" title="Sem movimentações" description="Entradas, saídas e vendas aparecerão aqui." /> }</section>
    } @else {
      <section class="stock-panel"><div class="stock-toolbar"><div><strong>Baixa automática por produto</strong><small>No máximo um vínculo ativo por produto.</small></div></div>@if (products().length) { <div class="link-list">@for (product of products(); track product.id) { <article class="link-row"><div><strong>{{ product.name }}</strong><small>{{ product.categoryName || 'Sem categoria' }}</small></div>@if (linkFor(product.id); as link) { <span>{{ link.stockItemName }}</span><strong>{{ stockValue(link.quantityPerSale, link.unit) }} por venda</strong><button type="button" class="icon-button" title="Editar vínculo" (click)="openLink(product, link)"><i class="pi pi-pencil"></i></button><button type="button" class="icon-button danger-icon" title="Desativar vínculo" (click)="deactivateLink(product)" [disabled]="busyId() === product.id"><i class="pi pi-link-slash"></i></button> } @else { <span class="muted-line">Sem controle automático</span><button type="button" class="secondary-button compact-button" (click)="openLink(product)"><i class="pi pi-link"></i>Vincular</button> }</article> }</div> } @else { <app-empty-state icon="pi pi-link" title="Nenhum produto" description="Cadastre produtos antes de criar vínculos." /> }</section>
    }

    @if (itemDialog()) { <div class="modal-backdrop"><form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="stock-item-dialog-title" [dialogCloseDisabled]="saving()" (dialogClose)="itemDialog.set(false)" (ngSubmit)="saveItem()"><div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Estoque</span><h2 id="stock-item-dialog-title">{{ editingItem() ? 'Editar item' : 'Novo item' }}</h2></div><button type="button" class="icon-button" aria-label="Fechar item" (click)="itemDialog.set(false)"><i class="pi pi-times"></i></button></div><div class="modal-body"><label class="field"><span>Nome</span><input name="stockName" maxlength="120" [(ngModel)]="itemForm.name" required autofocus /></label><div class="form-grid"><label class="field"><span>Unidade</span><select name="stockUnit" [(ngModel)]="itemForm.unit">@for (unit of units; track unit) { <option [ngValue]="unit">{{ unitLabel(unit) }}</option> }</select></label><label class="field"><span>Estoque mínimo</span><input name="minimumStock" type="number" min="0" step="0.001" [(ngModel)]="itemForm.minimumStock" required /></label>@if (!editingItem()) { <label class="field"><span>Saldo inicial</span><input name="currentStock" type="number" min="0" step="0.001" [(ngModel)]="itemForm.currentStock" required /></label> }</div><label class="field"><span>Descrição <small>opcional</small></span><textarea name="stockDescription" maxlength="255" [(ngModel)]="itemForm.description"></textarea></label><label class="toggle-field"><input name="stockActive" type="checkbox" [(ngModel)]="itemForm.active" /><span>Item ativo</span></label></div><div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="itemDialog.set(false)">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving() || !itemForm.name.trim()"><i class="pi pi-save"></i>Salvar item</button></div></form></div> }

    @if (movementDialog()) { <div class="modal-backdrop"><form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="stock-movement-dialog-title" [dialogCloseDisabled]="saving()" (dialogClose)="movementDialog.set(false)" (ngSubmit)="saveMovement()"><div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Estoque</span><h2 id="stock-movement-dialog-title">Movimentar estoque</h2></div><button type="button" class="icon-button" aria-label="Fechar movimentação" (click)="movementDialog.set(false)"><i class="pi pi-times"></i></button></div><div class="modal-body"><label class="field"><span>Item</span><select name="movementItem" [(ngModel)]="movementForm.stockItemId" required autofocus>@for (item of activeItems(); track item.id) { <option [ngValue]="item.id">{{ item.name }} · {{ stockValue(item.currentStock, item.unit) }}</option> }</select></label><div class="segmented-control movement-types">@for (type of manualTypes; track type) { <button type="button" [class.active]="movementForm.type === type" (click)="movementForm.type = type">{{ movementTypeLabel(type) }}</button> }</div><label class="field"><span>{{ movementForm.type === 'ADJUSTMENT' ? 'Novo saldo' : 'Quantidade' }}</span><input name="movementQuantity" type="number" min="0.001" step="0.001" [(ngModel)]="movementForm.quantity" required /></label><label class="field"><span>Motivo {{ requiresReason() ? '' : 'opcional' }}</span><textarea name="movementReason" maxlength="500" [(ngModel)]="movementForm.reason" [required]="requiresReason()"></textarea></label></div><div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="movementDialog.set(false)">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving() || movementForm.quantity < 0 || (requiresReason() && !movementForm.reason.trim())"><i class="pi pi-check"></i>Confirmar</button></div></form></div> }

    @if (linkDialog() && linkProduct(); as product) { <div class="modal-backdrop"><form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="stock-link-dialog-title" [dialogCloseDisabled]="saving()" (dialogClose)="linkDialog.set(false)" (ngSubmit)="saveLink(product)"><div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">{{ product.name }}</span><h2 id="stock-link-dialog-title">Baixa automática</h2></div><button type="button" class="icon-button" aria-label="Fechar vínculo" (click)="linkDialog.set(false)"><i class="pi pi-times"></i></button></div><div class="modal-body"><label class="field"><span>Item de estoque</span><select name="linkStockItem" [(ngModel)]="linkForm.stockItemId" required autofocus>@for (item of activeItems(); track item.id) { <option [ngValue]="item.id">{{ item.name }}</option> }</select></label><label class="field"><span>Quantidade por venda</span><input name="linkQuantity" type="number" min="0.001" step="0.001" [(ngModel)]="linkForm.quantityPerSale" required /></label></div><div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="linkDialog.set(false)">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving() || !linkForm.stockItemId || linkForm.quantityPerSale <= 0"><i class="pi pi-link"></i>Salvar vínculo</button></div></form></div> }
  `,
  styles: `
    .stock-tabs { width: max-content; margin-bottom: .8rem; } .stock-panel { border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-panel); padding: 1rem; } .stock-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: .8rem; } .stock-toolbar > div { display: grid; } .stock-toolbar small, .stock-toolbar > span { color: var(--text-muted); }
    .stock-table, .movement-table { display: grid; gap: .25rem; } .stock-head, .stock-row { display: grid; grid-template-columns: minmax(12rem, 2fr) 8rem 8rem 8rem 6rem 8rem; gap: .8rem; align-items: center; } .stock-head, .movement-head { padding: .55rem .75rem; color: var(--text-muted); font-size: .75rem; font-weight: 700; text-transform: uppercase; } .stock-row, .movement-row, .link-row { min-height: 3.8rem; padding: .65rem .75rem; border: 1px solid var(--border-subtle); border-radius: 5px; background: var(--surface-raised); } .stock-row > div:first-child { display: grid; } .stock-row small { color: var(--text-muted); }
    .movement-head, .movement-row { display: grid; grid-template-columns: 9rem minmax(10rem, 1.5fr) 8rem 8rem 8rem minmax(10rem, 1fr); gap: .7rem; align-items: center; } .movement-row time, .movement-row > span { color: var(--text-secondary); } .negative { color: var(--danger-text); }
    .link-list { display: grid; gap: .35rem; } .link-row { display: grid; grid-template-columns: minmax(12rem, 2fr) minmax(10rem, 1fr) 10rem auto auto; gap: .7rem; align-items: center; } .link-row > div { display: grid; } .link-row small, .muted-line { color: var(--text-muted); } .movement-types { display: grid; grid-template-columns: repeat(4, 1fr); }
    @media (max-width: 900px) { .stock-head, .movement-head { display: none; } .stock-row, .movement-row, .link-row { grid-template-columns: 1fr auto; } .stock-row > :not(:first-child):not(.row-actions):not(app-status-badge), .movement-row > :not(strong):not(time), .link-row > span { display: none; } }
  `,
})
export class StockPageComponent implements OnInit {
  private readonly api = inject(StockApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly feedback = inject(FeedbackService);
  readonly items = signal<StockItem[]>([]);
  readonly movements = signal<StockMovement[]>([]);
  readonly products = signal<Product[]>([]);
  readonly productLinks = signal<Map<number, ProductStockLink | null>>(new Map());
  readonly view = signal<StockView>('ITEMS');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);
  readonly itemDialog = signal(false);
  readonly editingItem = signal<StockItem | null>(null);
  readonly movementDialog = signal(false);
  readonly linkDialog = signal(false);
  readonly linkProduct = signal<Product | null>(null);
  searchTerm = '';
  itemForm: StockItemRequest = this.emptyItem();
  movementForm = { stockItemId: 0, type: 'ENTRY' as ManualMovement, quantity: 0, reason: '' };
  linkForm: ProductStockLinkRequest = { stockItemId: 0, quantityPerSale: 1 };
  readonly units: UnitOfMeasure[] = ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PACKAGE', 'TRAY'];
  readonly manualTypes: ManualMovement[] = ['ENTRY', 'EXIT', 'LOSS', 'ADJUSTMENT'];
  readonly activeItems = computed(() => this.items().filter((item) => item.active));
  readonly alertCount = computed(() => this.items().filter((item) => item.active && item.status !== 'NORMAL').length);
  filteredItems(): StockItem[] { const query = this.normalized(this.searchTerm); return this.items().filter((item) => !query || this.normalized(item.name).includes(query)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')); }

  ngOnInit(): void { this.load(); }
  load(): void { this.loading.set(true); this.error.set(null); forkJoin({ items: this.api.listItems(), movements: this.api.listMovements(), products: this.productApi.getAll() }).pipe(finalize(() => this.loading.set(false))).subscribe({ next: ({ items, movements, products }) => { this.items.set(items); this.movements.set(movements); this.products.set(products); this.loadLinks(products); }, error: (error) => this.error.set(apiErrorMessage(error)) }); }
  openItem(item: StockItem | null = null): void { this.editingItem.set(item); this.itemForm = item ? { name: item.name, description: item.description, unit: item.unit, currentStock: item.currentStock, minimumStock: item.minimumStock, active: item.active } : this.emptyItem(); this.itemDialog.set(true); }
  saveItem(): void { const name = this.itemForm.name.trim(); if (!name || this.saving()) return; const editing = this.editingItem(); const request = { ...this.itemForm, name, description: this.itemForm.description?.trim() || null, currentStock: Number(this.itemForm.currentStock), minimumStock: Number(this.itemForm.minimumStock) }; this.saving.set(true); const operation = editing ? this.api.updateItem(editing.id, request) : this.api.createItem(request); operation.pipe(finalize(() => this.saving.set(false))).subscribe({ next: (item) => { this.replaceItem(item); this.itemDialog.set(false); this.feedback.success(editing ? 'Item atualizado.' : 'Item cadastrado.'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  toggleItem(item: StockItem): void { this.busyId.set(item.id); this.api.setItemActive(item.id, !item.active).pipe(finalize(() => this.busyId.set(null))).subscribe({ next: (updated) => { this.replaceItem(updated); this.feedback.success(updated.active ? 'Item ativado.' : 'Item desativado.'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  openMovement(item: StockItem | null = null): void { const first = item ?? this.activeItems()[0]; this.movementForm = { stockItemId: first?.id ?? 0, type: 'ENTRY', quantity: 0, reason: '' }; this.movementDialog.set(true); }
  saveMovement(): void { const form = this.movementForm; if (!form.stockItemId || form.quantity < 0 || (this.requiresReason() && !form.reason.trim()) || this.saving()) return; this.saving.set(true); const reason = form.reason.trim() || null; const operation = form.type === 'ENTRY' ? this.api.entry({ stockItemId: form.stockItemId, quantity: Number(form.quantity), reason }) : form.type === 'EXIT' ? this.api.exit({ stockItemId: form.stockItemId, quantity: Number(form.quantity), reason }) : form.type === 'LOSS' ? this.api.loss({ stockItemId: form.stockItemId, quantity: Number(form.quantity), reason: form.reason.trim() }) : this.api.adjust({ stockItemId: form.stockItemId, newStock: Number(form.quantity), reason: form.reason.trim() }); operation.pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { this.movementDialog.set(false); this.feedback.success('Movimentação registrada.'); this.refreshStock(); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  requiresReason(): boolean { return this.movementForm.type === 'LOSS' || this.movementForm.type === 'ADJUSTMENT'; }
  openLink(product: Product, link: ProductStockLink | null = null): void { this.linkProduct.set(product); this.linkForm = { stockItemId: link?.stockItemId ?? this.activeItems()[0]?.id ?? 0, quantityPerSale: link?.quantityPerSale ?? 1 }; this.linkDialog.set(true); }
  saveLink(product: Product): void { if (!this.linkForm.stockItemId || this.linkForm.quantityPerSale <= 0 || this.saving()) return; const existing = this.linkFor(product.id); this.saving.set(true); const operation = existing ? this.api.updateProductLink(product.id, this.linkForm) : this.api.createProductLink(product.id, this.linkForm); operation.pipe(finalize(() => this.saving.set(false))).subscribe({ next: (link) => { this.productLinks.update((links) => new Map(links).set(product.id, link)); this.linkDialog.set(false); this.feedback.success('Controle automático salvo.'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  deactivateLink(product: Product): void { this.busyId.set(product.id); this.api.deactivateProductLink(product.id).pipe(finalize(() => this.busyId.set(null))).subscribe({ next: () => { this.productLinks.update((links) => new Map(links).set(product.id, null)); this.feedback.success('Controle automático desativado.'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  linkFor(productId: number): ProductStockLink | null { return this.productLinks().get(productId) ?? null; }
  statusLabel(item: StockItem): string { return ({ NORMAL: 'OK', LOW_STOCK: 'Estoque baixo', OUT_OF_STOCK: 'Sem estoque' })[item.status]; }
  statusTone(item: StockItem): string { return ({ NORMAL: 'success', LOW_STOCK: 'warning', OUT_OF_STOCK: 'danger' })[item.status]; }
  movementTypeLabel(type: StockMovementType | ManualMovement): string { return ({ ENTRY: 'Entrada', SALE: 'Venda', SALE_REVERSAL: 'Estorno', EXIT: 'Saída', LOSS: 'Perda', ADJUSTMENT: 'Ajuste' })[type]; }
  automaticReason(movement: StockMovement): string { return movement.type === 'SALE' ? 'Baixa automática da venda' : movement.type === 'SALE_REVERSAL' ? 'Cancelamento de item' : 'Sem observação'; }
  signedQuantity(movement: StockMovement): string { const sign = movement.deltaQuantity > 0 ? '+' : ''; return `${sign}${this.stockValue(movement.deltaQuantity, movement.unit)}`; }
  stockValue(value: number, unit: UnitOfMeasure): string { return formatStockValue(value, unit); }
  unitLabel(unit: UnitOfMeasure): string { return unitLabel(unit); }
  dateTime(value: string): string { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
  private loadLinks(products: Product[]): void { if (products.length === 0) { this.productLinks.set(new Map()); return; } forkJoin(products.map((product) => this.api.getProductLink(product.id).pipe(catchError(() => of(null))))).subscribe((links) => this.productLinks.set(new Map(products.map((product, index) => [product.id, links[index]])))); }
  private refreshStock(): void { forkJoin({ items: this.api.listItems(), movements: this.api.listMovements() }).subscribe({ next: ({ items, movements }) => { this.items.set(items); this.movements.set(movements); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  private replaceItem(item: StockItem): void { this.items.update((items) => items.some((current) => current.id === item.id) ? items.map((current) => current.id === item.id ? item : current) : [...items, item]); }
  private emptyItem(): StockItemRequest { return { name: '', description: null, unit: 'UN', currentStock: 0, minimumStock: 0, active: true }; }
  private normalized(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim(); }
}
