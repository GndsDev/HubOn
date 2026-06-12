import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, exhaustMap, finalize, interval, map, merge, of, Subject } from 'rxjs';
import { DashboardApiService } from '../../core/services/dashboard-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { DashboardSummary } from '../../shared/models/dashboard.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent, PageHeaderComponent, SectionCardComponent, StatusBadgeComponent],
  template: `
    <app-page-header kicker="Visão do turno" title="Operação em tempo real" description="Vendas, ocupação, produção e caixa do turno atual.">
      <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Atualizar dados</button>
    </app-page-header>

    @if (loading()) {
      <section class="stats-grid">@for (item of [1,2,3,4]; track item) { <div class="premium-card loading-card"></div> }</section>
    } @else if (error()) {
      <div class="error-panel"><i class="pi pi-exclamation-triangle"></i><div><strong>Dashboard indisponível</strong><p>{{ error() }}</p></div>
        <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button>
      </div>
    } @else if (summary(); as data) {
      <section class="stats-grid">
        @for (metric of metrics(data); track metric.label) {
          <article class="premium-card stat-card" [class]="'tone-' + metric.tone">
            <div class="stat-icon"><i [class]="metric.icon"></i></div>
            <div class="stat-copy"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><p>{{ metric.detail }}</p></div>
            <small>{{ metric.trend }}</small>
          </article>
        }
      </section>

      <section class="dashboard-grid">
        <app-section-card eyebrow="Agora" title="Pedidos recentes">
          <div class="activity-list">
            @for (order of data.recentOrders; track order.id) {
              <article class="activity-row">
                <div class="activity-order">
                  <strong>Pedido #{{ order.id }}</strong>
                  <span>Mesa {{ order.tableNumber }}</span>
                </div>
                <span class="activity-time">{{ dateTime(order.createdAt) }}</span>
                <app-status-badge [label]="orderStatus(order.status)" [tone]="orderTone(order.status)" />
                <strong class="activity-amount">{{ currency(order.amount) }}</strong>
              </article>
            } @empty { <app-empty-state icon="pi pi-shopping-cart" title="Sem pedidos recentes" description="Os novos pedidos aparecerão aqui." /> }
          </div>
        </app-section-card>

        <app-section-card eyebrow="Cardápio" title="Produtos mais vendidos">
          <div class="seller-list">
            @for (product of data.bestSellingProducts; track product.name; let index = $index) {
              <article class="seller-row">
                <span class="seller-rank">{{ index + 1 }}</span>

                <div class="seller-info">
                  <strong>{{ product.name }}</strong>
                  <small>{{ product.category }}</small>
                </div>

                <div class="seller-metrics">
                  <div>
                    <small>Vendidos</small>
                    <strong>{{ product.quantity }} un.</strong>
                  </div>
                  <div>
                    <small>Receita</small>
                    <strong>{{ currency(product.revenue) }}</strong>
                  </div>
                </div>
              </article>
            } @empty { <app-empty-state icon="pi pi-box" title="Sem vendas registradas" description="O ranking será calculado com os pedidos reais." /> }
          </div>
        </app-section-card>

        <app-section-card eyebrow="Salão" title="Status das mesas">
          <div class="table-status-list">
            @for (status of tableStatuses(data); track status.label) {
              <div class="progress-row"><div><span>{{ status.label }}</span><strong>{{ status.value }}/{{ data.tableSummary.total }}</strong></div>
                <div class="progress-track"><span [class]="status.tone" [style.width.%]="data.tableSummary.total ? status.value / data.tableSummary.total * 100 : 0"></span></div>
              </div>
            }
          </div>
        </app-section-card>

        <app-section-card eyebrow="Financeiro" title="Resumo do caixa">
          <div class="cash-summary-list">
            <article><span>Recebido hoje</span><strong>{{ currency(data.cashSummary.received) }}</strong><small>Pagamentos do dia</small></article>
            <article><span>Em aberto</span><strong>{{ currency(data.cashSummary.openAmount) }}</strong><small>{{ data.openTabs }} comandas abertas</small></article>
            <article><span>Cancelamentos</span><strong>{{ currency(data.cashSummary.cancelledAmount) }}</strong><small>Pedidos cancelados hoje</small></article>
          </div>
        </app-section-card>
      </section>
    }
  `,
})
export class DashboardPageComponent implements OnInit {
  private readonly api = inject(DashboardApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequests = new Subject<boolean>();
  readonly feedback = inject(FeedbackService);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  ngOnInit(): void {
    merge(
      of(true),
      interval(30_000).pipe(map(() => false)),
      this.refreshRequests,
    )
      .pipe(
        exhaustMap((showLoading) => {
          if (showLoading && !this.summary()) this.loading.set(true);
          if (!this.summary()) this.error.set(null);

          return this.api.getSummary().pipe(
            catchError((error) => {
              if (!this.summary()) this.error.set(apiErrorMessage(error));
              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((summary) => {
        this.summary.set(summary);
        this.error.set(null);
      });
  }

  load(): void {
    this.refreshRequests.next(true);
  }
  metrics(data: DashboardSummary) {
    return [
      { label: 'Vendas hoje', value: this.currency(data.todaySales), detail: 'Comandas fechadas no dia', icon: 'pi pi-wallet', tone: 'blue', trend: 'dados reais' },
      { label: 'Comandas abertas', value: `${data.openTabs}`, detail: 'Atendimentos em andamento', icon: 'pi pi-receipt', tone: 'purple', trend: `${data.tableSummary.occupied} mesas ocupadas` },
      { label: 'Pedidos em preparo', value: `${data.ordersInPreparation}`, detail: 'Recebidos ou preparando', icon: 'pi pi-send', tone: 'amber', trend: 'cozinha ao vivo' },
      { label: 'Ticket médio', value: this.currency(data.averageTicket), detail: 'Média das comandas fechadas', icon: 'pi pi-chart-line', tone: 'emerald', trend: 'hoje' },
    ];
  }
  tableStatuses(data: DashboardSummary) {
    return [
      { label: 'Livres', value: data.tableSummary.available, tone: 'free' },
      { label: 'Ocupadas', value: data.tableSummary.occupied, tone: 'occupied' },
      { label: 'Reservadas', value: data.tableSummary.reserved, tone: 'reserved' },
      { label: 'Desativadas', value: data.tableSummary.disabled, tone: 'disabled' },
    ];
  }
  orderStatus(status: string): string { return { CREATED: 'Criado', SENT_TO_KITCHEN: 'Recebido', PREPARING: 'Preparando', READY: 'Pronto', DELIVERED: 'Entregue', CANCELLED: 'Cancelado' }[status] || status; }
  orderTone(status: string): string { return status === 'READY' || status === 'DELIVERED' ? 'success' : status === 'PREPARING' ? 'warning' : status === 'CANCELLED' ? 'danger' : 'info'; }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  dateTime(value: string): string { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
}
