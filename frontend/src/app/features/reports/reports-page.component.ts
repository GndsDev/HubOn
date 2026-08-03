import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { MonthlyReportApiService } from '../../core/services/monthly-report-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { MonthlyReport, ReportChannel } from '../../shared/models/monthly-report.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { monthlyProductsCsv, monthlySummaryCsv } from '../../shared/util/monthly-report-csv';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, SectionCardComponent, EmptyStateComponent],
  template: `
    <app-page-header kicker="Gestão" title="Relatório mensal" description="Resultados consolidados pelas comandas fechadas no período.">
      @if (report()) {
        <button type="button" class="ghost-button print-hidden" (click)="exportSummary()"><i class="pi pi-download"></i>Resumo CSV</button>
        <button type="button" class="ghost-button print-hidden" (click)="exportProducts()"><i class="pi pi-file"></i>Produtos CSV</button>
        <button type="button" class="primary-button print-hidden" (click)="print()"><i class="pi pi-print"></i>Imprimir</button>
      }
    </app-page-header>

    <section class="report-filters print-hidden" aria-label="Filtros do relatório">
      <label class="field"><span>Mês</span><select [(ngModel)]="month" (ngModelChange)="load()">@for (item of months; track item.value) { <option [ngValue]="item.value">{{ item.label }}</option> }</select></label>
      <label class="field"><span>Ano</span><select [(ngModel)]="year" (ngModelChange)="load()">@for (item of years; track item) { <option [ngValue]="item">{{ item }}</option> }</select></label>
      <div class="field"><span>Canal</span><div class="segmented-control">@for (item of channels; track item.value) { <button type="button" [class.active]="channel === item.value" (click)="setChannel(item.value)">{{ item.label }}</button> }</div></div>
    </section>

    @if (loading()) {
      <div class="report-loading"><div class="loading-card"></div><div class="loading-card"></div><div class="loading-card"></div><div class="loading-card"></div></div>
    } @else if (error()) {
      <div class="error-panel" role="alert"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível gerar o relatório</strong><p>{{ error() }}</p></div><button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button></div>
    } @else if (report(); as data) {
      <div class="report-print-heading"><strong>HubOn</strong><span>{{ data.periodLabel }} · {{ channelLabel(data.channel) }}</span></div>

      <section class="report-metrics" aria-label="Indicadores mensais">
        <article><span>Receita líquida</span><strong>{{ currency(data.summary.netRevenue) }}</strong><small>{{ comparisonText(data) }}</small></article>
        <article><span>Receita bruta</span><strong>{{ currency(data.summary.grossRevenue) }}</strong><small>Antes de {{ currency(data.summary.discounts) }} em descontos</small></article>
        <article><span>Comandas fechadas</span><strong>{{ data.summary.closedTabs }}</strong><small>{{ data.summary.orders }} pedidos · {{ data.summary.itemsSold }} itens</small></article>
        <article><span>Recebido</span><strong>{{ currency(data.summary.receivedAmount) }}</strong><small>Ticket médio de {{ currency(data.summary.averageTicket) }}</small></article>
      </section>

      @if (data.summary.closedTabs === 0) {
        <app-section-card eyebrow="Período" title="Sem vendas fechadas"><app-empty-state icon="pi pi-calendar" title="Nenhum resultado neste período" description="Escolha outro mês ou canal para consultar." /></app-section-card>
      } @else {
        <div class="report-grid report-grid-primary">
          <app-section-card eyebrow="Evolução" title="Receita por dia">
            <div class="report-bars">
              @for (day of data.daily; track day.date) {
                <div class="report-bar-row"><time>{{ shortDate(day.date) }}</time><div><span [style.width.%]="barWidth(day.netRevenue)"></span></div><b>{{ currency(day.netRevenue) }}</b></div>
              }
            </div>
          </app-section-card>

          <app-section-card eyebrow="Canais" title="Mesas e balcão">
            <div class="report-ranking">
              @for (item of data.channels; track item.channel) { <article><div><strong>{{ channelLabel(item.channel) }}</strong><small>{{ item.closedTabs }} comandas · ticket {{ currency(item.averageTicket) }}</small></div><b>{{ currency(item.netRevenue) }}</b></article> }
            </div>
          </app-section-card>
        </div>

        <app-section-card eyebrow="Catálogo" title="Produtos e variações">
          <div card-action class="segmented-control report-sort print-hidden" aria-label="Ordenar produtos">
            <button type="button" [class.active]="productSort() === 'REVENUE'" (click)="productSort.set('REVENUE')">Faturamento</button>
            <button type="button" [class.active]="productSort() === 'QUANTITY'" (click)="productSort.set('QUANTITY')">Quantidade</button>
            <button type="button" [class.active]="productSort() === 'NAME'" (click)="productSort.set('NAME')">Nome</button>
          </div>
          <div class="report-table report-products-table">
            <div class="report-table-head"><span>Produto</span><span>Quantidade</span><span>Valor dos itens</span></div>
            @for (product of sortedProducts(); track product.productName + product.categoryName) {
              <details class="report-product-row">
                <summary><strong>{{ product.productName }}<small>{{ product.categoryName }} · {{ percentage(product.revenueSharePercentage) }}</small></strong><span>{{ product.quantity }}</span><b>{{ currency(product.salesAmount) }}</b></summary>
                <div class="report-variant-list">@for (variant of product.variants; track variant.variantName) { <div><span>{{ variant.variantName }}</span><span>{{ variant.quantity }}</span><b>{{ currency(variant.salesAmount) }}</b></div> }</div>
              </details>
            }
          </div>
        </app-section-card>

        <div class="report-grid">
          <app-section-card eyebrow="Cardápio" title="Categorias">
            <div class="report-ranking">@for (item of data.categories; track item.categoryName) { <article><div><strong>{{ item.categoryName }}</strong><small>{{ item.quantity }} itens · {{ percentage(item.revenueSharePercentage) }}</small></div><b>{{ currency(item.salesAmount) }}</b></article> }</div>
          </app-section-card>
          <app-section-card eyebrow="Recebimentos" title="Formas de pagamento">
            <div class="report-ranking">@for (item of data.paymentMethods; track item.method) { <article><div><strong>{{ paymentLabel(item.method) }}</strong><small>{{ item.payments }} registros · {{ percentage(item.receivedSharePercentage) }}</small></div><b>{{ currency(item.amount) }}</b></article> }</div>
          </app-section-card>
        </div>

        <section class="report-cancellations"><div><i class="pi pi-times-circle"></i><span>Cancelamentos no mês</span></div><strong>{{ data.cancellations.cancelledOrders }} pedidos · {{ data.cancellations.cancelledItems }} itens · {{ currency(data.cancellations.cancelledAmount) }}</strong></section>
        @if (data.cancellations.mainReasons.length) { <div class="report-cancellation-reasons">@for (reason of data.cancellations.mainReasons; track reason.reason) { <span>{{ reason.reason }} <b>{{ reason.occurrences }}</b></span> }</div> }
      }
    }
  `,
})
export class ReportsPageComponent implements OnInit {
  private readonly api = inject(MonthlyReportApiService);
  private readonly document = inject(DOCUMENT);
  private readonly today = new Date();

  readonly report = signal<MonthlyReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly maxDailyRevenue = computed(() => Math.max(0, ...(this.report()?.daily.map((day) => day.netRevenue) ?? [])));
  month = this.today.getMonth() + 1;
  year = this.today.getFullYear();
  channel: ReportChannel = 'ALL';
  readonly productSort = signal<'REVENUE' | 'QUANTITY' | 'NAME'>('REVENUE');
  readonly years = Array.from({ length: 7 }, (_, index) => this.today.getFullYear() + 1 - index);
  readonly months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    .map((label, index) => ({ value: index + 1, label }));
  readonly channels: { value: ReportChannel; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'TABLE', label: 'Mesas' },
    { value: 'COUNTER', label: 'Balcão' },
  ];
  readonly sortedProducts = computed(() => {
    const products = [...(this.report()?.products ?? [])];
    if (this.productSort() === 'NAME') return products.sort((left, right) => left.productName.localeCompare(right.productName, 'pt-BR'));
    if (this.productSort() === 'QUANTITY') return products.sort((left, right) => right.quantity - left.quantity);
    return products.sort((left, right) => right.salesAmount - left.salesAmount);
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getMonthly(this.year, this.month, this.channel).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (report) => this.report.set(report),
      error: (error) => { this.report.set(null); this.error.set(apiErrorMessage(error)); },
    });
  }

  setChannel(channel: ReportChannel): void { this.channel = channel; this.load(); }
  barWidth(value: number): number { return this.maxDailyRevenue() === 0 ? 0 : Math.max(2, value / this.maxDailyRevenue() * 100); }
  shortDate(value: string): string { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${value}T12:00:00`)); }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0); }
  percentage(value: number): string { return `${Number(value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`; }

  comparisonText(report: MonthlyReport): string {
    const percentage = report.comparison.percentageChange;
    if (percentage == null) return 'Sem base comparável no mês anterior';
    const direction = percentage >= 0 ? 'acima' : 'abaixo';
    return `${Math.abs(percentage).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ${direction} do mês anterior`;
  }

  channelLabel(channel: string): string { return channel === 'TABLE' ? 'Mesas' : channel === 'COUNTER' ? 'Balcão' : 'Todos os canais'; }
  paymentLabel(method: string): string { return ({ CASH: 'Dinheiro', CREDIT_CARD: 'Cartão de crédito', DEBIT_CARD: 'Cartão de débito', PIX: 'PIX', VOUCHER: 'Voucher' } as Record<string, string>)[method] ?? method; }
  print(): void { this.document.defaultView?.print(); }
  exportSummary(): void { const data = this.report(); if (data) this.download(monthlySummaryCsv(data), `hubon-resumo-${data.year}-${String(data.month).padStart(2, '0')}.csv`); }
  exportProducts(): void { const data = this.report(); if (data) this.download(monthlyProductsCsv(data), `hubon-produtos-${data.year}-${String(data.month).padStart(2, '0')}.csv`); }

  private download(content: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
