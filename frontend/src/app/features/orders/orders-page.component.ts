import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import { OrderItemRequest, OrderStatus, RestaurantOrder } from '../../shared/models/order.model';
import { Product } from '../../shared/models/product.model';
import { Tab, TabStatus } from '../../shared/models/tab.model';
import { User } from '../../shared/models/user.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, PageHeaderComponent, SectionCardComponent, StatusBadgeComponent],
  template: `
    <app-page-header kicker="Pedidos" title="Pedidos" description="Crie pedidos, acompanhe itens congelados e envie a produção para a cozinha.">
      <button type="button" class="primary-button" (click)="openForm()"><i class="pi pi-shopping-cart"></i>Novo pedido</button>
    </app-page-header>

    <app-section-card eyebrow="Fluxo de venda" title="Pedidos do turno">
      @if (loading()) {
        <div class="loading-grid">@for (item of [1,2,3,4]; track item) { <div class="loading-row"></div> }</div>
      } @else if (error()) {
        <div class="error-panel"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar</strong><p>{{ error() }}</p></div>
          <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button>
        </div>
      } @else if (orders().length === 0) {
        <app-empty-state icon="pi pi-shopping-cart" title="Nenhum pedido criado" description="Abra uma comanda e registre o primeiro pedido." />
      } @else {
        <div class="order-list">
          @for (order of orders(); track order.id) {
            <article class="order-card">
              <div class="order-card-head">
                <div>
                  <span>Pedido #{{ order.id }}</span>
                  <strong>Mesa {{ order.tableNumber }}</strong>
                  <small>Comanda #{{ order.tabId }} · {{ tabStatusLabel(effectiveTabStatus(order)) }}</small>
                </div>
                <app-status-badge [label]="statusLabel(order.status)" [tone]="statusTone(order.status)" />
              </div>
              <div class="order-item-list">
                @for (item of order.items; track item.id) {
                  <div><span>{{ item.quantity }}x {{ item.productNameSnapshot }}</span><b>{{ currency(item.subtotal) }}</b></div>
                }
              </div>
              @if (order.notes) { <p class="order-notes">{{ order.notes }}</p> }
              <div class="order-card-footer">
                <strong>{{ currency(orderTotal(order)) }}</strong>
                <div class="action-cluster">
                  @if (canSendToKitchen(order)) {
                    <button type="button" class="primary-button compact-button" (click)="send(order)"><i class="pi pi-send"></i>Enviar à cozinha</button>
                  }
                  @if (canCancel(order)) {
                    <button type="button" class="danger-button compact-button" (click)="cancel(order)"><i class="pi pi-times"></i>Cancelar pedido</button>
                  }
                  @if (orderStateMessage(order); as message) {
                    <span class="order-state-note" [class.blocked]="effectiveTabStatus(order) !== 'OPEN'">
                      <i [class]="orderStateIcon(order)"></i>
                      {{ message }}
                    </span>
                  }
                </div>
              </div>
            </article>
          }
        </div>
      }
    </app-section-card>

    @if (formOpen()) {
      <div class="modal-backdrop" (click)="formOpen.set(false)">
        <form class="modal-panel wide" (click)="$event.stopPropagation()" (ngSubmit)="create()">
          <div class="modal-header">
            <div><span>Venda</span><h2>Novo pedido</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="formOpen.set(false)"><i class="pi pi-times"></i></button>
          </div>
          <div class="form-grid">
            <label class="field full">
              <span>Comanda aberta</span>
              <select name="tabId" [(ngModel)]="form.tabId" required>
                @for (tab of tabs(); track tab.id) { <option [ngValue]="tab.id">#{{ tab.id }} · Mesa {{ tab.tableNumber }}</option> }
              </select>
            </label>
            <label class="field full"><span>Observação geral</span><textarea name="notes" [(ngModel)]="form.notes" maxlength="500"></textarea></label>
          </div>
          <div class="form-section-title"><div><span>Itens do pedido</span><small>Nome e preço serão congelados pelo backend.</small></div>
            <button type="button" class="ghost-button compact-button" (click)="addItem()"><i class="pi pi-plus"></i>Adicionar item</button>
          </div>
          <div class="order-form-items">
            @for (item of form.items; track $index; let index = $index) {
              <div class="order-form-row">
                <label class="field">
                  <span>Produto</span>
                  <select [name]="'product-' + index" [(ngModel)]="item.productId">
                    <option [ngValue]="0" disabled>Selecione</option>
                    @for (product of products(); track product.id) { <option [ngValue]="product.id">{{ product.name }} · {{ currency(product.price) }}</option> }
                  </select>
                </label>
                <label class="field quantity-field"><span>Qtd.</span><input [name]="'quantity-' + index" type="number" min="1" [(ngModel)]="item.quantity" /></label>
                <label class="field"><span>Observação</span><input [name]="'notes-' + index" [(ngModel)]="item.notes" /></label>
                <button type="button" class="icon-button danger-icon" title="Remover item" (click)="removeItem(index)"><i class="pi pi-trash"></i></button>
              </div>
            }
          </div>
          <div class="modal-actions">
            <button type="button" class="ghost-button" (click)="formOpen.set(false)">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-check"></i>{{ saving() ? 'Criando...' : 'Criar pedido' }}</button>
          </div>
        </form>
      </div>
    }
  `,
})
export class OrdersPageComponent implements OnInit {
  private readonly api = inject(OrderApiService);
  private readonly tabApi = inject(TabApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly userApi = inject(UserApiService);
  private readonly feedback = inject(FeedbackService);

  readonly orders = signal<RestaurantOrder[]>([]);
  readonly tabs = signal<Tab[]>([]);
  readonly products = signal<Product[]>([]);
  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  form: { tabId: number; notes: string; items: OrderItemRequest[] } = { tabId: 0, notes: '', items: [] };

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ orders: this.api.getAll(), tabs: this.tabApi.getOpen(), products: this.productApi.getAll(), users: this.userApi.getAll() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ orders, tabs, products, users }) => {
          this.orders.set(orders);
          this.tabs.set(tabs);
          this.products.set(products.filter((product) => product.active));
          this.users.set(users.filter((user) => user.active));
        },
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  openForm(): void {
    if (!this.tabs().length) { this.feedback.info('Abra uma comanda antes de criar um pedido.'); return; }
    if (!this.products().length) { this.feedback.info('Não há produtos ativos disponíveis.'); return; }
    this.form = { tabId: this.tabs()[0].id, notes: '', items: [this.emptyItem()] };
    this.formOpen.set(true);
  }

  addItem(): void { this.form.items.push(this.emptyItem()); }
  removeItem(index: number): void { if (this.form.items.length > 1) this.form.items.splice(index, 1); }

  create(): void {
    const user = this.users()[0];
    if (!user || !this.form.tabId || this.form.items.some((item) => !item.productId || item.quantity < 1)) {
      this.feedback.error('Selecione a comanda e preencha todos os itens.');
      return;
    }
    this.saving.set(true);
    this.api.create({ tabId: this.form.tabId, createdByUserId: user.id, type: 'TABLE', notes: this.form.notes, items: this.form.items })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => { this.feedback.success('Pedido criado com sucesso.'); this.formOpen.set(false); this.load(); },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  send(order: RestaurantOrder): void {
    this.api.sendToKitchen(order.id).subscribe({
      next: () => { this.feedback.success('Pedido enviado para a cozinha.'); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  cancel(order: RestaurantOrder): void {
    this.api.cancel(order.id).subscribe({
      next: () => { this.feedback.success('Pedido cancelado com sucesso.'); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  canSendToKitchen(order: RestaurantOrder): boolean {
    return order.status === 'CREATED' && this.effectiveTabStatus(order) === 'OPEN';
  }

  canCancel(order: RestaurantOrder): boolean {
    return order.status !== 'DELIVERED'
      && order.status !== 'CANCELLED'
      && this.effectiveTabStatus(order) !== 'CLOSED';
  }

  orderStateMessage(order: RestaurantOrder): string | null {
    if (order.status === 'DELIVERED') return 'Pedido entregue';
    if (order.status === 'CANCELLED') return 'Pedido cancelado';
    if (this.effectiveTabStatus(order) === 'CANCELLED') return 'Comanda cancelada: cancele este pedido para regularizar o registro.';
    if (this.effectiveTabStatus(order) === 'CLOSED') return 'Comanda fechada: nenhuma ação está disponível.';
    return null;
  }

  effectiveTabStatus(order: RestaurantOrder): TabStatus {
    return order.tabStatus ?? 'OPEN';
  }

  orderStateIcon(order: RestaurantOrder): string {
    if (order.status === 'DELIVERED') return 'pi pi-check-circle';
    if (order.status === 'CANCELLED') return 'pi pi-ban';
    return 'pi pi-exclamation-triangle';
  }

  orderTotal(order: RestaurantOrder): number { return order.items.filter((item) => item.status === 'ACTIVE').reduce((total, item) => total + item.subtotal, 0); }
  tabStatusLabel(status: TabStatus): string { return { OPEN: 'Aberta', CLOSED: 'Fechada', CANCELLED: 'Cancelada' }[status]; }
  statusLabel(status: OrderStatus): string { return { CREATED: 'Criado', SENT_TO_KITCHEN: 'Recebido', PREPARING: 'Preparando', READY: 'Pronto', DELIVERED: 'Entregue', CANCELLED: 'Cancelado' }[status]; }
  statusTone(status: OrderStatus): string { return { CREATED: 'info', SENT_TO_KITCHEN: 'info', PREPARING: 'warning', READY: 'success', DELIVERED: 'success', CANCELLED: 'danger' }[status]; }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  private emptyItem(): OrderItemRequest { return { productId: 0, quantity: 1, notes: '' }; }
}
