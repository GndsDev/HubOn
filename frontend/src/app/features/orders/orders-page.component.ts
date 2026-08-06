import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  finalize,
  forkJoin,
} from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import {
  OrderItem,
  OrderStatus,
  RestaurantOrder,
} from '../../shared/models/order.model';
import {
  CounterSaleSummary,
  TabStatus,
} from '../../shared/models/tab.model';
import { apiErrorMessage } from '../../shared/util/api-error';

type OrderFilter =
  | 'ALL'
  | 'DRAFT'
  | 'WAITING_PAYMENT'
  | 'IN_PREPARATION'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'TABLE'
  | 'COUNTER';

interface OrderFilterOption {
  value: OrderFilter;
  label: string;
}

interface OrderItemGroup {
  key: 'PREPARATION' | 'DIRECT';
  label: string;
  items: OrderItem[];
}

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    EmptyStateComponent,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-page-header
      kicker="Consulta"
      title="Histórico de pedidos"
      description="Consulte pedidos de mesa e balcão, seus itens, estados e origem."
    >
      <div
        page-actions
        class="page-header-actions"
      >
        <button
          type="button"
          class="ghost-button"
          [disabled]="loading() || refreshing()"
          (click)="load()"
        >
          <i
            class="pi"
            [class.pi-refresh]="!refreshing()"
            [class.pi-spin]="refreshing()"
            [class.pi-spinner]="refreshing()"
          ></i>

          {{
            refreshing()
              ? 'Atualizando...'
              : 'Atualizar'
          }}
        </button>
      </div>
    </app-page-header>

    <app-section-card
      eyebrow="Consulta"
      title="Pedidos registrados"
    >
      <div
        card-action
        class="segmented-control order-filters"
        aria-label="Filtrar pedidos"
      >
        @for (
          filter of filters;
          track filter.value
        ) {
          <button
            type="button"
            [class.active]="
              activeFilter() === filter.value
            "
            [attr.aria-pressed]="
              activeFilter() === filter.value
            "
            (click)="
              activeFilter.set(filter.value)
            "
          >
            {{ filter.label }}
            <span>
              {{ filterCount(filter.value) }}
            </span>
          </button>
        }
      </div>

      @if (loading()) {
        <div class="loading-grid">
          @for (
            item of [1, 2, 3, 4];
            track item
          ) {
            <div class="loading-row"></div>
          }
        </div>
      } @else if (error()) {
        <div class="error-panel">
          <i class="pi pi-exclamation-triangle"></i>

          <div>
            <strong>
              Não foi possível carregar
            </strong>

            <p>{{ error() }}</p>
          </div>

          <button
            type="button"
            class="ghost-button"
            (click)="load()"
          >
            <i class="pi pi-refresh"></i>
            Tentar novamente
          </button>
        </div>
      } @else if (
        visibleOrders().length === 0
      ) {
        <app-empty-state
          icon="pi pi-history"
          title="Nenhum pedido neste filtro"
          description="Não há pedidos registrados que correspondam ao filtro selecionado."
        />
      } @else {
        @if (refreshing()) {
          <p
            class="order-state-note tab-wide-note"
            aria-live="polite"
          >
            <i class="pi pi-spin pi-spinner"></i>

            Atualizando os pedidos sem
            interromper a consulta.
          </p>
        }

        <div class="order-list">
          @for (
            order of visibleOrders();
            track order.id
          ) {
            <article class="order-card">
              <div class="order-card-head">
                <div>
                  <span>
                    Pedido #{{ order.id }} ·
                    {{
                      order.tabType === 'COUNTER'
                        ? 'Balcão'
                        : 'Mesa'
                    }}
                  </span>

                  <strong>
                    {{ order.tabDisplayLabel }}
                  </strong>

                  <small>
                    Comanda #{{ order.tabId }} ·
                    {{
                      tabStatusLabel(
                        effectiveTabStatus(order)
                      )
                    }}
                  </small>

                  @if (
                    counterSummary(order);
                    as sale
                  ) {
                    <small>
                      Financeiro:
                      {{ financialLabel(sale) }} ·
                      Restante
                      {{
                        currency(
                          sale.remainingAmount
                        )
                      }}
                    </small>
                  }
                </div>

                <app-status-badge
                  [label]="statusLabel(order)"
                  [tone]="
                    statusTone(order.status)
                  "
                />
              </div>

              @for (
                group of itemGroups(order);
                track group.key
              ) {
                @if (group.items.length > 0) {
                  <section
                    class="order-flow-group"
                  >
                    <h3>
                      <i
                        [class]="
                          group.key ===
                          'PREPARATION'
                            ? 'pi pi-clock'
                            : 'pi pi-bolt'
                        "
                      ></i>

                      {{ group.label }}
                    </h3>

                    <div
                      class="order-item-list detailed-order-items"
                    >
                      @for (
                        item of group.items;
                        track item.id
                      ) {
                        <div
                          class="detailed-order-item"
                          [class.cancelled]="
                            item.status ===
                            'CANCELED'
                          "
                        >
                          <div>
                            <span>
                              {{ item.quantity }}x
                              {{
                                item.displayNameSnapshot ||
                                  item.productNameSnapshot
                              }}
                            </span>

                            @for (
                              option of item.options;
                              track option.id
                            ) {
                              <small>
                                {{ option.groupName }}:
                                {{ option.optionName }}
                              </small>
                            }

                            @if (item.notes) {
                              <small>
                                Observação:
                                {{ item.notes }}
                              </small>
                            }

                            @if (
                              item.cancellationReason
                            ) {
                              <small>
                                Cancelado:
                                {{
                                  item.cancellationReason
                                }}
                              </small>
                            }
                          </div>

                          <div
                            class="order-item-side"
                          >
                            <app-status-badge
                              [label]="
                                itemStatusLabel(
                                  order,
                                  item
                                )
                              "
                              [tone]="
                                itemStatusTone(
                                  item.status
                                )
                              "
                            />

                            <b>
                              {{
                                currency(
                                  item.subtotal
                                )
                              }}
                            </b>
                          </div>
                        </div>
                      }
                    </div>
                  </section>
                }
              }

              @if (order.notes) {
                <p class="order-notes">
                  Observação geral:
                  {{ order.notes }}
                </p>
              }

              @if (
                order.cancellationReason
              ) {
                <p class="order-notes">
                  Motivo do cancelamento:
                  {{ order.cancellationReason }}
                </p>
              }

              <div class="order-card-footer">
                <strong>
                  {{
                    currency(
                      orderTotal(order)
                    )
                  }}
                </strong>

                <div class="action-cluster">
                  @if (
                    order.tabType === 'COUNTER'
                  ) {
                    <a
                      class="ghost-button compact-button"
                      [routerLink]="[
                        '/balcao',
                        order.tabId
                      ]"
                    >
                      <i
                        class="pi pi-shopping-bag"
                      ></i>

                      Ver atendimento
                    </a>
                  }

                  @if (
                    order.tabType === 'TABLE'
                  ) {
                    <a
                      class="ghost-button compact-button"
                      [routerLink]="[
                        '/comandas',
                        order.tabId
                      ]"
                    >
                      <i
                        class="pi pi-receipt"
                      ></i>

                      Ver comanda
                    </a>
                  }

                  @if (
                    orderStateMessage(order);
                    as message
                  ) {
                    <span
                      class="order-state-note"
                      [class.blocked]="
                        effectiveTabStatus(
                          order
                        ) !== 'OPEN'
                      "
                    >
                      <i
                        class="pi pi-info-circle"
                      ></i>

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
  `,
})
export class OrdersPageComponent
  implements OnInit
{
  private readonly api =
    inject(OrderApiService);

  private readonly tabApi =
    inject(TabApiService);

  private readonly feedback =
    inject(FeedbackService);

  private loadedOnce = false;

  readonly orders =
    signal<RestaurantOrder[]>([]);

  readonly counterSales =
    signal<CounterSaleSummary[]>([]);

  readonly loading = signal(false);
  readonly refreshing = signal(false);

  readonly error =
    signal<string | null>(null);

  readonly activeFilter =
    signal<OrderFilter>('ALL');

  readonly visibleOrders = computed(() =>
    this.orders().filter((order) =>
      this.matchesFilter(
        order,
        this.activeFilter(),
      ),
    ),
  );

  readonly filters: OrderFilterOption[] = [
    {
      value: 'ALL',
      label: 'Todos',
    },
    {
      value: 'DRAFT',
      label: 'Rascunhos',
    },
    {
      value: 'WAITING_PAYMENT',
      label: 'Aguardando pagamento',
    },
    {
      value: 'IN_PREPARATION',
      label: 'Em preparo',
    },
    {
      value: 'READY',
      label: 'Prontos',
    },
    {
      value: 'DELIVERED',
      label: 'Entregues',
    },
    {
      value: 'CANCELLED',
      label: 'Cancelados',
    },
    {
      value: 'TABLE',
      label: 'Mesa',
    },
    {
      value: 'COUNTER',
      label: 'Balcão',
    },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (
      this.loading() ||
      this.refreshing()
    ) {
      return;
    }

    const firstLoad = !this.loadedOnce;

    if (firstLoad) {
      this.loading.set(true);
      this.error.set(null);
    } else {
      this.refreshing.set(true);
    }

    forkJoin({
      orders: this.api.getAll(),
      counterSales:
        this.tabApi.getActiveCounterSales(),
    })
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.refreshing.set(false);
        }),
      )
      .subscribe({
        next: ({
          orders,
          counterSales,
        }) => {
          this.orders.set(orders);
          this.counterSales.set(
            counterSales,
          );

          this.error.set(null);
          this.loadedOnce = true;
        },
        error: (error) => {
          const message =
            apiErrorMessage(error);

          if (firstLoad) {
            this.error.set(message);
            return;
          }

          this.feedback.error(
            `${message} Os pedidos exibidos foram mantidos.`,
          );
        },
      });
  }

  effectiveTabStatus(
    order: RestaurantOrder,
  ): TabStatus {
    return order.tabStatus ?? 'OPEN';
  }

  tabStatusLabel(
    status: TabStatus,
  ): string {
    return {
      OPEN: 'Aberta',
      CLOSED: 'Fechada',
      CANCELLED: 'Cancelada',
    }[status];
  }

  statusLabel(
    order: RestaurantOrder,
  ): string {
    if (this.isWaitingPayment(order)) {
      return 'Aguardando pagamento';
    }

    return {
      CREATED: 'Rascunho',
      SENT_TO_KITCHEN:
        'Aguardando preparo',
      PREPARING: 'Em preparo',
      READY: 'Pronto',
      DELIVERED: 'Entregue',
      CANCELLED: 'Cancelado',
    }[order.status];
  }

  statusTone(
    status: OrderStatus,
  ): string {
    return {
      CREATED: 'neutral',
      SENT_TO_KITCHEN: 'info',
      PREPARING: 'warning',
      READY: 'success',
      DELIVERED: 'success',
      CANCELLED: 'danger',
    }[status];
  }

  itemStatusLabel(
    order: RestaurantOrder,
    item: OrderItem,
  ): string {
    if (
      item.status ===
        'WAITING_PREPARATION' &&
      this.isWaitingPayment(order)
    ) {
      return 'Aguardando pagamento';
    }

    return {
      DRAFT: 'Rascunho',
      WAITING_PREPARATION:
        'Aguardando preparo',
      IN_PREPARATION: 'Em preparo',
      READY: 'Pronto',
      DELIVERED: 'Entregue',
      CANCELED: 'Cancelado',
    }[item.status];
  }

  itemStatusTone(
    status: OrderItem['status'],
  ): string {
    return {
      DRAFT: 'neutral',
      WAITING_PREPARATION: 'info',
      IN_PREPARATION: 'warning',
      READY: 'success',
      DELIVERED: 'success',
      CANCELED: 'danger',
    }[status];
  }

  orderStateMessage(
    order: RestaurantOrder,
  ): string | null {
    if (this.isWaitingPayment(order)) {
      return 'Aguardando pagamento antes do preparo';
    }

    if (order.status === 'CREATED') {
      return 'Rascunho ainda não confirmado';
    }

    if (order.status === 'DELIVERED') {
      return 'Pedido concluído';
    }

    if (order.status === 'CANCELLED') {
      return 'Pedido cancelado';
    }

    if (
      this.effectiveTabStatus(order) ===
      'CLOSED'
    ) {
      return 'Comanda encerrada';
    }

    if (
      this.effectiveTabStatus(order) ===
      'CANCELLED'
    ) {
      return 'Comanda cancelada';
    }

    return null;
  }

  counterSummary(
    order: RestaurantOrder,
  ): CounterSaleSummary | null {
    if (order.tabType !== 'COUNTER') {
      return null;
    }

    return (
      this.counterSales().find(
        (sale) =>
          sale.id === order.tabId,
      ) ?? null
    );
  }

  financialLabel(
    sale: CounterSaleSummary,
  ): string {
    return {
      UNPAID: 'Não pago',
      PARTIALLY_PAID:
        'Parcialmente pago',
      PAID: 'Pago',
      CANCELLED: 'Cancelado',
    }[sale.financialState];
  }

  orderTotal(
    order: RestaurantOrder,
  ): number {
    return order.items
      .filter(
        (item) =>
          item.status !== 'CANCELED',
      )
      .reduce(
        (total, item) =>
          total + item.subtotal,
        0,
      );
  }

  itemGroups(
    order: RestaurantOrder,
  ): OrderItemGroup[] {
    return [
      {
        key: 'PREPARATION',
        label: 'Itens de preparo',
        items: order.items.filter(
          (item) =>
            item.preparationFlow ===
            'REQUIRES_PREPARATION',
        ),
      },
      {
        key: 'DIRECT',
        label: 'Entrega direta',
        items: order.items.filter(
          (item) =>
            item.preparationFlow ===
            'DIRECT_SERVICE',
        ),
      },
    ];
  }

  filterCount(
    filter: OrderFilter,
  ): number {
    return this.orders().filter(
      (order) =>
        this.matchesFilter(
          order,
          filter,
        ),
    ).length;
  }

  currency(value: number): string {
    return new Intl.NumberFormat(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL',
      },
    ).format(value ?? 0);
  }

  private isWaitingPayment(
    order: RestaurantOrder,
  ): boolean {
    const sale =
      this.counterSummary(order);

    return (
      order.tabType === 'COUNTER' &&
      (sale?.remainingAmount ?? 0) > 0 &&
      order.items.some(
        (item) =>
          item.status ===
          'WAITING_PREPARATION',
      )
    );
  }

  private matchesFilter(
    order: RestaurantOrder,
    filter: OrderFilter,
  ): boolean {
    switch (filter) {
      case 'ALL':
        return true;

      case 'TABLE':
      case 'COUNTER':
        return order.tabType === filter;

      case 'DRAFT':
        return (
          order.status === 'CREATED' ||
          order.items.some(
            (item) =>
              item.status === 'DRAFT',
          )
        );

      case 'WAITING_PAYMENT':
        return this.isWaitingPayment(
          order,
        );

      case 'IN_PREPARATION':
        return order.items.some(
          (item) =>
            item.status ===
            'IN_PREPARATION',
        );

      case 'READY':
        return order.items.some(
          (item) =>
            item.status === 'READY',
        );

      case 'DELIVERED':
        return (
          order.status === 'DELIVERED'
        );

      case 'CANCELLED':
        return (
          order.status === 'CANCELLED'
        );

      default:
        return true;
    }
  }
}
