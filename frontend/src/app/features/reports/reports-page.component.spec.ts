import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthlyReportApiService } from '../../core/services/monthly-report-api.service';
import { AnnualReport, DailyReport, MonthlyReport, ReportPerformance } from '../../shared/models/monthly-report.model';
import { ReportsPageComponent } from './reports-page.component';

describe('ReportsPageComponent', () => {
  const performance: ReportPerformance = {
    closedTabs: 2,
    orders: 2,
    itemsSold: 3,
    grossRevenue: 160,
    serviceFees: 10,
    discounts: 5,
    netRevenue: 155,
    receivedAmount: 155,
    averageTicket: 77.5,
  };
  const summary = {
    ...performance,
    tableSales: 1,
    counterSales: 1,
    cancelledOrders: 0,
    cancelledItems: 0,
    cancelledAmount: 0,
  };
  const sales = [{
    id: 1,
    origin: 'Mesa 1',
    openedAt: '2026-07-10T11:00:00',
    closedAt: '2026-07-10T12:00:00',
    durationMinutes: 60,
    responsible: 'Operador',
    orders: 2,
    items: 3,
    grossRevenue: 160,
    serviceFees: 10,
    discounts: 5,
    finalAmount: 155,
    receivedAmount: 155,
    paymentMethods: 'PIX',
  }];
  const shared = {
    periodLabel: 'Julho de 2026',
    channel: 'ALL' as const,
    summary,
    products: [
      { productName: 'Suco', categoryName: 'Bebidas', quantity: 1, salesAmount: 50, revenueSharePercentage: 32.26, variants: [{ variantName: 'Copo', quantity: 1, salesAmount: 50 }] },
      { productName: 'Água', categoryName: 'Bebidas', quantity: 2, salesAmount: 100, revenueSharePercentage: 64.52, variants: [{ variantName: 'Garrafa', quantity: 2, salesAmount: 100 }] },
    ],
    categories: [{ categoryName: 'Bebidas', quantity: 3, salesAmount: 150, revenueSharePercentage: 100 }],
    paymentMethods: [{ method: 'PIX', payments: 2, amount: 155, receivedSharePercentage: 100 }],
    channels: [{ channel: 'COUNTER', closedTabs: 2, netRevenue: 155, averageTicket: 77.5 }],
    sales,
    cancellations: { cancelledOrders: 0, cancelledItems: 0, cancelledAmount: 0, mainReasons: [] },
  };
  const report: MonthlyReport = {
    ...shared,
    year: 2026,
    month: 7,
    comparison: { previousMonthNetRevenue: 100, netRevenueDifference: 55, percentageChange: 55 },
    daily: [{ date: '2026-07-10', ...performance }],
  };
  const dailyReport: DailyReport = {
    ...shared,
    periodLabel: '10 de julho de 2026',
    date: '2026-07-10',
    comparison: { previousDayNetRevenue: 100, netRevenueDifference: 55, percentageChange: 55 },
    hourly: [{ hour: 12, hourLabel: '12:00-12:59', ...performance }],
  };
  const annualReport: AnnualReport = {
    ...shared,
    year: 2026,
    periodLabel: 'Ano de 2026',
    comparison: { previousYearNetRevenue: 100, netRevenueDifference: 55, percentageChange: 55 },
    monthly: [
      { month: 1, monthLabel: 'Janeiro', cancelledAmount: 0, ...performance, closedTabs: 1, netRevenue: 55, averageTicket: 55 },
      { month: 7, monthLabel: 'Julho', cancelledAmount: 0, ...performance, closedTabs: 1, netRevenue: 100, averageTicket: 100 },
    ],
    indicators: { bestMonthLabel: 'Julho', bestMonthNetRevenue: 100, averageMonthlyRevenue: 12.92, activeMonths: 2 },
  };

  const pdfBlob = new Blob(['pdf'], { type: 'application/pdf' });
  const xlsxBlob = new Blob(['xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const api = {
    getDaily: vi.fn(() => of(dailyReport)),
    getMonthly: vi.fn(() => of(report)),
    getAnnual: vi.fn(() => of(annualReport)),
    getDailyPdf: vi.fn(() => of(pdfBlob)),
    getMonthlyPdf: vi.fn(() => of(pdfBlob)),
    getAnnualPdf: vi.fn(() => of(pdfBlob)),
    getDailyXlsx: vi.fn(() => of(xlsxBlob)),
    getMonthlyXlsx: vi.fn(() => of(xlsxBlob)),
    getAnnualXlsx: vi.fn(() => of(xlsxBlob)),
  };
  let animationFrameCallbacks: FrameRequestCallback[];

  beforeEach(async () => {
    vi.clearAllMocks();
    animationFrameCallbacks = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);
      return animationFrameCallbacks.length;
    });
    api.getDaily.mockReturnValue(of(dailyReport));
    api.getMonthly.mockReturnValue(of(report));
    api.getAnnual.mockReturnValue(of(annualReport));
    api.getDailyPdf.mockReturnValue(of(pdfBlob));
    api.getMonthlyPdf.mockReturnValue(of(pdfBlob));
    api.getAnnualPdf.mockReturnValue(of(pdfBlob));
    api.getDailyXlsx.mockReturnValue(of(xlsxBlob));
    api.getMonthlyXlsx.mockReturnValue(of(xlsxBlob));
    api.getAnnualXlsx.mockReturnValue(of(xlsxBlob));
    await TestBed.configureTestingModule({
      imports: [ReportsPageComponent],
      providers: [{ provide: MonthlyReportApiService, useValue: api }, provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('#report-export-menu').forEach((element) => element.remove());
  });

  function createComponent() {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushAnimationFrame(): void {
    animationFrameCallbacks.splice(0).forEach((callback) => callback(0));
  }

  it('loads the selected period and reloads when the channel changes', () => {
    const component = createComponent().componentInstance;

    expect(api.getMonthly).toHaveBeenCalledWith(component.year, component.month, 'ALL');
    component.setChannel('COUNTER');

    expect(api.getMonthly).toHaveBeenLastCalledWith(component.year, component.month, 'COUNTER');
  });

  it('navigates from daily to monthly and annual while preserving filters in the URL', async () => {
    const router = TestBed.inject(Router);
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.date = '2026-07-10';
    component.setPeriod('DAILY');
    await fixture.whenStable();
    expect(api.getDaily).toHaveBeenCalledWith('2026-07-10', 'ALL');
    expect(router.url).toContain('period=daily');
    expect(router.url).toContain('date=2026-07-10');

    component.setPeriod('ANNUAL');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(api.getAnnual).toHaveBeenCalledWith(component.year, 'ALL');
    expect(fixture.nativeElement.textContent).toContain('Melhor mês');
    expect(fixture.nativeElement.textContent).toContain('Julho');
  });

  it('moves the selected reference backward and forward', () => {
    const component = createComponent().componentInstance;
    component.year = 2026;
    component.month = 1;

    component.shiftPeriod(-1);
    expect([component.year, component.month]).toEqual([2025, 12]);

    component.setPeriod('DAILY');
    component.date = '2026-07-10';
    component.shiftPeriod(1);
    expect(component.date).toBe('2026-07-11');
  });

  it('keeps the loading state until the request completes', () => {
    const pending = new Subject<MonthlyReport>();
    api.getMonthly.mockReturnValue(pending);
    const component = createComponent().componentInstance;

    expect(component.loading()).toBe(true);
    pending.next(report);
    pending.complete();
    expect(component.loading()).toBe(false);
    expect(component.report()).toEqual(report);
  });

  it('shows empty and error states without retaining stale data', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    api.getMonthly.mockReturnValueOnce(of({ ...report, summary: { ...report.summary, closedTabs: 0 } }));
    component.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum resultado neste período');

    api.getMonthly.mockReturnValueOnce(throwError(() => ({ error: { message: 'Falha controlada' } })));
    component.load();
    fixture.detectChanges();
    expect(component.report()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível gerar o relatório');
  });

  it('sorts products without requesting the report again and reflects it in the URL', async () => {
    const router = TestBed.inject(Router);
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.setProductSort('NAME');
    component.setProductSortDirection('DESC');
    await fixture.whenStable();

    expect(component.sortedProducts().map((item) => item.productName)).toEqual(['Suco', 'Água']);
    expect(router.url).toContain('sort=NAME');
    expect(router.url).toContain('direction=DESC');
    expect(api.getMonthly).toHaveBeenCalledTimes(1);
  });

  it('exports enriched summary, products and sale details', () => {
    const component = createComponent().componentInstance;
    const download = vi.spyOn(
      component as unknown as { download(content: string, filename: string): void },
      'download',
    ).mockImplementation(() => undefined);

    component.exportSummary();
    component.exportProducts();
    component.exportSales();

    expect(download.mock.calls[0][0]).toContain('Vendas em mesas;1');
    expect(download.mock.calls[0][0]).toContain('Taxa de serviço');
    expect(download.mock.calls[1][0]).toContain('Variação');
    expect(download.mock.calls[2][0]).toContain('Responsável');
    expect(download.mock.calls[2][0]).toContain('Mesa 1');
  });

  it('groups four export options in an accessible keyboard menu', async () => {
    const fixture = createComponent();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-controls="report-export-menu"]')!;
    trigger.click();
    fixture.detectChanges();
    flushAnimationFrame();

    const items = Array.from(document.querySelectorAll<HTMLButtonElement>('#report-export-menu [role="menuitem"]'));
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Resumo e evolução CSV',
      'Produtos e variações CSV',
      'Vendas detalhadas CSV',
      'Excel completo XLSX',
    ]);
    expect(document.activeElement).toBe(items[0]);

    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(items[3]);
    items[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await Promise.resolve();
    expect(document.querySelector('#report-export-menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('downloads server-rendered PDF and XLSX files', () => {
    const component = createComponent().componentInstance;
    const downloadBlob = vi.spyOn(
      component as unknown as { downloadBlob(content: Blob, filename: string): void },
      'downloadBlob',
    ).mockImplementation(() => undefined);

    component.exportPdf();
    component.exportXlsx();

    expect(api.getMonthlyPdf).toHaveBeenCalledWith(2026, 7, 'ALL');
    expect(api.getMonthlyXlsx).toHaveBeenCalledWith(2026, 7, 'ALL');
    expect(downloadBlob).toHaveBeenCalledWith(pdfBlob, 'hubon-relatorio-mensal-2026-07.pdf');
    expect(downloadBlob).toHaveBeenCalledWith(xlsxBlob, 'hubon-relatorio-mensal-2026-07.xlsx');
  });

  it('paginates sale details with stable page bounds', () => {
    const manySales = Array.from({ length: 25 }, (_, index) => ({ ...sales[0], id: index + 1 }));
    api.getMonthly.mockReturnValueOnce(of({ ...report, sales: manySales }));
    const component = createComponent().componentInstance;

    expect(component.displayedSales()).toHaveLength(20);
    expect(component.salesPageCount()).toBe(2);
    component.setSalesPage(1);
    expect(component.displayedSales()).toHaveLength(5);
    component.setSalesPage(99);
    expect(component.salesPage()).toBe(1);
  });
});
