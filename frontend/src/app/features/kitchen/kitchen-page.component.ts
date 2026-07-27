import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, exhaustMap, finalize, interval, map, merge, of, Subject } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { OrderItem, OrderItemStatus, RestaurantOrder } from '../../shared/models/order.model';
import { apiErrorMessage } from '../../shared/util/api-error';

@Component({
  selector: 'app-kitchen-page',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header kicker="Produção" title="Cozinha" description="A fila mostra somente itens que realmente exigem preparo.">
      <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Atualizar</button>
    </app-page-header>

    @if (loading()) {
      <section class="kitchen-kanban">@for (item of [1,2,3]; track item) { <div class="kanban-column loading-card"></div> }</section>
    } @else if (error()) {
      <div class="error-panel"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar</strong><p>{{ error() }}</p></div><button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button></div>
    } @else {
      <section class="kitchen-kanban">
        @for (column of columns; track column.status) {
          <article class="kanban-column">
            <div class="kanban-header"><div><span>{{ column.label }}</span><strong>{{ countItems(column.status) }}</strong></div><i [class]="column.icon"></i></div>
            <div class="kanban-list">
              @for (order of ordersByItemStatus(column.status); track order.id) {
                <article class="kitchen-order-card" [class.urgent]="elapsedMinutes(order.createdAt) > 25" [class.blocked]="effectiveTabStatus(order) !== 'OPEN'">
                  <div class="kitchen-order-top"><strong>#{{ order.id }} · Mesa {{ order.tableNumber }}</strong><app-status-badge [label]="elapsed(order.createdAt)" [tone]="elapsedMinutes(order.createdAt) > 25 ? 'danger' : 'info'" /></div>
                  <div class="preparation-item-list">
                    @for (item of itemsByStatus(order, column.status); track item.id) {
                      <article class="preparation-item">
                        <div><strong>{{ item.quantity }}x {{ item.displayNameSnapshot }}</strong>@for (option of item.options; track option.id) { <small>{{ option.groupName }}: {{ option.optionName }}</small> }@if (item.notes) { <small>Observação: {{ item.notes }}</small> }</div>
                        @if (column.status !== 'READY') { <button type="button" class="primary-button compact-button" [disabled]="effectiveTabStatus(order) !== 'OPEN'" (click)="advanceItem(order, item)"><i [class]="column.actionIcon"></i>{{ column.actionLabel }}</button> }
                      </article>
                    }
                  </div>
                  @if (column.status === 'READY') { <button type="button" class="primary-button kitchen-action" [disabled]="order.status !== 'READY' || effectiveTabStatus(order) !== 'OPEN'" [title]="order.status === 'READY' ? 'Marcar pedido entregue' : 'Aguardando outros itens do pedido'" (click)="deliver(order)"><i class="pi pi-send"></i>{{ order.status === 'READY' ? 'Marcar entregue' : 'Aguardando outros itens' }}</button> }
                </article>
              } @empty { <app-empty-state icon="pi pi-check" title="Fila vazia" description="Nenhum item nesta etapa." /> }
            </div>
          </article>
        }
      </section>
    }
  `,
})
export class KitchenPageComponent implements OnInit {
  private readonly api = inject(OrderApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequests = new Subject<boolean>();
  private hasLoaded = false;
  readonly feedback = inject(FeedbackService);
  readonly orders = signal<RestaurantOrder[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly columns: Array<{ status: OrderItemStatus; label: string; icon: string; actionLabel: string; actionIcon: string }> = [
    { status: 'WAITING_PREPARATION', label: 'Recebidos', icon: 'pi pi-inbox', actionLabel: 'Iniciar', actionIcon: 'pi pi-play' },
    { status: 'IN_PREPARATION', label: 'Preparando', icon: 'pi pi-cog', actionLabel: 'Marcar pronto', actionIcon: 'pi pi-check' },
    { status: 'READY', label: 'Prontos', icon: 'pi pi-check-circle', actionLabel: 'Entregar', actionIcon: 'pi pi-send' },
  ];

  ngOnInit(): void {
    merge(of(true), interval(15_000).pipe(map(() => false)), this.refreshRequests)
      .pipe(
        exhaustMap((showLoading) => {
          if (showLoading && !this.hasLoaded) this.loading.set(true);
          if (!this.hasLoaded) this.error.set(null);
          return this.api.getPreparationQueue().pipe(catchError((error) => { if (!this.hasLoaded) this.error.set(apiErrorMessage(error)); return EMPTY; }), finalize(() => this.loading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((orders) => { this.orders.set(orders); this.error.set(null); this.hasLoaded = true; });
  }

  load(): void { this.refreshRequests.next(true); }
  itemsByStatus(order: RestaurantOrder, status: OrderItemStatus): OrderItem[] { return order.items.filter((item) => item.status === status); }
  ordersByItemStatus(status: OrderItemStatus): RestaurantOrder[] { return this.orders().filter((order) => this.itemsByStatus(order, status).length > 0); }
  countItems(status: OrderItemStatus): number { return this.orders().reduce((total, order) => total + this.itemsByStatus(order, status).length, 0); }
  advanceItem(order: RestaurantOrder, item: OrderItem): void { const next = item.status === 'WAITING_PREPARATION' ? 'IN_PREPARATION' : item.status === 'IN_PREPARATION' ? 'READY' : null; if (!next) return; this.api.updateItemStatus(order.id, item.id, next).subscribe({ next: () => { this.feedback.success('Etapa atualizada.'); this.load(); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  deliver(order: RestaurantOrder): void { if (order.status !== 'READY') return; this.api.updateStatus(order.id, 'DELIVERED').subscribe({ next: () => { this.feedback.success('Pedido entregue.'); this.load(); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  effectiveTabStatus(order: RestaurantOrder): 'OPEN' | 'CLOSED' | 'CANCELLED' { return order.tabStatus ?? 'OPEN'; }
  elapsedMinutes(value: string): number { return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); }
  elapsed(value: string): string { const minutes = this.elapsedMinutes(value); return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`; }
}
