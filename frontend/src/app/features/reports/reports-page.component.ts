import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { MonthlyReportApiService } from '../../core/services/monthly-report-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ReportProductSortComponent } from '../../shared/components/report-product-sort/report-product-sort.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { BodyPortalDirective } from '../../shared/directives/body-portal.directive';
import {
  AnnualReport,
  DailyReport,
  MonthlyReport,
  ReportChannel,
  ReportData,
  ReportPeriod,
} from '../../shared/models/monthly-report.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import {
  annualProductsCsv,
  annualSalesCsv,
  annualSummaryCsv,
  dailyProductsCsv,
  dailySalesCsv,
  dailySummaryCsv,
  monthlyProductsCsv,
  monthlySalesCsv,
  monthlySummaryCsv,
} from '../../shared/util/monthly-report-csv';
import { calculateOverlayPosition, OverlayPosition } from '../../shared/util/overlay-position';
import {
  defaultReportSortDirection,
  parseReportProductSort,
  parseReportSortDirection,
  ReportProductSort,
  ReportSortDirection,
  sortReportProducts,
} from '../../shared/util/report-product-sort';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    ReportProductSortComponent,
    SectionCardComponent,
    EmptyStateComponent,
    BodyPortalDirective,
  ],
  template: `
    <app-page-header kicker="Gestão" [title]="reportTitle()" [description]="reportDescription()">
      @if (report()) {
        <div page-actions class="page-header-actions print-hidden">
          <button
            type="button"
            class="secondary-button"
            aria-haspopup="menu"
            aria-controls="report-export-menu"
            [attr.aria-expanded]="exportMenuOpen()"
            (click)="toggleExportMenu($event)"
          >
            <i class="pi pi-download"></i>
            Exportar
            <i class="pi pi-chevron-down button-trailing-icon"></i>
          </button>
          <button
            type="button"
            class="secondary-button"
            [disabled]="pdfExporting()"
            [attr.aria-busy]="pdfExporting()"
            (click)="exportPdf()"
          >
            <i class="pi" [class.pi-file-pdf]="!pdfExporting()" [class.pi-spinner]="pdfExporting()" [class.pi-spin]="pdfExporting()"></i>
            Baixar PDF
          </button>
        </div>
      }
    </app-page-header>

    @if (exportMenuOpen()) {
      <div
        appBodyPortal
        id="report-export-menu"
        class="action-menu action-menu-overlay report-export-menu"
        role="menu"
        aria-label="Opções de exportação"
        [attr.data-placement]="exportMenuPosition().placement"
        [style.left.px]="exportMenuPosition().left"
        [style.top.px]="exportMenuPosition().top"
        [style.max-height.px]="exportMenuPosition().maxHeight"
        (click)="$event.stopPropagation()"
        (keydown)="onExportMenuKeydown($event)"
      >
        <button type="button" role="menuitem" (click)="exportSummary(); closeExportMenu()"><i class="pi pi-file-export"></i>Resumo e evolução CSV</button>
        <button type="button" role="menuitem" (click)="exportProducts(); closeExportMenu()"><i class="pi pi-list"></i>Produtos e variações CSV</button>
        <button type="button" role="menuitem" (click)="exportSales(); closeExportMenu()"><i class="pi pi-receipt"></i>Vendas detalhadas CSV</button>
        <button type="button" role="menuitem" [disabled]="xlsxExporting()" (click)="exportXlsx(); closeExportMenu()">
          <i class="pi" [class.pi-file-excel]="!xlsxExporting()" [class.pi-spinner]="xlsxExporting()" [class.pi-spin]="xlsxExporting()"></i>
          Excel completo XLSX
        </button>
      </div>
    }

    <section class="report-filters print-hidden" aria-label="Filtros do relatório">
      <div class="field report-period-filter">
        <span>Período</span>
        <div class="segmented-control" aria-label="Tipo de período">
          <button type="button" [class.active]="period === 'DAILY'" [attr.aria-pressed]="period === 'DAILY'" (click)="setPeriod('DAILY')">Diário</button>
          <button type="button" [class.active]="period === 'MONTHLY'" [attr.aria-pressed]="period === 'MONTHLY'" (click)="setPeriod('MONTHLY')">Mensal</button>
          <button type="button" [class.active]="period === 'ANNUAL'" [attr.aria-pressed]="period === 'ANNUAL'" (click)="setPeriod('ANNUAL')">Anual</button>
        </div>
      </div>

      <div class="field report-reference-filter">
        <span>Referência</span>
        <div class="report-reference-controls">
          <button type="button" class="icon-button" title="Período anterior" aria-label="Período anterior" (click)="shiftPeriod(-1)"><i class="pi pi-chevron-left"></i></button>
          @if (period === 'DAILY') {
            <input type="date" [(ngModel)]="date" (ngModelChange)="onFilterChange()" aria-label="Data do relatório" />
          } @else if (period === 'MONTHLY') {
            <select [(ngModel)]="month" (ngModelChange)="onFilterChange()" aria-label="Mês do relatório">
              @for (item of months; track item.value) { <option [ngValue]="item.value">{{ item.label }}</option> }
            </select>
            <select [(ngModel)]="year" (ngModelChange)="onFilterChange()" aria-label="Ano do relatório">
              @for (item of years; track item) { <option [ngValue]="item">{{ item }}</option> }
            </select>
          } @else {
            <select [(ngModel)]="year" (ngModelChange)="onFilterChange()" aria-label="Ano do relatório">
              @for (item of years; track item) { <option [ngValue]="item">{{ item }}</option> }
            </select>
          }
          <button type="button" class="icon-button" title="Próximo período" aria-label="Próximo período" (click)="shiftPeriod(1)"><i class="pi pi-chevron-right"></i></button>
        </div>
      </div>

      <div class="field report-channel-filter">
        <span>Canal</span>
        <div class="segmented-control" aria-label="Canal de venda">
          @for (item of channels; track item.value) {
            <button type="button" [class.active]="channel === item.value" [attr.aria-pressed]="channel === item.value" (click)="setChannel(item.value)">{{ item.label }}</button>
          }
        </div>
      </div>
    </section>

    @if (loading()) {
      <div class="report-loading"><div class="loading-card"></div><div class="loading-card"></div><div class="loading-card"></div><div class="loading-card"></div></div>
    } @else if (error()) {
      <div class="error-panel" role="alert"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível gerar o relatório</strong><p>{{ error() }}</p></div><button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button></div>
    } @else if (report(); as data) {
      <div class="report-print-heading"><strong>HubOn</strong><span>{{ data.periodLabel }} - {{ channelLabel(data.channel) }}</span></div>

      <section class="report-metrics" [attr.aria-label]="metricsLabel()">
        <article class="report-metric-card report-metric-primary"><span>Receita líquida</span><strong>{{ currency(data.summary.netRevenue) }}</strong><small [class]="comparisonTone(data)">{{ comparisonText(data) }}</small></article>
        <article class="report-metric-card"><span>Receita bruta</span><strong>{{ currency(data.summary.grossRevenue) }}</strong><small>{{ currency(data.summary.serviceFees) }} em serviço - {{ currency(data.summary.discounts) }} em descontos</small></article>
        <article class="report-metric-card"><span>Comandas fechadas</span><strong>{{ data.summary.closedTabs }}</strong><small>{{ data.summary.tableSales }} mesas - {{ data.summary.counterSales }} balcão</small></article>
        <article class="report-metric-card report-metric-informative"><span>Recebido</span><strong>{{ currency(data.summary.receivedAmount) }}</strong><small>{{ data.summary.orders }} pedidos - {{ data.summary.itemsSold }} itens - ticket {{ currency(data.summary.averageTicket) }}</small></article>
      </section>

      @if (isAnnual(data)) {
        <section class="report-insights" aria-label="Indicadores anuais">
          <div><span>Melhor mês</span><strong>{{ data.indicators.bestMonthLabel }}</strong></div>
          <div><span>Receita do melhor mês</span><strong>{{ currency(data.indicators.bestMonthNetRevenue) }}</strong></div>
          <div><span>Média mensal</span><strong>{{ currency(data.indicators.averageMonthlyRevenue) }}</strong></div>
          <div><span>Meses com movimento</span><strong>{{ data.indicators.activeMonths }}</strong></div>
        </section>
      }

      @if (data.summary.closedTabs === 0) {
        <app-section-card eyebrow="Período" title="Sem vendas fechadas"><app-empty-state icon="pi pi-calendar" title="Nenhum resultado neste período" description="Escolha outro período ou canal para consultar." /></app-section-card>
      } @else {
        <div class="report-grid report-grid-primary">
          <app-section-card eyebrow="Evolução" [title]="seriesTitle()">
            <div class="report-bars">
              @for (item of revenueSeries(); track item.key) {
                <div class="report-bar-row"><time>{{ item.label }}</time><div><span [style.width.%]="barWidth(item.netRevenue)"></span></div><b>{{ currency(item.netRevenue) }}</b></div>
              }
            </div>
          </app-section-card>

          <app-section-card eyebrow="Canais" title="Mesas e balcão">
            <div class="report-ranking">
              @for (item of data.channels; track item.channel) { <article><div><strong>{{ channelLabel(item.channel) }}</strong><small>{{ item.closedTabs }} comandas - ticket {{ currency(item.averageTicket) }}</small></div><b>{{ currency(item.netRevenue) }}</b></article> }
            </div>
          </app-section-card>
        </div>

        <app-section-card eyebrow="Operação" title="Vendas que compõem o relatório">
          <span card-action class="report-sales-count">{{ data.sales.length }} vendas</span>
          <div class="report-sales-table" role="region" aria-label="Vendas detalhadas" tabindex="0">
            <table>
              <thead><tr><th>Origem</th><th>Fechamento</th><th>Responsável</th><th>Volume</th><th>Valor final</th><th>Recebido</th><th>Pagamentos</th></tr></thead>
              <tbody>
                @for (sale of displayedSales(); track sale.id) {
                  <tr><td><strong>{{ sale.origin }}</strong><small>#{{ sale.id }} - {{ duration(sale.durationMinutes) }}</small></td><td>{{ dateTime(sale.closedAt) }}</td><td>{{ sale.responsible }}</td><td>{{ sale.orders }} pedidos - {{ sale.items }} itens</td><td>{{ currency(sale.finalAmount) }}</td><td>{{ currency(sale.receivedAmount) }}</td><td>{{ paymentList(sale.paymentMethods) }}</td></tr>
                }
              </tbody>
            </table>
          </div>
          @if (salesPageCount() > 1) {
            <nav class="report-pagination print-hidden" aria-label="Paginação das vendas">
              <button type="button" class="icon-button" title="Página anterior" aria-label="Página anterior" [disabled]="salesPage() === 0" (click)="setSalesPage(salesPage() - 1)"><i class="pi pi-chevron-left"></i></button>
              <span>Página {{ salesPage() + 1 }} de {{ salesPageCount() }}</span>
              <button type="button" class="icon-button" title="Próxima página" aria-label="Próxima página" [disabled]="salesPage() + 1 >= salesPageCount()" (click)="setSalesPage(salesPage() + 1)"><i class="pi pi-chevron-right"></i></button>
            </nav>
          }
        </app-section-card>

        <app-section-card eyebrow="Catálogo" title="Produtos e variações">
          <app-report-product-sort
            card-action
            class="print-hidden"
            [productCount]="productCount()"
            [sort]="productSort()"
            [direction]="productSortDirection()"
            (sortChange)="setProductSort($event)"
            (directionChange)="setProductSortDirection($event)"
          />
          @if (productCount() === 0) {
            <p class="report-products-empty">Altere o período ou o canal para consultar outros resultados.</p>
          } @else {
            <div class="report-table report-products-table">
              <div class="report-table-head"><span>Produto</span><span>Quantidade</span><span>Valor dos itens</span></div>
              @for (product of displayedProducts(); track product.productName + product.categoryName) {
                <details class="report-product-row">
                  <summary><strong>{{ product.productName }}<small>{{ product.categoryName }} - {{ percentage(product.revenueSharePercentage) }}</small></strong><span>{{ product.quantity }}</span><b>{{ currency(product.salesAmount) }}</b></summary>
                  <div class="report-variant-list">@for (variant of product.variants; track variant.variantName) { <div><span>{{ variant.variantName }}</span><span>{{ variant.quantity }}</span><b>{{ currency(variant.salesAmount) }}</b></div> }</div>
                </details>
              }
            </div>
          }
        </app-section-card>

        <div class="report-grid">
          <app-section-card eyebrow="Cardápio" title="Categorias"><div class="report-ranking">@for (item of data.categories; track item.categoryName) { <article><div><strong>{{ item.categoryName }}</strong><small>{{ item.quantity }} itens - {{ percentage(item.revenueSharePercentage) }}</small></div><b>{{ currency(item.salesAmount) }}</b></article> }</div></app-section-card>
          <app-section-card eyebrow="Recebimentos" title="Formas de pagamento"><div class="report-ranking">@for (item of data.paymentMethods; track item.method) { <article><div><strong>{{ paymentLabel(item.method) }}</strong><small>{{ item.payments }} registros - {{ percentage(item.receivedSharePercentage) }}</small></div><b>{{ currency(item.amount) }}</b></article> }</div></app-section-card>
        </div>

        <section class="report-cancellations"><div><i class="pi pi-times-circle"></i><span>Cancelamentos no {{ periodNoun() }}</span></div><strong>{{ data.cancellations.cancelledOrders }} pedidos - {{ data.cancellations.cancelledItems }} itens - {{ currency(data.cancellations.cancelledAmount) }}</strong></section>
        @if (data.cancellations.mainReasons.length) { <div class="report-cancellation-reasons">@for (reason of data.cancellations.mainReasons; track reason.reason) { <span>{{ reason.reason }} <b>{{ reason.occurrences }}</b></span> }</div> }
      }
    }
  `,
})
export class ReportsPageComponent implements OnInit {
  private readonly api = inject(MonthlyReportApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly today = new Date();

  readonly report = signal<ReportData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pdfExporting = signal(false);
  readonly xlsxExporting = signal(false);
  readonly exportMenuOpen = signal(false);
  readonly exportMenuPosition = signal<OverlayPosition>({ left: 0, top: 0, maxHeight: 280, placement: 'bottom' });
  readonly productSort = signal<ReportProductSort>('REVENUE');
  readonly productSortDirection = signal<ReportSortDirection>('DESC');
  readonly printing = signal(false);
  readonly salesPage = signal(0);
  readonly salesPageSize = 20;
  readonly revenueSeries = computed(() => {
    const report = this.report();
    if (!report) return [];
    if (this.isDaily(report)) {
      return report.hourly.map((hour) => ({ key: String(hour.hour), label: hour.hourLabel.slice(0, 5), netRevenue: hour.netRevenue }));
    }
    if (this.isMonthly(report)) {
      return report.daily.map((day) => ({ key: day.date, label: this.shortDate(day.date), netRevenue: day.netRevenue }));
    }
    return report.monthly.map((month) => ({ key: String(month.month), label: month.monthLabel, netRevenue: month.netRevenue }));
  });
  readonly maxSeriesRevenue = computed(() => Math.max(0, ...this.revenueSeries().map((item) => item.netRevenue)));
  readonly productCount = computed(() => this.report()?.products.length ?? 0);
  readonly sortedProducts = computed(() => sortReportProducts(
    this.report()?.products ?? [],
    this.productSort(),
    this.productSortDirection(),
  ));
  readonly displayedProducts = computed(() => this.printing()
    ? sortReportProducts(this.report()?.products ?? [], 'REVENUE', 'DESC')
    : this.sortedProducts());
  readonly salesPageCount = computed(() => Math.ceil((this.report()?.sales.length ?? 0) / this.salesPageSize));
  readonly displayedSales = computed(() => {
    const sales = this.report()?.sales ?? [];
    if (this.printing()) return sales;
    const start = this.salesPage() * this.salesPageSize;
    return sales.slice(start, start + this.salesPageSize);
  });

  period: ReportPeriod = 'MONTHLY';
  date = this.localDate(this.today);
  month = this.today.getMonth() + 1;
  year = this.today.getFullYear();
  channel: ReportChannel = 'ALL';
  readonly years = Array.from({ length: 10 }, (_, index) => this.today.getFullYear() + 1 - index);
  readonly months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    .map((label, index) => ({ value: index + 1, label }));
  readonly channels: { value: ReportChannel; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'TABLE', label: 'Mesas' },
    { value: 'COUNTER', label: 'Balcão' },
  ];

  private exportMenuTrigger: HTMLElement | null = null;
  private readonly exportMenuGap = 8;
  private readonly exportMenuViewportMargin = 12;
  private loadSequence = 0;

  ngOnInit(): void {
    let initialized = false;
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const filtersChanged = this.applyQueryParams(params);
      if (initialized && filtersChanged) this.load();
      initialized = true;
    });
    this.syncQueryParams();
    this.load();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.exportMenuOpen()) this.closeExportMenu();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.exportMenuOpen() || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.closeExportMenu();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    this.repositionExportMenu();
  }

  @HostListener('window:beforeprint')
  preparePrint(): void {
    this.printing.set(true);
  }

  @HostListener('window:afterprint')
  restoreAfterPrint(): void {
    this.printing.set(false);
  }

  load(): void {
    const sequence = ++this.loadSequence;
    this.loading.set(true);
    this.error.set(null);
    const request: Observable<ReportData> = this.period === 'DAILY'
      ? this.api.getDaily(this.date, this.channel)
      : this.period === 'ANNUAL'
        ? this.api.getAnnual(this.year, this.channel)
        : this.api.getMonthly(this.year, this.month, this.channel);
    request.pipe(finalize(() => {
      if (sequence === this.loadSequence) this.loading.set(false);
    })).subscribe({
      next: (report) => {
        if (sequence !== this.loadSequence) return;
        this.salesPage.set(0);
        this.report.set(report);
      },
      error: (error) => {
        if (sequence !== this.loadSequence) return;
        this.report.set(null);
        this.error.set(apiErrorMessage(error));
      },
    });
  }

  setPeriod(period: ReportPeriod): void {
    if (this.period === period) return;
    this.period = period;
    this.onFilterChange();
  }

  setChannel(channel: ReportChannel): void {
    if (this.channel === channel) return;
    this.channel = channel;
    this.onFilterChange();
  }

  onFilterChange(): void {
    this.syncQueryParams();
    this.load();
  }

  shiftPeriod(direction: -1 | 1): void {
    if (this.period === 'DAILY') {
      const value = new Date(`${this.date}T12:00:00`);
      value.setDate(value.getDate() + direction);
      this.date = this.localDate(value);
    } else if (this.period === 'MONTHLY') {
      const value = new Date(this.year, this.month - 1 + direction, 1, 12);
      this.month = value.getMonth() + 1;
      this.year = value.getFullYear();
    } else {
      this.year += direction;
    }
    this.onFilterChange();
  }

  setProductSort(sort: ReportProductSort): void {
    this.productSort.set(sort);
    this.productSortDirection.set(defaultReportSortDirection(sort));
    this.syncQueryParams();
  }

  setProductSortDirection(direction: ReportSortDirection): void {
    this.productSortDirection.set(direction);
    this.syncQueryParams();
  }

  setSalesPage(page: number): void {
    this.salesPage.set(Math.max(0, Math.min(page, this.salesPageCount() - 1)));
  }

  barWidth(value: number): number {
    return this.maxSeriesRevenue() === 0 ? 0 : Math.max(2, value / this.maxSeriesRevenue() * 100);
  }

  shortDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${value}T12:00:00`));
  }

  dateTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }

  duration(minutes: number): string {
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
  }

  percentage(value: number): string {
    return `${Number(value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  }

  reportTitle(): string {
    return this.period === 'DAILY' ? 'Relatório diário' : this.period === 'ANNUAL' ? 'Relatório anual' : 'Relatório mensal';
  }

  reportDescription(): string {
    return `Resultados consolidados pelas comandas fechadas no ${this.periodNoun()}.`;
  }

  metricsLabel(): string {
    return this.period === 'DAILY' ? 'Indicadores diários' : this.period === 'ANNUAL' ? 'Indicadores anuais' : 'Indicadores mensais';
  }

  seriesTitle(): string {
    return this.period === 'DAILY' ? 'Receita por hora' : this.period === 'ANNUAL' ? 'Receita por mês' : 'Receita por dia';
  }

  periodNoun(): string {
    return this.period === 'DAILY' ? 'dia' : this.period === 'ANNUAL' ? 'ano' : 'mês';
  }

  comparisonText(report: ReportData): string {
    const percentage = report.comparison.percentageChange;
    const reference = this.isDaily(report) ? 'dia anterior' : this.isMonthly(report) ? 'mês anterior' : 'ano anterior';
    if (percentage == null) return `Sem base comparável no ${reference}`;
    const direction = percentage >= 0 ? 'acima' : 'abaixo';
    return `${Math.abs(percentage).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ${direction} do ${reference}`;
  }

  comparisonTone(report: ReportData): string {
    const percentage = report.comparison.percentageChange;
    return percentage == null ? 'neutral' : percentage >= 0 ? 'positive' : 'negative';
  }

  channelLabel(channel: string): string {
    return channel === 'TABLE' ? 'Mesas' : channel === 'COUNTER' ? 'Balcão' : 'Todos os canais';
  }

  paymentLabel(method: string): string {
    return ({ CASH: 'Dinheiro', CREDIT_CARD: 'Cartão de crédito', DEBIT_CARD: 'Cartão de débito', PIX: 'PIX', VOUCHER: 'Voucher' } as Record<string, string>)[method] ?? method;
  }

  paymentList(methods: string): string {
    if (!methods) return 'Não informado';
    return methods.split(/,\s*/).map((method) => this.paymentLabel(method)).join(', ');
  }

  exportSummary(): void {
    const data = this.report();
    if (!data) return;
    const content = this.isDaily(data)
      ? dailySummaryCsv(data)
      : this.isMonthly(data) ? monthlySummaryCsv(data) : annualSummaryCsv(data);
    this.download(content, `${this.fileStem(data)}-resumo.csv`);
  }

  exportProducts(): void {
    const data = this.report();
    if (!data) return;
    const content = this.isDaily(data)
      ? dailyProductsCsv(data, this.sortedProducts())
      : this.isMonthly(data)
        ? monthlyProductsCsv(data, this.sortedProducts())
        : annualProductsCsv(data, this.sortedProducts());
    this.download(content, `${this.fileStem(data)}-produtos.csv`);
  }

  exportSales(): void {
    const data = this.report();
    if (!data) return;
    const content = this.isDaily(data)
      ? dailySalesCsv(data)
      : this.isMonthly(data) ? monthlySalesCsv(data) : annualSalesCsv(data);
    this.download(content, `${this.fileStem(data)}-vendas.csv`);
  }

  exportPdf(): void {
    const data = this.report();
    if (!data || this.pdfExporting()) return;
    this.pdfExporting.set(true);
    const request = this.isDaily(data)
      ? this.api.getDailyPdf(data.date, data.channel)
      : this.isMonthly(data)
        ? this.api.getMonthlyPdf(data.year, data.month, data.channel)
        : this.api.getAnnualPdf(data.year, data.channel);
    request.pipe(finalize(() => this.pdfExporting.set(false))).subscribe({
      next: (content) => {
        this.downloadBlob(content, `${this.fileStem(data)}.pdf`);
        this.feedback.success('PDF gerado com sucesso.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  exportXlsx(): void {
    const data = this.report();
    if (!data || this.xlsxExporting()) return;
    this.xlsxExporting.set(true);
    const request = this.isDaily(data)
      ? this.api.getDailyXlsx(data.date, data.channel)
      : this.isMonthly(data)
        ? this.api.getMonthlyXlsx(data.year, data.month, data.channel)
        : this.api.getAnnualXlsx(data.year, data.channel);
    request.pipe(finalize(() => this.xlsxExporting.set(false))).subscribe({
      next: (content) => {
        this.downloadBlob(content, `${this.fileStem(data)}.xlsx`);
        this.feedback.success('Excel gerado com sucesso.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  toggleExportMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (this.exportMenuOpen()) {
      this.closeExportMenu();
      return;
    }
    this.exportMenuTrigger = event.currentTarget as HTMLElement;
    this.exportMenuPosition.set({ left: -9999, top: -9999, maxHeight: 9999, placement: 'bottom' });
    this.exportMenuOpen.set(true);
    const frame = this.document.defaultView?.requestAnimationFrame
      ?? ((callback: FrameRequestCallback) => window.setTimeout(callback, 0));
    frame(() => {
      this.repositionExportMenu();
      this.document.querySelector<HTMLButtonElement>('#report-export-menu button')?.focus();
    });
  }

  closeExportMenu(restoreFocus = true): void {
    if (!this.exportMenuOpen()) return;
    const trigger = this.exportMenuTrigger;
    this.exportMenuOpen.set(false);
    this.exportMenuTrigger = null;
    if (restoreFocus) queueMicrotask(() => trigger?.focus());
  }

  onExportMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      this.closeExportMenu(false);
      return;
    }
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      this.closeExportMenu();
      return;
    }
    const menu = (event.target as HTMLElement | null)?.closest<HTMLElement>('#report-export-menu');
    const items = Array.from(menu?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    if (!items.length) return;
    const currentIndex = Math.max(0, items.indexOf(event.target as HTMLButtonElement));
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  isDaily(report: ReportData): report is DailyReport {
    return 'date' in report;
  }

  isMonthly(report: ReportData): report is MonthlyReport {
    return 'month' in report;
  }

  isAnnual(report: ReportData): report is AnnualReport {
    return !this.isDaily(report) && !this.isMonthly(report);
  }

  private download(content: string, filename: string): void {
    this.downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8' }), filename);
  }

  private downloadBlob(content: Blob, filename: string): void {
    const url = URL.createObjectURL(content);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private fileStem(report: ReportData): string {
    if (this.isDaily(report)) return `hubon-relatorio-diario-${report.date}`;
    if (this.isMonthly(report)) return `hubon-relatorio-mensal-${report.year}-${String(report.month).padStart(2, '0')}`;
    return `hubon-relatorio-anual-${report.year}`;
  }

  private applyQueryParams(params: ParamMap): boolean {
    const before = this.filterKey();
    const period = params.get('period')?.toUpperCase();
    if (period === 'DAILY' || period === 'MONTHLY' || period === 'ANNUAL') this.period = period;
    const date = params.get('date');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) this.date = date;
    const month = Number(params.get('month'));
    if (Number.isInteger(month) && month >= 1 && month <= 12) this.month = month;
    const year = Number(params.get('year'));
    if (Number.isInteger(year) && year >= 2000 && year <= 2100) this.year = year;
    const channel = params.get('channel')?.toUpperCase();
    if (channel === 'ALL' || channel === 'TABLE' || channel === 'COUNTER') this.channel = channel;
    const sort = parseReportProductSort(params.get('sort')) ?? 'REVENUE';
    const direction = parseReportSortDirection(params.get('direction')) ?? defaultReportSortDirection(sort);
    this.productSort.set(sort);
    this.productSortDirection.set(direction);
    return before !== this.filterKey();
  }

  private syncQueryParams(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        period: this.period.toLowerCase(),
        date: this.period === 'DAILY' ? this.date : null,
        month: this.period === 'MONTHLY' ? this.month : null,
        year: this.period === 'DAILY' ? null : this.year,
        channel: this.channel,
        sort: this.productSort(),
        direction: this.productSortDirection(),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private filterKey(): string {
    return [this.period, this.date, this.month, this.year, this.channel].join('|');
  }

  private localDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private repositionExportMenu(): void {
    const trigger = this.exportMenuTrigger;
    const view = this.document.defaultView;
    const menu = this.document.getElementById('report-export-menu');
    if (!this.exportMenuOpen() || !trigger?.isConnected || !view || !menu) return;
    this.exportMenuPosition.set(calculateOverlayPosition(
      trigger.getBoundingClientRect(),
      menu.getBoundingClientRect(),
      view.innerWidth,
      view.innerHeight,
      this.exportMenuGap,
      this.exportMenuViewportMargin,
    ));
  }
}
