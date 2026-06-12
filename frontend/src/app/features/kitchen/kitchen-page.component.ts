import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, exhaustMap, finalize, interval, map, merge, of, Subject } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { OrderStatus, RestaurantOrder } from '../../shared/models/order.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-kitchen-page',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header kicker="Produção" title="Cozinha" description="Kanban real de pedidos recebidos, em preparo e prontos.">
      <button
        type="button"
        class="ghost-button future-action"
        disabled
        title="Modo chamada fica disponível após o MVP"
      >
        <i class="pi pi-volume-up"></i>Modo chamada · em breve
      </button>
    </app-page-header>

    @if (loading()) {
      <section class="kitchen-kanban">@for (item of [1,2,3]; track item) { <div class="kanban-column loading-card"></div> }</section>
    } @else if (error()) {
      <div class="error-panel"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar</strong><p>{{ error() }}</p></div>
        <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button>
      </div>
    } @else {
      <section class="kitchen-kanban">
        @for (column of columns; track column.status) {
          <article class="kanban-column">
            <div class="kanban-header">
              <div><span>{{ column.label }}</span><strong>{{ ordersByStatus(column.status).length }}</strong></div>
              <i [class]="column.icon"></i>
            </div>
            <div class="kanban-list">
              @for (order of ordersByStatus(column.status); track order.id) {
                <article
                  class="kitchen-order-card"
                  [class.urgent]="elapsedMinutes(order.createdAt) > 25"
                  [class.blocked]="effectiveTabStatus(order) !== 'OPEN'"
                >
                  <div class="kitchen-order-top">
                    <strong>#{{ order.id }} · Mesa {{ order.tableNumber }}</strong>
                    <app-status-badge [label]="elapsed(order.createdAt)" [tone]="elapsedMinutes(order.createdAt) > 25 ? 'danger' : 'info'" />
                  </div>
                  <div class="kitchen-items">
                    @for (item of order.items; track item.id) { <span>{{ item.quantity }}x {{ item.productNameSnapshot }}</span> }
                  </div>
                  @if (order.notes) { <p>{{ order.notes }}</p> }
                  @if (effectiveTabStatus(order) !== 'OPEN') {
                    <p class="kitchen-blocked-note">
                      <i class="pi pi-exclamation-triangle"></i>
                      Comanda {{ effectiveTabStatus(order) === 'CANCELLED' ? 'cancelada' : 'fechada' }}
                    </p>
                  }
                  <button
                    type="button"
                    class="primary-button kitchen-action"
                    [disabled]="!canAdvance(order)"
                    [title]="advanceTitle(order)"
                    (click)="advance(order)"
                  >
                    <i [class]="column.actionIcon"></i>{{ column.actionLabel }}
                  </button>
                </article>
              } @empty {
                <app-empty-state icon="pi pi-check" title="Fila vazia" description="Nenhum pedido nesta etapa." />
              }
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
  readonly columns: Array<{ status: OrderStatus; label: string; icon: string; actionLabel: string; actionIcon: string }> = [
    { status: 'SENT_TO_KITCHEN', label: 'Recebidos', icon: 'pi pi-inbox', actionLabel: 'Iniciar preparo', actionIcon: 'pi pi-play' },
    { status: 'PREPARING', label: 'Preparando', icon: 'pi pi-cog', actionLabel: 'Marcar como pronto', actionIcon: 'pi pi-check' },
    { status: 'READY', label: 'Prontos', icon: 'pi pi-check-circle', actionLabel: 'Marcar como entregue', actionIcon: 'pi pi-send' },
  ];

  ngOnInit(): void {
    merge(
      of(true),
      interval(15_000).pipe(map(() => false)),
      this.refreshRequests,
    )
      .pipe(
        exhaustMap((showLoading) => {
          if (showLoading && !this.hasLoaded) this.loading.set(true);
          if (!this.hasLoaded) this.error.set(null);

          return this.api.getAll().pipe(
            catchError((error) => {
              if (!this.hasLoaded) this.error.set(apiErrorMessage(error));
              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((orders) => {
        this.orders.set(orders);
        this.error.set(null);
        this.hasLoaded = true;
      });
  }

  load(): void {
    this.refreshRequests.next(true);
  }
  ordersByStatus(status: OrderStatus): RestaurantOrder[] { return this.orders().filter((order) => order.status === status); }
  nextOrderStatus(status: OrderStatus): OrderStatus | null {
    return {
      CREATED: 'SENT_TO_KITCHEN',
      SENT_TO_KITCHEN: 'PREPARING',
      PREPARING: 'READY',
      READY: 'DELIVERED',
      DELIVERED: null,
      CANCELLED: null,
    }[status] as OrderStatus | null;
  }
  canAdvance(order: RestaurantOrder): boolean {
    return this.effectiveTabStatus(order) === 'OPEN' && this.nextOrderStatus(order.status) !== null;
  }
  advanceTitle(order: RestaurantOrder): string {
    if (this.effectiveTabStatus(order) === 'CANCELLED') return 'Comanda cancelada';
    if (this.effectiveTabStatus(order) === 'CLOSED') return 'Comanda fechada';
    return this.nextOrderStatus(order.status) ? 'Avançar pedido' : 'Pedido finalizado';
  }
  advance(order: RestaurantOrder): void {
    const next = this.nextOrderStatus(order.status);
    if (!next || this.effectiveTabStatus(order) !== 'OPEN') {
      this.feedback.info(this.advanceTitle(order));
      return;
    }
    this.api.updateStatus(order.id, next).subscribe({
      next: () => { this.feedback.success('Status do pedido atualizado.'); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }
  effectiveTabStatus(order: RestaurantOrder): 'OPEN' | 'CLOSED' | 'CANCELLED' {
    return order.tabStatus ?? 'OPEN';
  }
  elapsedMinutes(value: string): number { return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); }
  elapsed(value: string): string { const minutes = this.elapsedMinutes(value); return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`; }
}
