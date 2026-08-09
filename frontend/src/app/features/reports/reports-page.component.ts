import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { MonthlyReportApiService } from '../../core/services/monthly-report-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import {
  ReportChannel,
  ReportData,
  ReportPeriod,
} from '../../shared/models/monthly-report.model';
import { apiErrorMessage } from '../../shared/util/api-error';

type ReportView = 'SUMMARY' | 'RAW' | 'EXPORTS';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, PageHeaderComponent, SectionCardComponent],
  template: `
    <app-page-header
      kicker="Gestão"
      title="Relatórios"
      description="Resultados consolidados de comandas e vendas de balcão."
    />

    <nav class="report-view-navigation" aria-label="Seções dos relatórios">
      <button
        type="button"
        [class.active]="view === 'SUMMARY'"
        [attr.aria-current]="view === 'SUMMARY' ? 'page' : null"
        (click)="view = 'SUMMARY'"
      >
        <i class="pi pi-chart-bar"></i>
        Resumo
      </button>
      <button
        type="button"
        [class.active]="view === 'RAW'"
        [attr.aria-current]="view === 'RAW' ? 'page' : null"
        (click)="view = 'RAW'"
      >
        <i class="pi pi-table"></i>
        Dados brutos
      </button>
      <button
        type="button"
        [class.active]="view === 'EXPORTS'"
        [attr.aria-current]="view === 'EXPORTS' ? 'page' : null"
        (click)="view = 'EXPORTS'"
      >
        <i class="pi pi-download"></i>
        Exportações
      </button>
    </nav>

    <section class="report-filters" aria-label="Filtros do relatório">
      <div class="field report-period-filter">
        <span>Período</span>
        <div class="segmented-control">
          <button type="button" [class.active]="period === 'DAILY'" (click)="setPeriod('DAILY')">
            Diário
          </button>
          <button type="button" [class.active]="period === 'MONTHLY'" (click)="setPeriod('MONTHLY')">
            Mensal
          </button>
          <button type="button" [class.active]="period === 'ANNUAL'" (click)="setPeriod('ANNUAL')">
            Anual
          </button>
        </div>
      </div>

      <div class="field report-reference-filter">
        <span>Referência</span>
        <div class="report-reference-controls">
          @if (period === 'DAILY') {
            <input type="date" aria-label="Data do relatório" [(ngModel)]="date" (change)="load()" />
          }

          @if (period === 'MONTHLY') {
            <select aria-label="Mês do relatório" [(ngModel)]="month" (change)="load()">
              @for (name of months; track $index) {
                <option [ngValue]="$index + 1">{{ name }}</option>
              }
            </select>
          }

          @if (period !== 'DAILY') {
            <input
              type="number"
              min="2020"
              max="2100"
              aria-label="Ano do relatório"
              [(ngModel)]="year"
              (change)="load()"
            />
          }

          <button
            type="button"
            class="icon-button"
            title="Atualizar"
            aria-label="Atualizar relatório"
            [disabled]="loading()"
            (click)="load()"
          >
            <i class="pi pi-refresh"></i>
          </button>
        </div>
      </div>

      <label class="field report-channel-filter">
        <span>Origem</span>
        <select [(ngModel)]="channel" (change)="load()">
          <option value="ALL">Todas</option>
          <option value="TABLE">Comandas</option>
          <option value="COUNTER">Balcão</option>
        </select>
      </label>
    </section>

    @if (loading()) {
      <section class="report-loading" aria-label="Carregando relatório">
        @for (item of [1, 2, 3, 4]; track item) {
          <div class="premium-card loading-card"></div>
        }
      </section>
    } @else if (error()) {
      <div class="error-panel" role="alert">
        <i class="pi pi-exclamation-triangle"></i>
        <div>
          <strong>Não foi possível gerar o relatório</strong>
          <p>{{ error() }}</p>
        </div>
        <button type="button" class="ghost-button" (click)="load()">
          <i class="pi pi-refresh"></i>
          Tentar novamente
        </button>
      </div>
    } @else if (report(); as data) {
      @if (view === 'SUMMARY') {
        <section class="report-metrics" aria-label="Resumo do período">
          <article class="report-metric-primary">
            <span>Faturamento líquido</span>
            <strong>{{ currency(data.summary.netRevenue) }}</strong>
            <small>Bruto {{ currency(data.summary.grossRevenue) }}</small>
          </article>
          <article>
            <span>Vendas concluídas</span>
            <strong>{{ data.summary.closedSales }}</strong>
            <small>{{ data.summary.tableSales }} comandas · {{ data.summary.counterSales }} balcão</small>
          </article>
          <article class="report-metric-informative">
            <span>Recebido</span>
            <strong>{{ currency(data.summary.receivedAmount) }}</strong>
            <small>{{ data.summary.itemsSold }} itens vendidos</small>
          </article>
          <article>
            <span>Ticket médio</span>
            <strong>{{ currency(data.summary.averageTicket) }}</strong>
            <small>{{ data.periodLabel }}</small>
          </article>
        </section>

        @if (data.summary.closedSales === 0) {
          <app-empty-state
            icon="pi pi-chart-bar"
            title="Sem vendas concluídas"
            description="Ainda não há movimento para o período selecionado."
          />
        } @else {
          <section class="report-grid">
            <app-section-card eyebrow="Catálogo" title="Produtos vendidos">
              <div class="report-ranking">
                @for (product of data.products; track product.productName) {
                  <article>
                    <div>
                      <strong>{{ product.productName }}</strong>
                      <small>{{ product.categoryName || 'Sem categoria' }} · {{ product.quantity }} un.</small>
                    </div>
                    <b>{{ currency(product.salesAmount) }}</b>
                  </article>
                } @empty {
                  <app-empty-state
                    icon="pi pi-box"
                    title="Sem produtos"
                    description="Nenhum item vendido no período."
                  />
                }
              </div>
            </app-section-card>

            <app-section-card eyebrow="Recebimentos" title="Formas de pagamento">
              <div class="report-ranking">
                @for (method of data.paymentMethods; track method.method) {
                  <article>
                    <div>
                      <strong>{{ paymentMethodLabel(method.method) }}</strong>
                      <small>
                        {{ method.payments }} pagamento{{ method.payments === 1 ? '' : 's' }} ·
                        {{ percent(method.receivedSharePercentage) }}
                      </small>
                    </div>
                    <b>{{ currency(method.amount) }}</b>
                  </article>
                }
              </div>
            </app-section-card>
          </section>
        }

        <section class="report-cancellations" aria-label="Resumo de cancelamentos">
          <div>
            <i class="pi pi-times-circle"></i>
            <span>
              <strong>Cancelamentos</strong>
              <small>
                {{ data.cancellations.cancelledSales }} venda{{ data.cancellations.cancelledSales === 1 ? '' : 's' }} ·
                {{ data.cancellations.cancelledItems }} ite{{ data.cancellations.cancelledItems === 1 ? 'm' : 'ns' }}
              </small>
            </span>
          </div>
          <strong>{{ currency(data.cancellations.cancelledAmount) }}</strong>
        </section>

        @if (data.cancellations.mainReasons.length) {
          <div class="report-cancellation-reasons" aria-label="Principais motivos de cancelamento">
            @for (reason of data.cancellations.mainReasons; track reason.reason) {
              <span>{{ reason.reason }} · {{ reason.occurrences }}</span>
            }
          </div>
        }
      } @else if (view === 'RAW') {
        <app-section-card eyebrow="Operação" title="Dados brutos das vendas">
          <span card-action class="report-sales-count">
            {{ data.sales.length }} venda{{ data.sales.length === 1 ? '' : 's' }}
          </span>

          @if (data.sales.length) {
            <div class="report-sales-table" role="region" aria-label="Dados brutos das vendas" tabindex="0">
              <table>
                <thead>
                  <tr>
                    <th>Origem</th>
                    <th>Fechamento</th>
                    <th>Responsável</th>
                    <th>Itens</th>
                    <th>Total</th>
                    <th>Recebido</th>
                    <th>Pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  @for (sale of data.sales; track sale.id) {
                    <tr>
                      <td>
                        <strong>{{ sale.origin }}</strong>
                        <small>Venda #{{ sale.id }} · {{ duration(sale.durationMinutes) }}</small>
                      </td>
                      <td>{{ dateTime(sale.closedAt) }}</td>
                      <td>{{ sale.responsible }}</td>
                      <td>{{ sale.items }} un.</td>
                      <td><strong>{{ currency(sale.finalAmount) }}</strong></td>
                      <td><strong>{{ currency(sale.receivedAmount) }}</strong></td>
                      <td>{{ paymentList(sale.paymentMethods) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <app-empty-state
              icon="pi pi-table"
              title="Sem dados brutos"
              description="Nenhuma venda concluída no período selecionado."
            />
          }
        </app-section-card>
      } @else {
        <app-section-card eyebrow="Arquivos" title="Exportar relatório">
          <span card-action class="report-sales-count">{{ data.periodLabel }}</span>

          <div class="report-export-list">
            <button type="button" (click)="export('CSV')" [disabled]="exporting()">
              <span class="report-export-icon csv"><i class="pi pi-file"></i></span>
              <span>
                <strong>CSV</strong>
                <small>Dados brutos para importação e análise.</small>
              </span>
              <i class="pi pi-download"></i>
            </button>
            <button type="button" (click)="export('XLSX')" [disabled]="exporting()">
              <span class="report-export-icon xlsx"><i class="pi pi-file-excel"></i></span>
              <span>
                <strong>Excel</strong>
                <small>Planilha formatada com resumo e detalhamento.</small>
              </span>
              <i class="pi pi-download"></i>
            </button>
            <button type="button" (click)="export('PDF')" [disabled]="exporting()">
              <span class="report-export-icon pdf"><i class="pi pi-file-pdf"></i></span>
              <span>
                <strong>PDF</strong>
                <small>Documento pronto para consulta e compartilhamento.</small>
              </span>
              <i class="pi pi-download"></i>
            </button>
          </div>

          <p class="report-export-note">
            <i class="pi pi-info-circle"></i>
            Os arquivos respeitam o período e a origem selecionados nos filtros acima.
          </p>
        </app-section-card>
      }
    }
  `,
})
export class ReportsPageComponent implements OnInit {
  private readonly api = inject(MonthlyReportApiService);
  private readonly feedback = inject(FeedbackService);
  readonly report = signal<ReportData | null>(null);
  readonly loading = signal(true);
  readonly exporting = signal(false);
  readonly error = signal<string | null>(null);
  view: ReportView = 'SUMMARY';
  period: ReportPeriod = 'MONTHLY';
  channel: ReportChannel = 'ALL';
  date = this.isoDate(new Date());
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  readonly months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  ngOnInit(): void {
    this.load();
  }

  setPeriod(period: ReportPeriod): void {
    this.period = period;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.reportRequest().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (report) => this.report.set(report),
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  export(format: 'CSV' | 'PDF' | 'XLSX'): void {
    if (!this.report() || this.exporting()) return;
    if (format === 'CSV') {
      this.exportCsv(this.report()!);
      return;
    }

    this.exporting.set(true);
    this.exportRequest(format).pipe(finalize(() => this.exporting.set(false))).subscribe({
      next: (blob) => {
        this.download(blob, format.toLocaleLowerCase());
        this.feedback.success(`${format} gerado.`);
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  paymentMethodLabel(method: string): string {
    return ({
      CASH: 'Dinheiro',
      CREDIT_CARD: 'Crédito',
      DEBIT_CARD: 'Débito',
      PIX: 'PIX',
      VOUCHER: 'Voucher',
    } as Record<string, string>)[method] ?? method;
  }

  paymentList(value: string): string {
    return value
      ? value.split(',').map((method) => this.paymentMethodLabel(method.trim())).join(', ')
      : 'Sem pagamento';
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  percent(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
  }

  dateTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }

  duration(minutes: number): string {
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }

  private reportRequest(): Observable<ReportData> {
    if (this.period === 'DAILY') return this.api.getDaily(this.date, this.channel);
    if (this.period === 'ANNUAL') return this.api.getAnnual(this.year, this.channel);
    return this.api.getMonthly(this.year, this.month, this.channel);
  }

  private exportRequest(format: 'PDF' | 'XLSX'): Observable<Blob> {
    if (this.period === 'DAILY') {
      return format === 'PDF'
        ? this.api.getDailyPdf(this.date, this.channel)
        : this.api.getDailyXlsx(this.date, this.channel);
    }
    if (this.period === 'ANNUAL') {
      return format === 'PDF'
        ? this.api.getAnnualPdf(this.year, this.channel)
        : this.api.getAnnualXlsx(this.year, this.channel);
    }
    return format === 'PDF'
      ? this.api.getMonthlyPdf(this.year, this.month, this.channel)
      : this.api.getMonthlyXlsx(this.year, this.month, this.channel);
  }

  private exportCsv(data: ReportData): void {
    const headers = [
      'Venda', 'Origem', 'Fechamento', 'Responsável', 'Itens',
      'Total', 'Recebido', 'Pagamento',
    ];
    const rows = data.sales.map((sale) => [
      sale.id,
      sale.origin,
      this.dateTime(sale.closedAt),
      sale.responsible,
      sale.items,
      this.decimal(sale.finalAmount),
      this.decimal(sale.receivedAmount),
      this.paymentList(sale.paymentMethods),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => this.csvCell(value)).join(';'))
      .join('\r\n');
    this.download(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), 'csv');
    this.feedback.success('CSV gerado.');
  }

  private download(blob: Blob, extension: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hubon-${this.period.toLocaleLowerCase()}-${this.reference()}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private reference(): string {
    if (this.period === 'DAILY') return this.date;
    if (this.period === 'MONTHLY') return `${this.year}-${String(this.month).padStart(2, '0')}`;
    return String(this.year);
  }

  private decimal(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }

  private csvCell(value: string | number): string {
    return `"${String(value).replaceAll('"', '""')}"`;
  }

  private isoDate(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }
}
