import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY, exhaustMap, finalize, interval, map, merge, of, Subject } from 'rxjs';
import { DashboardApiService } from '../../core/services/dashboard-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { DashboardSummary } from '../../shared/models/dashboard.model';
import { apiErrorMessage } from '../../shared/util/api-error';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent, PageHeaderComponent, SectionCardComponent, StatusBadgeComponent],
  template: `
    <app-page-header kicker="Visão do turno" title="Operação em tempo real" description="Vendas, mesas e caixa em uma visão objetiva."><div page-actions class="page-header-actions"><button type="button" class="secondary-button" (click)="load()"><i class="pi pi-refresh"></i>Atualizar</button></div></app-page-header>
    @if (loading()) { <section class="stats-grid">@for (item of [1,2,3,4]; track item) { <div class="premium-card loading-card"></div> }</section> }
    @else if (error()) { <div class="error-panel" role="alert"><i class="pi pi-exclamation-triangle"></i><div><strong>Dashboard indisponível</strong><p>{{ error() }}</p></div><button type="button" class="ghost-button" (click)="load()">Tentar novamente</button></div> }
    @else if (summary(); as data) {
      <section class="stats-grid">
        <a class="premium-card stat-card tone-blue dashboard-stat-link" routerLink="/relatorios"><div class="stat-icon"><i class="pi pi-chart-line"></i></div><div class="stat-copy"><span>Vendas hoje</span><strong>{{ currency(data.todaySales) }}</strong><p>Ticket médio {{ currency(data.averageTicket) }}</p></div><small>Abrir relatórios <i class="pi pi-arrow-right"></i></small></a>
        <a class="premium-card stat-card tone-purple dashboard-stat-link" routerLink="/comandas"><div class="stat-icon"><i class="pi pi-receipt"></i></div><div class="stat-copy"><span>Mesas abertas</span><strong>{{ data.openTableSales }}</strong><p>{{ data.tableSummary.free }} mesas livres</p></div><small>Abrir comandas <i class="pi pi-arrow-right"></i></small></a>
        <a class="premium-card stat-card tone-amber dashboard-stat-link" routerLink="/balcao"><div class="stat-icon"><i class="pi pi-shopping-bag"></i></div><div class="stat-copy"><span>Balcão em andamento</span><strong>{{ data.openCounterSales }}</strong><p>{{ data.openSales }} vendas abertas</p></div><small>Abrir balcão <i class="pi pi-arrow-right"></i></small></a>
        <a class="premium-card stat-card tone-emerald dashboard-stat-link" routerLink="/caixa"><div class="stat-icon"><i class="pi pi-wallet"></i></div><div class="stat-copy"><span>Pagamentos pendentes</span><strong>{{ data.pendingPayments }}</strong><p>{{ currency(data.cashSummary.openAmount) }} em aberto</p></div><small>Abrir caixa <i class="pi pi-arrow-right"></i></small></a>
      </section>
      <section class="dashboard-grid">
        <app-section-card eyebrow="Agora" title="Vendas recentes"><div class="activity-list">@for (sale of data.recentSales; track sale.id) { <article class="activity-row"><div class="activity-order"><strong>Venda #{{ sale.id }}</strong><span>{{ sale.originLabel }}</span></div><span class="activity-time">{{ dateTime(sale.createdAt) }}</span><app-status-badge [label]="statusLabel(sale.status)" [tone]="statusTone(sale.status)" /><strong class="activity-amount">{{ currency(sale.amount) }}</strong></article> } @empty { <app-empty-state icon="pi pi-receipt" title="Sem vendas recentes" description="As vendas aparecerão aqui conforme a operação avançar." /> }</div></app-section-card>
        <app-section-card eyebrow="Salão" title="Status das mesas"><div class="table-status-list">@for (status of tableStatuses(data); track status.label) { <div class="progress-row"><div><span>{{ status.label }}</span><strong>{{ status.value }}/{{ data.tableSummary.total }}</strong></div><div class="progress-track"><span [class]="status.tone" [style.width.%]="data.tableSummary.total ? status.value / data.tableSummary.total * 100 : 0"></span></div></div> }</div></app-section-card>
        <app-section-card eyebrow="Financeiro" title="Resumo do caixa"><div class="cash-summary-list"><article><span>Recebido hoje</span><strong>{{ currency(data.cashSummary.received) }}</strong><small>Pagamentos registrados</small></article><article><span>Em aberto</span><strong>{{ currency(data.cashSummary.openAmount) }}</strong><small>{{ data.openSales }} vendas abertas</small></article><article><span>Cancelamentos</span><strong>{{ currency(data.cashSummary.cancelledAmount) }}</strong><small>Itens e vendas cancelados</small></article></div></app-section-card>
      </section>
    }
  `,
})
export class DashboardPageComponent implements OnInit {
  private readonly api = inject(DashboardApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequests = new Subject<boolean>();
  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  ngOnInit(): void { merge(of(true), interval(30_000).pipe(map(() => false)), this.refreshRequests).pipe(exhaustMap((showLoading) => { if (showLoading && !this.summary()) this.loading.set(true); if (!this.summary()) this.error.set(null); return this.api.getSummary().pipe(catchError((error) => { if (!this.summary()) this.error.set(apiErrorMessage(error)); return EMPTY; }), finalize(() => this.loading.set(false))); }), takeUntilDestroyed(this.destroyRef)).subscribe((summary) => { this.summary.set(summary); this.error.set(null); }); }
  load(): void { this.refreshRequests.next(true); }
  tableStatuses(data: DashboardSummary) { return [{ label: 'Livres', value: data.tableSummary.free, tone: 'free' }, { label: 'Ocupadas', value: data.tableSummary.occupied, tone: 'occupied' }, { label: 'Desativadas', value: data.tableSummary.disabled, tone: 'disabled' }]; }
  statusLabel(status: string): string { return ({ OPEN: 'Aberta', CLOSED: 'Fechada', CANCELLED: 'Cancelada' } as Record<string, string>)[status] ?? status; }
  statusTone(status: string): string { return status === 'CLOSED' ? 'success' : status === 'CANCELLED' ? 'danger' : 'info'; }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  dateTime(value: string): string { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
}
