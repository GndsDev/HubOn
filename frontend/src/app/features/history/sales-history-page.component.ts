import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { SalesApiService } from '../../core/services/sales-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaymentMethod, Sale, SaleStatus, SaleType } from '../../shared/models/sale.model';
import { apiErrorMessage } from '../../shared/util/api-error';

@Component({
  selector: 'app-sales-history-page',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header kicker="Consulta" title="Histórico de vendas" description="Vendas fechadas e canceladas de mesas e balcão.">
      <div page-actions class="page-header-actions"><button type="button" class="secondary-button" (click)="load()" [disabled]="loading()"><i class="pi pi-refresh"></i>Atualizar</button></div>
    </app-page-header>
    <section class="history-panel">
      <div class="history-filters"><label class="field"><span>De</span><input type="date" [(ngModel)]="from" /></label><label class="field"><span>Até</span><input type="date" [(ngModel)]="to" /></label><label class="field"><span>Origem</span><select [(ngModel)]="type"><option value="ALL">Todas</option><option value="TABLE">Mesa</option><option value="COUNTER">Balcão</option></select></label><label class="field"><span>Situação</span><select [(ngModel)]="status"><option value="ALL">Todas</option><option value="CLOSED">Fechada</option><option value="CANCELLED">Cancelada</option></select></label></div>
      @if (loading()) { <div class="loading-grid"><div class="loading-row"></div><div class="loading-row"></div><div class="loading-row"></div></div> }
      @else if (error()) { <div class="error-panel" role="alert"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar o histórico</strong><p>{{ error() }}</p></div></div> }
      @else if (!visibleSales().length) { <app-empty-state icon="pi pi-history" title="Nenhuma venda encontrada" description="Ajuste os filtros ou aguarde o fechamento das primeiras vendas." /> }
      @else { <div class="history-table"><div class="history-head" aria-hidden="true"><span>Data</span><span>Origem</span><span>Itens</span><span>Total</span><span>Pagamento</span><span>Situação</span><span></span></div>@for (sale of visibleSales(); track sale.id) { <article class="history-row"><time>{{ dateTime(sale.closedAt || sale.cancelledAt || sale.openedAt) }}</time><strong>{{ origin(sale) }}</strong><span>{{ activeItemCount(sale) }}</span><strong>{{ currency(sale.finalAmount) }}</strong><span>{{ paymentSummary(sale) }}</span><app-status-badge [label]="statusLabel(sale.status)" [tone]="sale.status === 'CLOSED' ? 'success' : 'danger'" /><button type="button" class="icon-button" [attr.aria-label]="'Ver detalhes da venda ' + sale.id" (click)="toggleDetails(sale.id)"><i [class]="expandedId() === sale.id ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"></i></button>@if (expandedId() === sale.id) { <div class="history-detail"><div class="detail-summary"><span>Aberta por <strong>{{ sale.openedByUserName }}</strong></span><span>Subtotal <strong>{{ currency(sale.subtotal) }}</strong></span><span>Taxa <strong>{{ currency(sale.serviceFee) }}</strong></span><span>Desconto <strong>{{ currency(sale.discountAmount) }}</strong></span></div><div class="detail-items">@for (item of sale.items; track item.id) { <div [class.cancelled]="item.cancelledAt"><span>{{ item.quantity }}x {{ item.productName }}@if (item.options.length) { <small>{{ optionSummary(item.options) }}</small> }</span><strong>{{ currency(item.subtotal) }}</strong>@if (item.cancelledAt) { <small>Cancelado: {{ item.cancellationReason }}</small> }</div> }</div>@if (sale.payments.length) { <div class="detail-payments"><strong class="detail-section-title">Pagamentos</strong>@for (payment of sale.payments; track payment.id) { <div><span>{{ methodLabel(payment.method) }}<small>{{ dateTime(payment.paidAt) }} · {{ payment.receivedByUserName }}</small></span><strong>{{ currency(payment.amount) }}</strong></div> }</div> }@if (sale.cancellationReason) { <p class="cancellation-note"><strong>Motivo:</strong> {{ sale.cancellationReason }}</p> }</div> }</article> }</div> }
    </section>
  `,
  styles: `
    .history-panel { border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-panel); padding: 1rem; } .history-filters { display: grid; grid-template-columns: repeat(4, minmax(8rem, 1fr)); gap: .65rem; margin-bottom: 1rem; } .history-table { display: grid; gap: .3rem; } .history-head, .history-row { display: grid; grid-template-columns: 9rem minmax(8rem, 1fr) 4rem 7rem minmax(8rem, 1fr) 7rem 2.5rem; gap: .7rem; align-items: center; } .history-head { padding: .5rem .7rem; color: var(--text-muted); font-size: .75rem; font-weight: 700; text-transform: uppercase; } .history-row { padding: .65rem .7rem; border: 1px solid var(--border-subtle); border-radius: 5px; background: var(--surface-raised); } .history-row time, .history-row > span { color: var(--text-secondary); } .history-detail { grid-column: 1 / -1; display: grid; gap: .7rem; padding-top: .7rem; border-top: 1px solid var(--border-subtle); } .detail-summary { display: flex; flex-wrap: wrap; gap: .5rem 1rem; color: var(--text-muted); } .detail-items, .detail-payments { display: grid; gap: .3rem; } .detail-items > div, .detail-payments > div { display: grid; grid-template-columns: 1fr auto; gap: .35rem; } .detail-items span, .detail-payments span { display: grid; } .detail-items small, .detail-payments small { color: var(--text-muted); } .detail-items .cancelled { opacity: .55; text-decoration: line-through; } .detail-section-title { font-size: .82rem; color: var(--text-secondary); } .cancellation-note { margin: 0; color: var(--danger-text); } @media (max-width: 800px) { .history-filters { grid-template-columns: 1fr 1fr; } .history-head { display: none; } .history-row { grid-template-columns: 1fr auto; } .history-row > :nth-child(3), .history-row > :nth-child(5) { display: none; } }
  `,
})
export class SalesHistoryPageComponent implements OnInit {
  private readonly api = inject(SalesApiService);
  readonly sales = signal<Sale[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly expandedId = signal<number | null>(null);
  type: SaleType | 'ALL' = 'ALL';
  status: SaleStatus | 'ALL' = 'ALL';
  from = '';
  to = '';
  visibleSales(): Sale[] { return this.sales().filter((sale) => sale.status !== 'OPEN').filter((sale) => this.type === 'ALL' || sale.type === this.type).filter((sale) => this.status === 'ALL' || sale.status === this.status).filter((sale) => { const date = (sale.closedAt || sale.cancelledAt || sale.openedAt).slice(0, 10); return (!this.from || date >= this.from) && (!this.to || date <= this.to); }).sort((a, b) => (b.closedAt || b.cancelledAt || b.openedAt).localeCompare(a.closedAt || a.cancelledAt || a.openedAt)); }
  ngOnInit(): void { this.load(); }
  load(): void { this.loading.set(true); this.error.set(null); this.api.list().pipe(finalize(() => this.loading.set(false))).subscribe({ next: (sales) => this.sales.set(sales), error: (error) => this.error.set(apiErrorMessage(error)) }); }
  toggleDetails(id: number): void { this.expandedId.update((current) => current === id ? null : id); }
  origin(sale: Sale): string { return sale.type === 'TABLE' ? `Mesa ${sale.tableNumber}` : `Balcão #${sale.id}`; }
  activeItemCount(sale: Sale): number { return sale.items.filter((item) => !item.cancelledAt).reduce((total, item) => total + item.quantity, 0); }
  paymentSummary(sale: Sale): string { return sale.payments.length ? [...new Set(sale.payments.map((payment) => this.methodLabel(payment.method)))].join(', ') : 'Sem pagamento'; }
  optionSummary(options: Sale['items'][number]['options']): string { return options.map((option) => option.optionName).join(', '); }
  statusLabel(status: SaleStatus): string { return status === 'CLOSED' ? 'Fechada' : status === 'CANCELLED' ? 'Cancelada' : 'Aberta'; }
  methodLabel(method: PaymentMethod): string { return ({ CASH: 'Dinheiro', CREDIT_CARD: 'Crédito', DEBIT_CARD: 'Débito', PIX: 'PIX', VOUCHER: 'Voucher' })[method]; }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  dateTime(value: string): string { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
}
