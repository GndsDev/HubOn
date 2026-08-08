import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { MonthlyReportApiService } from '../../core/services/monthly-report-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { AnnualReport, DailyReport, MonthlyReport, ReportChannel, ReportData, ReportPeriod } from '../../shared/models/monthly-report.model';
import { apiErrorMessage } from '../../shared/util/api-error';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, PageHeaderComponent, SectionCardComponent],
  template: `
    <app-page-header kicker="Gestão" title="Relatórios" description="Resultados consolidados das vendas de mesa e balcão.">
      <div page-actions class="page-header-actions"><button type="button" class="secondary-button" (click)="export('PDF')" [disabled]="!report() || exporting()"><i class="pi pi-file-pdf"></i>PDF</button><button type="button" class="secondary-button" (click)="export('XLSX')" [disabled]="!report() || exporting()"><i class="pi pi-file-excel"></i>Excel</button></div>
    </app-page-header>

    <section class="report-controls">
      <div class="segmented-control"><button type="button" [class.active]="period === 'DAILY'" (click)="setPeriod('DAILY')">Diário</button><button type="button" [class.active]="period === 'MONTHLY'" (click)="setPeriod('MONTHLY')">Mensal</button><button type="button" [class.active]="period === 'ANNUAL'" (click)="setPeriod('ANNUAL')">Anual</button></div>
      @if (period === 'DAILY') { <label class="field compact-field"><span>Data</span><input type="date" [(ngModel)]="date" (change)="load()" /></label> }
      @if (period === 'MONTHLY') { <label class="field compact-field"><span>Mês</span><select [(ngModel)]="month" (change)="load()">@for (name of months; track $index) { <option [ngValue]="$index + 1">{{ name }}</option> }</select></label> }
      @if (period !== 'DAILY') { <label class="field compact-field"><span>Ano</span><input type="number" min="2020" max="2100" [(ngModel)]="year" (change)="load()" /></label> }
      <label class="field compact-field"><span>Origem</span><select [(ngModel)]="channel" (change)="load()"><option value="ALL">Todas</option><option value="TABLE">Mesas</option><option value="COUNTER">Balcão</option></select></label>
      <button type="button" class="icon-button" title="Atualizar" aria-label="Atualizar relatório" (click)="load()"><i class="pi pi-refresh"></i></button>
    </section>

    @if (loading()) { <section class="stats-grid">@for (item of [1,2,3,4]; track item) { <div class="premium-card loading-card"></div> }</section> }
    @else if (error()) { <div class="error-panel" role="alert"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível gerar o relatório</strong><p>{{ error() }}</p></div><button type="button" class="ghost-button" (click)="load()">Tentar novamente</button></div> }
    @else if (report(); as data) {
      <section class="report-metrics"><article><span>Faturamento</span><strong>{{ currency(data.summary.netRevenue) }}</strong><small>Bruto {{ currency(data.summary.grossRevenue) }}</small></article><article><span>Vendas fechadas</span><strong>{{ data.summary.closedSales }}</strong><small>{{ data.summary.tableSales }} mesas · {{ data.summary.counterSales }} balcão</small></article><article><span>Recebido</span><strong>{{ currency(data.summary.receivedAmount) }}</strong><small>{{ data.summary.itemsSold }} itens vendidos</small></article><article><span>Ticket médio</span><strong>{{ currency(data.summary.averageTicket) }}</strong><small>{{ data.periodLabel }}</small></article></section>
      @if (data.summary.closedSales === 0) { <app-empty-state icon="pi pi-chart-bar" title="Sem vendas fechadas" description="Ainda não há movimento para o período selecionado." /> }
      @else {
        <section class="report-grid">
          <app-section-card eyebrow="Vendas" title="Vendas detalhadas"><div class="report-sales-table"><div class="report-sales-head" aria-hidden="true"><span>Origem</span><span>Fechamento</span><span>Responsável</span><span>Itens</span><span>Total</span><span>Recebido</span><span>Pagamento</span></div>@for (sale of data.sales; track sale.id) { <article class="report-sales-row"><div><strong>{{ sale.origin }}</strong><small>#{{ sale.id }} · {{ duration(sale.durationMinutes) }}</small></div><time>{{ dateTime(sale.closedAt) }}</time><span>{{ sale.responsible }}</span><span>{{ sale.items }}</span><strong>{{ currency(sale.finalAmount) }}</strong><strong>{{ currency(sale.receivedAmount) }}</strong><span>{{ paymentList(sale.paymentMethods) }}</span></article> }</div></app-section-card>
          <app-section-card eyebrow="Catálogo" title="Produtos vendidos"><div class="report-simple-list">@for (product of data.products; track product.productName) { <article><div><strong>{{ product.productName }}</strong><small>{{ product.categoryName || 'Sem categoria' }}</small></div><span>{{ product.quantity }} un.</span><strong>{{ currency(product.salesAmount) }}</strong></article> } @empty { <app-empty-state icon="pi pi-box" title="Sem produtos" description="Nenhum item vendido no período." /> }</div></app-section-card>
          <app-section-card eyebrow="Recebimentos" title="Formas de pagamento"><div class="report-simple-list">@for (method of data.paymentMethods; track method.method) { <article><div><strong>{{ paymentMethodLabel(method.method) }}</strong><small>{{ method.payments }} pagamento{{ method.payments === 1 ? '' : 's' }}</small></div><span>{{ percent(method.receivedSharePercentage) }}</span><strong>{{ currency(method.amount) }}</strong></article> }</div></app-section-card>
        </section>
      }
      <section class="report-cancellations"><div><i class="pi pi-times-circle"></i><span>Cancelamentos</span></div><strong>{{ data.cancellations.cancelledSales }} vendas · {{ data.cancellations.cancelledItems }} itens · {{ currency(data.cancellations.cancelledAmount) }}</strong>@if (data.cancellations.mainReasons.length) { <small>{{ data.cancellations.mainReasons[0].reason }}</small> }</section>
    }
  `,
  styles: `
    .report-controls { display: flex; align-items: end; gap: .6rem; margin-bottom: 1rem; padding: .75rem; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-panel); } .compact-field { min-width: 9rem; } .report-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: .7rem; margin-bottom: 1rem; } .report-metrics article { display: grid; gap: .2rem; padding: 1rem; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-panel); } .report-metrics span, .report-metrics small { color: var(--text-muted); } .report-metrics strong { font-size: 1.25rem; } .report-grid { display: grid; grid-template-columns: 2fr 1fr; gap: .8rem; } .report-grid app-section-card:first-child { grid-column: 1 / -1; }
    .report-sales-table { display: grid; gap: .25rem; } .report-sales-head, .report-sales-row { display: grid; grid-template-columns: minmax(9rem, 1.2fr) 9rem minmax(8rem, 1fr) 4rem 7rem 7rem minmax(8rem, 1fr); gap: .6rem; align-items: center; } .report-sales-head { padding: .5rem; color: var(--text-muted); font-size: .72rem; font-weight: 700; text-transform: uppercase; } .report-sales-row { padding: .6rem .5rem; border-top: 1px solid var(--border-subtle); } .report-sales-row > div { display: grid; } .report-sales-row small, .report-sales-row time, .report-sales-row span { color: var(--text-secondary); }
    .report-simple-list { display: grid; gap: .3rem; } .report-simple-list article { display: grid; grid-template-columns: 1fr auto auto; gap: .7rem; align-items: center; padding: .55rem 0; border-bottom: 1px solid var(--border-subtle); } .report-simple-list article > div { display: grid; } .report-simple-list small, .report-simple-list span { color: var(--text-muted); } .report-cancellations { display: flex; align-items: center; gap: .7rem; margin-top: .8rem; padding: .8rem 1rem; border: 1px solid var(--danger-border); border-radius: 6px; color: var(--danger-text); } .report-cancellations strong { margin-left: auto; } .report-cancellations small { color: var(--text-muted); }
    .report-controls {
      width: fit-content;
      max-width: 100%;
      border-color: var(--color-border);
      border-radius: var(--radius-md);
      background: var(--gradient-card), var(--surface-card-bg);
      box-shadow: var(--shadow-row);
      padding: .75rem;
    }

    .report-metrics {
      gap: .85rem;
    }

    .report-metrics article {
      min-height: 7.6rem;
      border-color: var(--color-border-soft);
      border-radius: var(--radius-md);
      background: var(--gradient-card), var(--surface-card-bg);
      box-shadow: var(--shadow-row);
    }

    .report-metrics strong {
      color: var(--color-text-strong);
      font-size: 1.35rem;
      font-variant-numeric: tabular-nums;
    }

    .report-grid {
      gap: 1rem;
    }

    .report-sales-table {
      gap: .35rem;
      overflow-x: auto;
    }

    .report-sales-head {
      border-bottom: 1px solid var(--color-border-soft);
      padding: .45rem .65rem .7rem;
    }

    .report-sales-row {
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-sm);
      background: var(--surface-row-bg);
      box-shadow: var(--shadow-row);
      padding: .7rem .65rem;
    }

    .report-sales-row:hover {
      border-color: var(--border-interactive);
      background: var(--surface-row-hover-bg);
    }

    .report-sales-row > strong {
      color: var(--color-text-strong);
      font-variant-numeric: tabular-nums;
    }

    .report-simple-list article {
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-sm);
      background: var(--surface-row-bg);
      padding: .65rem .75rem;
    }

    .report-cancellations {
      border-color: var(--border-danger);
      border-radius: var(--radius-md);
      background: var(--status-danger-bg);
      padding: .85rem 1rem;
    }

    @media (max-width: 900px) { .report-controls { flex-wrap: wrap; width: 100%; } .report-metrics, .report-grid { grid-template-columns: 1fr 1fr; } .report-grid app-section-card { grid-column: 1 / -1; } .report-sales-head { display: none; } .report-sales-row { grid-template-columns: 1fr auto; } .report-sales-row > :not(:first-child):not(strong) { display: none; } } @media (max-width: 560px) { .report-metrics { grid-template-columns: 1fr; } }
  `,
})
export class ReportsPageComponent implements OnInit {
  private readonly api = inject(MonthlyReportApiService);
  private readonly feedback = inject(FeedbackService);
  readonly report = signal<ReportData | null>(null);
  readonly loading = signal(true);
  readonly exporting = signal(false);
  readonly error = signal<string | null>(null);
  period: ReportPeriod = 'MONTHLY';
  channel: ReportChannel = 'ALL';
  date = this.isoDate(new Date());
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  readonly months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  ngOnInit(): void { this.load(); }
  setPeriod(period: ReportPeriod): void { this.period = period; this.load(); }
  load(): void { this.loading.set(true); this.error.set(null); this.reportRequest().pipe(finalize(() => this.loading.set(false))).subscribe({ next: (report) => this.report.set(report), error: (error) => this.error.set(apiErrorMessage(error)) }); }
  export(format: 'PDF' | 'XLSX'): void { if (!this.report() || this.exporting()) return; this.exporting.set(true); this.exportRequest(format).pipe(finalize(() => this.exporting.set(false))).subscribe({ next: (blob) => { const extension = format.toLocaleLowerCase(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `hubon-${this.period.toLocaleLowerCase()}-${this.year}.${extension}`; anchor.click(); URL.revokeObjectURL(url); this.feedback.success(`${format} gerado.`); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  private reportRequest(): Observable<ReportData> { if (this.period === 'DAILY') return this.api.getDaily(this.date, this.channel); if (this.period === 'ANNUAL') return this.api.getAnnual(this.year, this.channel); return this.api.getMonthly(this.year, this.month, this.channel); }
  private exportRequest(format: 'PDF' | 'XLSX'): Observable<Blob> { if (this.period === 'DAILY') return format === 'PDF' ? this.api.getDailyPdf(this.date, this.channel) : this.api.getDailyXlsx(this.date, this.channel); if (this.period === 'ANNUAL') return format === 'PDF' ? this.api.getAnnualPdf(this.year, this.channel) : this.api.getAnnualXlsx(this.year, this.channel); return format === 'PDF' ? this.api.getMonthlyPdf(this.year, this.month, this.channel) : this.api.getMonthlyXlsx(this.year, this.month, this.channel); }
  paymentMethodLabel(method: string): string { return ({ CASH: 'Dinheiro', CREDIT_CARD: 'Crédito', DEBIT_CARD: 'Débito', PIX: 'PIX', VOUCHER: 'Voucher' } as Record<string, string>)[method] ?? method; }
  paymentList(value: string): string { return value ? value.split(',').map((method) => this.paymentMethodLabel(method.trim())).join(', ') : 'Sem pagamento'; }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  percent(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(value / 100); }
  dateTime(value: string): string { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
  duration(minutes: number): string { return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`; }
  private isoDate(date: Date): string { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 10); }
}
