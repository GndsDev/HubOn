import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { BodyPortalDirective } from '../../shared/directives/body-portal.directive';
import { OrderItem, OrderItemRequest, OrderStatus, RestaurantOrder } from '../../shared/models/order.model';
import { Product, ProductOptionGroup, ProductVariant } from '../../shared/models/product.model';
import { CounterSaleSummary, Tab, TabStatus } from '../../shared/models/tab.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { calculateOverlayPosition, OverlayPosition } from '../../shared/util/overlay-position';
import {
  automaticVariantId,
  isCatalogProductSellable,
  operationalVariantLabel,
  optionSelectionsAreValid,
  priceRangeSummary,
  sellableVariants,
} from '../../shared/util/catalog-workflow';

type OrderFilter = 'ALL' | 'WAITING_PAYMENT' | 'IN_PREPARATION' | 'READY' | 'DELIVERED' | 'CANCELLED' | 'TABLE' | 'COUNTER';

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, EmptyStateComponent, PageHeaderComponent, SectionCardComponent, StatusBadgeComponent, AccessibleDialogDirective, BodyPortalDirective],
  template: `
    <app-page-header kicker="Operação" title="Pedidos" description="Consulte a origem, o andamento e a próxima ação de cada pedido.">
      <div page-actions class="page-header-actions">
        @if (!kitchenOnly()) { <button type="button" class="primary-button" (click)="openCreate()"><i class="pi pi-shopping-cart"></i>Novo pedido de mesa</button> }
      </div>
    </app-page-header>

    <app-section-card eyebrow="Fluxo de venda" title="Pedidos do turno">
      <div class="segmented-control order-filters" card-action aria-label="Filtrar pedidos">
        @for (filter of filters; track filter.value) {
          <button type="button" [class.active]="activeFilter() === filter.value" (click)="activeFilter.set(filter.value)">{{ filter.label }} <span>{{ filterCount(filter.value) }}</span></button>
        }
      </div>
      @if (loading()) {
        <div class="loading-grid">@for (item of [1,2,3,4]; track item) { <div class="loading-row"></div> }</div>
      } @else if (error()) {
        <div class="error-panel"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar</strong><p>{{ error() }}</p></div><button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button></div>
      } @else if (visibleOrders().length === 0) {
        <app-empty-state icon="pi pi-shopping-cart" title="Nenhum pedido neste filtro" description="Os pedidos aparecerão aqui conforme avançarem na operação." />
      } @else {
        <div class="order-list">
          @for (order of visibleOrders(); track order.id) {
            <article class="order-card">
              <div class="order-card-head"><div><span>Pedido #{{ order.id }} · {{ order.tabType === 'COUNTER' ? 'Balcão' : 'Mesa' }}</span><strong>{{ order.tabDisplayLabel }}</strong><small>Comanda #{{ order.tabId }} · {{ tabStatusLabel(effectiveTabStatus(order)) }}</small>@if (!kitchenOnly() && counterSummary(order); as sale) { <small>Financeiro: {{ financialLabel(sale) }} · Restante {{ currency(sale.remainingAmount) }}</small> }</div><app-status-badge [label]="statusLabel(order)" [tone]="statusTone(order.status)" /></div>
              @for (group of itemGroups(order); track group.key) {
                @if (group.items.length) {
                  <section class="order-flow-group">
                    <h3><i [class]="group.key === 'PREPARATION' ? 'pi pi-clock' : 'pi pi-bolt'"></i>{{ group.label }}</h3>
                    <div class="order-item-list detailed-order-items">
                      @for (item of group.items; track item.id) {
                        <div class="detailed-order-item" [class.cancelled]="item.status === 'CANCELED'">
                          <div><span>{{ item.quantity }}x {{ item.displayNameSnapshot || item.productNameSnapshot }}</span>@for (option of item.options; track option.id) { <small>{{ option.groupName }}: {{ option.optionName }}</small> }@if (item.notes) { <small>Observação: {{ item.notes }}</small> }@if (item.cancellationReason) { <small>Cancelado: {{ item.cancellationReason }}</small> }</div>
                          <div class="order-item-side">
                            <app-status-badge [label]="itemStatusLabel(order, item)" [tone]="itemStatusTone(item.status)" />
                            @if (!kitchenOnly()) { <b>{{ currency(item.subtotal) }}</b> }
                            @if (canMarkReady(item)) { <button type="button" class="primary-button compact-button" (click)="markReady(order, item)"><i class="pi pi-check"></i>Marcar como pronto</button> }
                            @if (canDeliverItem(order, item)) { <button type="button" class="primary-button compact-button" (click)="deliverItem(order, item)"><i class="pi pi-check-circle"></i>Marcar como entregue</button> }
                            @if (canCancelItem(order, item)) { <button type="button" class="text-action danger-text" (click)="openCancelItem(order, item)">Cancelar item</button> }
                          </div>
                        </div>
                      }
                    </div>
                  </section>
                }
              }
              @if (order.notes) { <p class="order-notes">{{ order.notes }}</p> }
              <div class="order-card-footer">@if (!kitchenOnly()) { <strong>{{ currency(orderTotal(order)) }}</strong> }<div class="action-cluster">
                @if (!kitchenOnly() && order.tabType === 'COUNTER' && effectiveTabStatus(order) === 'OPEN') { <a class="ghost-button compact-button" [routerLink]="['/balcao', order.tabId]"><i class="pi pi-arrow-right"></i>Abrir atendimento</a> }
                @if (!kitchenOnly() && order.tabType === 'TABLE' && effectiveTabStatus(order) === 'OPEN') { <a class="ghost-button compact-button" [routerLink]="['/comandas', order.tabId]"><i class="pi pi-arrow-right"></i>Abrir comanda</a> }
                @if (canEdit(order)) { <button type="button" class="primary-button compact-button" (click)="confirm(order)"><i class="pi pi-check"></i>Confirmar pedido</button> }
                @if (orderStateMessage(order); as message) { <span class="order-state-note" [class.blocked]="effectiveTabStatus(order) !== 'OPEN'"><i class="pi pi-info-circle"></i>{{ message }}</span> }
                @if (canEdit(order) || canCancel(order)) { <button type="button" class="icon-action-button actions-trigger" aria-haspopup="menu" [attr.aria-expanded]="actionMenuOrderId() === order.id" [attr.aria-label]="'Mais ações do pedido ' + order.id" (click)="toggleActionMenu(order, $event)"><i class="pi pi-ellipsis-v"></i></button> }
              </div></div>
            </article>
          }
        </div>
      }
    </app-section-card>

    @if (actionMenuOrder(); as order) {
      <div appBodyPortal class="action-menu action-menu-overlay order-action-menu" role="menu" [attr.data-placement]="actionMenuPosition().placement" [style.left.px]="actionMenuPosition().left" [style.top.px]="actionMenuPosition().top" [style.max-height.px]="actionMenuPosition().maxHeight" (click)="$event.stopPropagation()" (keydown)="onActionMenuKeydown($event)">
        @if (canEdit(order)) { <button type="button" role="menuitem" (click)="closeActionMenu(); openEdit(order)"><i class="pi pi-pencil"></i>Editar rascunho</button> }
        @if (canCancel(order)) { <button type="button" role="menuitem" class="danger-menu-item" (click)="closeActionMenu(); openCancelOrder(order)"><i class="pi pi-times"></i>Cancelar pedido</button> }
      </div>
    }

    @if (formOpen()) {
      <div class="modal-backdrop" (click)="closeForm()">
        <form class="modal-panel wide order-builder-panel" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="order-dialog-title" [dialogCloseDisabled]="saving()" (dialogClose)="closeForm()" (click)="$event.stopPropagation()" (ngSubmit)="saveDraft()">
          <div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Venda</span><h2 id="order-dialog-title">{{ editingOrder() ? 'Editar pedido' : 'Novo pedido' }}</h2></div><button type="button" class="icon-button" aria-label="Fechar" (click)="closeForm()"><i class="pi pi-times"></i></button></div>
          <div class="modal-body order-builder-body">
            <div class="form-grid"><label class="field full"><span>Comanda aberta</span><select name="tabId" [(ngModel)]="form.tabId" [disabled]="!!editingOrder()" required autofocus>@for (tab of tableTabs; track tab.id) { <option [ngValue]="tab.id">#{{ tab.id }} · {{ tab.displayLabel }}</option> }</select></label><label class="field full"><span>Observação geral</span><textarea name="notes" [(ngModel)]="form.notes" maxlength="500"></textarea></label></div>
            <div class="form-section-title"><div><span>Itens do pedido</span><small>Preço e disponibilidade são validados pelo sistema.</small></div><button type="button" class="secondary-button compact-button" (click)="addItem()"><i class="pi pi-plus"></i>Adicionar item</button></div>
            <div class="order-builder-items">
              @for (item of form.items; track $index; let index = $index) {
                <section class="order-builder-item">
                  <div class="order-builder-main">
                    <label class="field"><span>Produto</span><select [name]="'product-' + index" [(ngModel)]="item.productId" (ngModelChange)="onProductChange(item, $event)"><option [ngValue]="0" disabled>Selecione</option>@for (product of products(); track product.id) { <option [ngValue]="product.id">{{ product.name }} · {{ priceSummary(product) }}</option> }</select></label>
                    @if (activeVariants(item.productId).length > 1) { <label class="field"><span>Variação</span><select [name]="'variant-' + index" [(ngModel)]="item.variantId" (ngModelChange)="item.optionIds = []"><option [ngValue]="0" disabled>Selecione</option>@for (variant of activeVariants(item.productId); track variant.id) { <option [ngValue]="variant.id">{{ variant.name }} · {{ currency(variant.price) }}</option> }</select></label> }
                    @else if (selectedVariant(item); as variant) { <div class="selected-variant"><span>Variação</span><strong>{{ variantLabel(variant) }}</strong><small>{{ currency(variant.price) }}</small></div> }
                    <label class="field quantity-field"><span>Qtd.</span><input [name]="'quantity-' + index" type="number" min="1" [(ngModel)]="item.quantity" /></label>
                    <label class="field"><span>Observação</span><input [name]="'notes-' + index" [(ngModel)]="item.notes" placeholder="Ex.: sem cebola" /></label>
                    <button type="button" class="icon-button danger-icon" title="Remover item" aria-label="Remover item" (click)="removeItem(index)" [disabled]="form.items.length === 1"><i class="pi pi-trash"></i></button>
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
          <div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="closeForm()">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-save"></i>{{ saving() ? 'Salvando...' : 'Salvar rascunho' }}</button></div>
        </form>
      </div>
    }

    @if (cancelOpen()) {
      <div class="modal-backdrop" (click)="closeCancel()"><form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="cancel-title" [dialogCloseDisabled]="saving()" (dialogClose)="closeCancel()" (click)="$event.stopPropagation()" (ngSubmit)="confirmCancellation()"><div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Auditoria</span><h2 id="cancel-title">{{ cancelItem() ? 'Cancelar item' : 'Cancelar pedido' }}</h2></div><button type="button" class="icon-button" aria-label="Fechar" (click)="closeCancel()"><i class="pi pi-times"></i></button></div><div class="modal-body"><label class="field"><span>Motivo</span><textarea name="cancelReason" [(ngModel)]="cancelReason" maxlength="500" required autofocus></textarea></label></div><div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="closeCancel()">Voltar</button><button type="submit" class="danger-button" [disabled]="saving()"><i class="pi pi-times"></i>Confirmar cancelamento</button></div></form></div>
    }
  `,
})
export class OrdersPageComponent implements OnInit {
  private readonly api = inject(OrderApiService);
  private readonly tabApi = inject(TabApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly document = inject(DOCUMENT);

  readonly orders = signal<RestaurantOrder[]>([]);
  readonly tabs = signal<Tab[]>([]);
  readonly counterSales = signal<CounterSaleSummary[]>([]);
  readonly actionMenuOrder = signal<RestaurantOrder | null>(null);
  readonly actionMenuOrderId = signal<number | null>(null);
  readonly actionMenuPosition = signal<OverlayPosition>({ left: 0, top: 0, maxHeight: 240, placement: 'bottom' });
  private actionMenuTrigger: HTMLElement | null = null;
  readonly products = signal<Product[]>([]);
  readonly kitchenOnly = computed(() => {
    const roles = this.auth.currentUser()?.roles ?? [];
    return roles.includes('KITCHEN') && !roles.some((role) => role === 'OWNER' || role === 'ADMIN');
  });
  readonly activeFilter = signal<OrderFilter>('ALL');
  readonly visibleOrders = computed(() => this.orders().filter((order) => this.matchesFilter(order, this.activeFilter())));
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editingOrder = signal<RestaurantOrder | null>(null);
  readonly cancelOpen = signal(false);
  readonly cancelOrder = signal<RestaurantOrder | null>(null);
  readonly cancelItem = signal<OrderItem | null>(null);
  cancelReason = '';
  form: { tabId: number; notes: string; items: OrderItemRequest[] } = { tabId: 0, notes: '', items: [] };
  readonly filters: Array<{ value: OrderFilter; label: string }> = [
    { value: 'ALL', label: 'Todos' },
    { value: 'WAITING_PAYMENT', label: 'Aguardando pagamento' },
    { value: 'IN_PREPARATION', label: 'Em preparo' },
    { value: 'READY', label: 'Prontos' },
    { value: 'DELIVERED', label: 'Entregues' },
    { value: 'CANCELLED', label: 'Cancelados' },
    { value: 'TABLE', label: 'Mesa' },
    { value: 'COUNTER', label: 'Balcão' },
  ];

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const restricted = this.kitchenOnly();
    forkJoin({
      orders: restricted ? this.api.getPreparationQueue() : this.api.getAll(),
      tabs: restricted ? of([] as Tab[]) : this.tabApi.getOpen(),
      counterSales: restricted ? of([] as CounterSaleSummary[]) : this.tabApi.getActiveCounterSales(),
      products: restricted ? of([] as Product[]) : this.productApi.getAll(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ orders, tabs, counterSales, products }) => {
        this.orders.set(orders);
        this.tabs.set(tabs);
        this.counterSales.set(counterSales);
        this.products.set(products.filter(isCatalogProductSellable));
      },
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  get tableTabs(): Tab[] { return this.tabs().filter((tab) => tab.type === 'TABLE'); }

  @HostListener('document:click') onDocumentClick(): void { this.closeActionMenu(); }
  @HostListener('document:keydown', ['$event']) onDocumentKeydown(event: KeyboardEvent): void { if (event.key === 'Escape') this.closeActionMenu(); }
  @HostListener('window:resize') onResize(): void { this.repositionActionMenu(); }
  @HostListener('window:scroll') onScroll(): void { this.repositionActionMenu(); }

  toggleActionMenu(order: RestaurantOrder, event: MouseEvent): void {
    event.stopPropagation();
    if (this.actionMenuOrderId() === order.id) { this.closeActionMenu(); return; }
    this.actionMenuTrigger = event.currentTarget as HTMLElement;
    this.actionMenuPosition.set({ left: -9999, top: -9999, maxHeight: 9999, placement: 'bottom' });
    this.actionMenuOrder.set(order);
    this.actionMenuOrderId.set(order.id);
    requestAnimationFrame(() => {
      this.repositionActionMenu();
      this.document.querySelector<HTMLButtonElement>('.order-action-menu button')?.focus();
    });
  }

  closeActionMenu(): void {
    this.actionMenuOrder.set(null);
    this.actionMenuOrderId.set(null);
    this.actionMenuTrigger = null;
  }

  onActionMenuKeydown(event: KeyboardEvent): void {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') { this.closeActionMenu(); return; }
    const menu = (event.target as HTMLElement).closest<HTMLElement>('.order-action-menu');
    const items = Array.from(menu?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    if (!items.length) return;
    const current = Math.max(0, items.indexOf(event.target as HTMLButtonElement));
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  openCreate(): void { if (!this.auth.currentUser()) { this.feedback.error('Faça login antes de criar o pedido.'); return; } if (!this.tableTabs.length) { this.feedback.info('Abra uma comanda de mesa antes de criar um pedido.'); return; } if (!this.products().length) { this.feedback.info('Não há produtos disponíveis.'); return; } this.editingOrder.set(null); this.form = { tabId: this.tableTabs[0].id, notes: '', items: [this.emptyItem()] }; this.formOpen.set(true); }
  openEdit(order: RestaurantOrder): void { this.editingOrder.set(order); this.form = { tabId: order.tabId, notes: order.notes ?? '', items: order.items.filter((item) => item.status === 'DRAFT').map((item) => ({ productId: item.productId, variantId: item.variantId ?? 0, quantity: item.quantity, notes: item.notes, optionIds: item.options.map((option) => option.optionId).filter((id): id is number => id != null) })) }; if (!this.form.items.length) this.form.items = [this.emptyItem()]; this.formOpen.set(true); }
  closeForm(): void { if (!this.saving()) this.formOpen.set(false); }
  addItem(): void { this.form.items.push(this.emptyItem()); }
  removeItem(index: number): void { if (this.form.items.length > 1) this.form.items.splice(index, 1); }
  saveDraft(): void { if (!this.form.tabId || this.form.items.some((item) => !item.productId || !item.variantId || item.quantity < 1 || !this.validSelections(item))) { this.feedback.error('Revise os produtos, variações e escolhas obrigatórias.'); return; } this.saving.set(true); const payload = { tabId: this.form.tabId, type: 'TABLE' as const, notes: this.form.notes.trim() || null, items: this.form.items }; const current = this.editingOrder(); const operation = current ? this.api.updateDraft(current.id, payload) : this.api.create(payload); operation.pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { this.feedback.success('Rascunho salvo. Revise e confirme o pedido.'); this.formOpen.set(false); this.load(); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  confirm(order: RestaurantOrder): void { this.api.confirm(order.id).subscribe({ next: () => { this.feedback.success('Pedido confirmado.'); this.load(); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  markReady(order: RestaurantOrder, item: OrderItem): void {
    this.api.updateItemStatus(order.id, item.id, 'READY').subscribe({
      next: () => { this.feedback.success('Item marcado como pronto.'); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }
  deliverItem(order: RestaurantOrder, item: OrderItem): void {
    this.api.updateItemStatus(order.id, item.id, 'DELIVERED').subscribe({
      next: () => { this.feedback.success('Item marcado como entregue.'); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  openCancelOrder(order: RestaurantOrder): void { this.cancelOrder.set(order); this.cancelItem.set(null); this.cancelReason = ''; this.cancelOpen.set(true); }
  openCancelItem(order: RestaurantOrder, item: OrderItem): void { this.cancelOrder.set(order); this.cancelItem.set(item); this.cancelReason = ''; this.cancelOpen.set(true); }
  closeCancel(): void { if (!this.saving()) this.cancelOpen.set(false); }
  confirmCancellation(): void { const order = this.cancelOrder(); const item = this.cancelItem(); const reason = this.cancelReason.trim(); if (!order || !reason) { this.feedback.error('Informe o motivo do cancelamento.'); return; } this.saving.set(true); const operation = item ? this.api.cancelItem(order.id, item.id, reason) : this.api.cancel(order.id, reason); operation.pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { this.feedback.success(item ? 'Item cancelado.' : 'Pedido cancelado.'); this.cancelOpen.set(false); this.load(); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }

  canEdit(order: RestaurantOrder): boolean { return !this.kitchenOnly() && order.tabType !== 'COUNTER' && order.status === 'CREATED' && this.effectiveTabStatus(order) === 'OPEN'; }
  canCancel(order: RestaurantOrder): boolean {
    if (this.kitchenOnly() || order.status === 'DELIVERED' || order.status === 'CANCELLED' || this.effectiveTabStatus(order) !== 'OPEN') return false;
    const tab = this.tabs().find((candidate) => candidate.id === order.tabId);
    if ((tab?.paidAmount ?? 0) > 0) return false;
    if (order.tabType === 'COUNTER') return this.counterSummary(order)?.cancellationAllowed ?? false;
    return true;
  }
  canCancelItem(order: RestaurantOrder, item: OrderItem): boolean { return this.canCancel(order) && item.status !== 'CANCELED' && item.status !== 'DELIVERED'; }
  canMarkReady(item: OrderItem): boolean { return item.preparationFlow === 'REQUIRES_PREPARATION' && item.status === 'IN_PREPARATION'; }
  canDeliverItem(order: RestaurantOrder, item: OrderItem): boolean { return !this.kitchenOnly() && item.status === 'READY' && this.effectiveTabStatus(order) === 'OPEN' && (order.tabType !== 'COUNTER' || (this.counterSummary(order)?.remainingAmount ?? 1) === 0); }
  orderStateMessage(order: RestaurantOrder): string | null { if (this.isWaitingPayment(order)) return 'Aguardando pagamento'; if (order.tabType === 'TABLE' && this.tableRemaining(order) === 0 && order.status === 'DELIVERED' && this.effectiveTabStatus(order) === 'OPEN') return 'Pronta para fechar'; if (order.status === 'CREATED') return 'Aguardando confirmação'; if (order.status === 'DELIVERED') return 'Pedido entregue'; if (order.status === 'CANCELLED') return 'Pedido cancelado'; if (this.effectiveTabStatus(order) !== 'OPEN') return 'Comanda encerrada'; return null; }
  effectiveTabStatus(order: RestaurantOrder): TabStatus { return order.tabStatus ?? 'OPEN'; }
  orderTotal(order: RestaurantOrder): number { return order.items.filter((item) => item.status !== 'CANCELED').reduce((total, item) => total + item.subtotal, 0); }
  tabStatusLabel(status: TabStatus): string { return { OPEN: 'Aberta', CLOSED: 'Fechada', CANCELLED: 'Cancelada' }[status]; }
  statusLabel(order: RestaurantOrder): string { if (this.isWaitingPayment(order)) return 'Aguardando pagamento'; return { CREATED: 'Rascunho', SENT_TO_KITCHEN: 'Aguardando preparo', PREPARING: 'Em preparo', READY: 'Pronto', DELIVERED: 'Entregue', CANCELLED: 'Cancelado' }[order.status]; }
  statusTone(status: OrderStatus): string { return { CREATED: 'neutral', SENT_TO_KITCHEN: 'info', PREPARING: 'warning', READY: 'success', DELIVERED: 'success', CANCELLED: 'danger' }[status]; }
  itemStatusLabel(order: RestaurantOrder, item: OrderItem): string { if (item.status === 'WAITING_PREPARATION' && this.isWaitingPayment(order)) return 'Aguardando pagamento'; return { DRAFT: 'Rascunho', WAITING_PREPARATION: 'Aguardando preparo', IN_PREPARATION: 'Em preparo', READY: 'Pronto', DELIVERED: 'Entregue', CANCELED: 'Cancelado' }[item.status]; }
  itemStatusTone(status: OrderItem['status']): string { return { DRAFT: 'neutral', WAITING_PREPARATION: 'info', IN_PREPARATION: 'warning', READY: 'success', DELIVERED: 'success', CANCELED: 'danger' }[status]; }
  counterSummary(order: RestaurantOrder): CounterSaleSummary | null { return order.tabType === 'COUNTER' ? this.counterSales().find((sale) => sale.id === order.tabId) ?? null : null; }
  financialLabel(sale: CounterSaleSummary): string { return ({ UNPAID: 'Não pago', PARTIALLY_PAID: 'Parcialmente pago', PAID: 'Pago', CANCELLED: 'Cancelado' })[sale.financialState]; }
  tableRemaining(order: RestaurantOrder): number { return this.tabs().find((tab) => tab.id === order.tabId)?.remainingAmount ?? 0; }
  filterCount(filter: OrderFilter): number { return this.orders().filter((order) => this.matchesFilter(order, filter)).length; }
  itemGroups(order: RestaurantOrder): Array<{ key: 'PREPARATION' | 'DIRECT'; label: string; items: OrderItem[] }> {
    const visible = this.kitchenOnly() ? order.items.filter((item) => item.preparationFlow === 'REQUIRES_PREPARATION') : order.items;
    return [
      { key: 'PREPARATION', label: 'Itens de preparo', items: visible.filter((item) => item.preparationFlow === 'REQUIRES_PREPARATION') },
      { key: 'DIRECT', label: 'Entrega direta', items: visible.filter((item) => item.preparationFlow === 'DIRECT_SERVICE') },
    ];
  }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }

  private repositionActionMenu(): void {
    const trigger = this.actionMenuTrigger;
    const view = this.document.defaultView;
    const menu = this.document.querySelector<HTMLElement>('.order-action-menu');
    if (!trigger || !view || !menu) return;
    this.actionMenuPosition.set(calculateOverlayPosition(trigger.getBoundingClientRect(), menu.getBoundingClientRect(), view.innerWidth, view.innerHeight));
  }
  private isWaitingPayment(order: RestaurantOrder): boolean { const sale = this.counterSummary(order); return order.tabType === 'COUNTER' && (sale?.remainingAmount ?? 0) > 0 && order.items.some((item) => item.status === 'WAITING_PREPARATION'); }
  private matchesFilter(order: RestaurantOrder, filter: OrderFilter): boolean {
    if (filter === 'ALL') return true;
    if (filter === 'TABLE' || filter === 'COUNTER') return order.tabType === filter;
    if (filter === 'WAITING_PAYMENT') return this.isWaitingPayment(order);
    if (filter === 'IN_PREPARATION') return order.items.some((item) => item.status === 'IN_PREPARATION');
    if (filter === 'READY') return order.items.some((item) => item.status === 'READY');
    if (filter === 'DELIVERED') return order.status === 'DELIVERED';
    return order.status === 'CANCELLED';
  }
  activeVariants(productId: number): ProductVariant[] { return sellableVariants(this.products().find((product) => product.id === productId)); }
  selectedVariant(item: OrderItemRequest): ProductVariant | null { return this.activeVariants(item.productId).find((variant) => variant.id === item.variantId) ?? null; }
  optionGroups(productId: number): ProductOptionGroup[] { return this.products().find((product) => product.id === productId)?.optionGroups.filter((group) => group.active) ?? []; }
  activeOptions(group: ProductOptionGroup) { return group.options.filter((option) => option.active); }
  onProductChange(item: OrderItemRequest, productId: number): void { item.productId = productId; item.optionIds = []; item.variantId = automaticVariantId(this.products().find((product) => product.id === productId)); }
  toggleOption(item: OrderItemRequest, group: ProductOptionGroup, optionId: number): void { const groupOptionIds = new Set(group.options.map((option) => option.id)); const selectedInGroup = item.optionIds.filter((id) => groupOptionIds.has(id)); if (item.optionIds.includes(optionId)) { item.optionIds = item.optionIds.filter((id) => id !== optionId); return; } if (group.maximumSelections === 1) item.optionIds = item.optionIds.filter((id) => !groupOptionIds.has(id)); else if (selectedInGroup.length >= group.maximumSelections) { this.feedback.info(`Escolha no máximo ${group.maximumSelections} opção(ões) em ${group.name}.`); return; } item.optionIds.push(optionId); }
  priceSummary(product: Product): string { return priceRangeSummary(product.minimumVariantPrice, product.maximumVariantPrice, (value) => this.currency(value), true); }
  variantLabel(variant: ProductVariant): string { return operationalVariantLabel(variant.name); }
  private validSelections(item: OrderItemRequest): boolean { return optionSelectionsAreValid(this.optionGroups(item.productId), item.optionIds); }
  private emptyItem(): OrderItemRequest { return { productId: 0, variantId: 0, quantity: 1, notes: '', optionIds: [] }; }
}
