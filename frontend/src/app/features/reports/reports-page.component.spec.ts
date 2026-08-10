import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackService } from '../../core/services/feedback.service';
import { MonthlyReportApiService } from '../../core/services/monthly-report-api.service';
import {
  AnnualReport,
  DailyReport,
  MonthlyReport,
  ReportPerformance,
  ReportSummary,
} from '../../shared/models/monthly-report.model';
import { ReportsPageComponent } from './reports-page.component';

const performance: ReportPerformance = {
  closedSales: 2,
  itemsSold: 3,
  grossRevenue: 160,
  serviceFees: 10,
  discounts: 5,
  netRevenue: 165,
  receivedAmount: 165,
  averageTicket: 82.5,
};

const summary: ReportSummary = {
  ...performance,
  tableSales: 1,
  counterSales: 1,
  cancelledSales: 0,
  cancelledItems: 0,
  cancelledAmount: 0,
};

const shared = {
  channel: 'ALL' as const,
  summary,
  products: [{ productName: 'Suco', categoryName: 'Bebidas', quantity: 3, salesAmount: 165, revenueSharePercentage: 100 }],
  categories: [{ categoryName: 'Bebidas', quantity: 3, salesAmount: 165, revenueSharePercentage: 100 }],
  paymentMethods: [{ method: 'PIX', payments: 2, amount: 165, receivedSharePercentage: 100 }],
  channels: [{ channel: 'COUNTER', closedSales: 2, netRevenue: 165, averageTicket: 82.5 }],
  sales: [{
    id: 1,
    origin: 'Balcao #1',
    openedAt: '2026-08-07T11:00:00',
    closedAt: '2026-08-07T12:00:00',
    durationMinutes: 60,
    responsible: 'Gerente',
    items: 3,
    grossRevenue: 160,
    serviceFees: 10,
    discounts: 5,
    finalAmount: 165,
    receivedAmount: 165,
    paymentMethods: 'PIX',
  }],
  cancellations: { cancelledSales: 0, cancelledItems: 0, cancelledAmount: 0, mainReasons: [] },
};

const monthlyReport: MonthlyReport = {
  ...shared,
  year: 2026,
  month: 8,
  periodLabel: 'Agosto de 2026',
  comparison: { previousMonthNetRevenue: 100, netRevenueDifference: 65, percentageChange: 65 },
  daily: [{ date: '2026-08-07', ...performance }],
};

const dailyReport: DailyReport = {
  ...shared,
  date: '2026-08-07',
  periodLabel: '7 de agosto de 2026',
  comparison: { previousDayNetRevenue: 100, netRevenueDifference: 65, percentageChange: 65 },
  hourly: [{ hour: 12, hourLabel: '12:00-12:59', ...performance }],
};

const annualReport: AnnualReport = {
  ...shared,
  year: 2026,
  periodLabel: 'Ano de 2026',
  comparison: { previousYearNetRevenue: 100, netRevenueDifference: 65, percentageChange: 65 },
  monthly: [{ month: 8, monthLabel: 'Agosto', cancelledAmount: 0, ...performance }],
  indicators: { bestMonthLabel: 'Agosto', bestMonthNetRevenue: 165, averageMonthlyRevenue: 20.63, activeMonths: 1 },
};

describe('ReportsPageComponent', () => {
  const pdf = new Blob(['pdf'], { type: 'application/pdf' });
  const xlsx = new Blob(['xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const api = {
    getDaily: vi.fn(() => of(dailyReport)),
    getMonthly: vi.fn(() => of(monthlyReport)),
    getAnnual: vi.fn(() => of(annualReport)),
    getDailyPdf: vi.fn(() => of(pdf)),
    getMonthlyPdf: vi.fn(() => of(pdf)),
    getAnnualPdf: vi.fn(() => of(pdf)),
    getDailyXlsx: vi.fn(() => of(xlsx)),
    getMonthlyXlsx: vi.fn(() => of(xlsx)),
    getAnnualXlsx: vi.fn(() => of(xlsx)),
  };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getDaily.mockReturnValue(of(dailyReport));
    api.getMonthly.mockReturnValue(of(monthlyReport));
    api.getAnnual.mockReturnValue(of(annualReport));
    api.getDailyPdf.mockReturnValue(of(pdf));
    api.getMonthlyPdf.mockReturnValue(of(pdf));
    api.getAnnualPdf.mockReturnValue(of(pdf));
    api.getDailyXlsx.mockReturnValue(of(xlsx));
    api.getMonthlyXlsx.mockReturnValue(of(xlsx));
    api.getAnnualXlsx.mockReturnValue(of(xlsx));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:report') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [ReportsPageComponent],
      providers: [
        { provide: MonthlyReportApiService, useValue: api },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
  });

  function component(): ReportsPageComponent {
    return TestBed.createComponent(ReportsPageComponent).componentInstance;
  }

  it('loads the monthly report with year, month and channel', () => {
    const instance = component();
    instance.year = 2026;
    instance.month = 8;
    instance.channel = 'TABLE';

    instance.load();

    expect(api.getMonthly).toHaveBeenCalledWith(2026, 8, 'TABLE');
    expect(instance.report()).toEqual(monthlyReport);
  });

  it('loads daily and annual reports from their current endpoints', () => {
    const instance = component();
    instance.date = '2026-08-07';
    instance.setPeriod('DAILY');
    expect(api.getDaily).toHaveBeenCalledWith('2026-08-07', 'ALL');
    expect(instance.report()).toEqual(dailyReport);

    instance.year = 2026;
    instance.setPeriod('ANNUAL');
    expect(api.getAnnual).toHaveBeenCalledWith(2026, 'ALL');
    expect(instance.report()).toEqual(annualReport);
  });

  it('keeps loading active until the report request completes', () => {
    const pending = new Subject<MonthlyReport>();
    api.getMonthly.mockReturnValueOnce(pending);
    const instance = component();

    instance.load();
    expect(instance.loading()).toBe(true);
    pending.next(monthlyReport);
    pending.complete();

    expect(instance.loading()).toBe(false);
    expect(instance.report()).toEqual(monthlyReport);
  });

  it('surfaces API errors and releases the loading state', () => {
    api.getMonthly.mockReturnValueOnce(throwError(() => ({ error: { message: 'Falha controlada' } })));
    const instance = component();

    instance.load();

    expect(instance.error()).toBeTruthy();
    expect(instance.loading()).toBe(false);
  });

  it('downloads monthly PDF and XLSX through the server endpoints', () => {
    const instance = component();
    instance.year = 2026;
    instance.month = 8;
    instance.channel = 'TABLE';
    instance.report.set(monthlyReport);

    instance.export('PDF');
    instance.export('XLSX');

    expect(api.getMonthlyPdf).toHaveBeenCalledWith(2026, 8, 'TABLE');
    expect(api.getMonthlyXlsx).toHaveBeenCalledWith(2026, 8, 'TABLE');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(feedback.success).toHaveBeenCalledWith('PDF gerado.');
    expect(feedback.success).toHaveBeenCalledWith('XLSX gerado.');
  });

  it('keeps the summary visible without raw-data or export tabs', () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Faturamento líquido');
    expect(text).toContain('Produtos vendidos');
    expect(text).not.toContain('Dados brutos');
    expect(text).not.toContain('Exportações');
    expect(fixture.nativeElement.querySelector('.report-view-navigation')).toBeNull();
  });

  it('opens a compact export dialog with CSV, XLSX and PDF', () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    fixture.detectChanges();

    const exportButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((button) => (button as HTMLButtonElement).textContent?.includes('Exportar dados')) as HTMLButtonElement;
    exportButton.click();
    fixture.detectChanges();

    const dialog = document.querySelector('.report-export-dialog') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('CSV');
    expect(dialog.textContent).toContain('XLSX');
    expect(dialog.textContent).toContain('PDF');
    expect(dialog.textContent).toContain('Dados tabulares das vendas');
  });

  it('generates an Excel-compatible CSV from the loaded sales', async () => {
    const instance = component();
    instance.report.set({
      ...monthlyReport,
      sales: [{ ...monthlyReport.sales[0], responsible: 'João "Chefe"; Norte' }],
    });

    instance.export('CSV');

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const content = new TextDecoder().decode(bytes);
    expect(content).toContain('"Venda";"Origem";"Abertura";"Fechamento";"Duração (min)"');
    expect(content).toContain('"João ""Chefe""; Norte"');
    expect(content).toContain('"165,00"');
    expect(api.getMonthlyPdf).not.toHaveBeenCalled();
    expect(api.getMonthlyXlsx).not.toHaveBeenCalled();
    expect(feedback.success).toHaveBeenCalledWith('CSV gerado.');
  });

  it('uses the daily and annual export endpoints for the selected period', () => {
    const instance = component();
    instance.date = '2026-08-07';
    instance.period = 'DAILY';
    instance.report.set(dailyReport);
    instance.export('PDF');
    expect(api.getDailyPdf).toHaveBeenCalledWith('2026-08-07', 'ALL');

    instance.period = 'ANNUAL';
    instance.report.set(annualReport);
    instance.export('XLSX');
    expect(api.getAnnualXlsx).toHaveBeenCalledWith(instance.year, 'ALL');
  });

  it('formats payment methods without legacy order fields', () => {
    const instance = component();

    expect(instance.paymentList('PIX,CREDIT_CARD')).toBe('PIX, Cr\u00e9dito');
    expect(instance.paymentList('')).toBe('Sem pagamento');
  });
});
