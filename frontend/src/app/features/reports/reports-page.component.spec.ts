import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthlyReportApiService } from '../../core/services/monthly-report-api.service';
import { AnnualReport, MonthlyReport } from '../../shared/models/monthly-report.model';
import { ReportsPageComponent } from './reports-page.component';

describe('ReportsPageComponent', () => {
  const report: MonthlyReport = {
    year: 2026,
    month: 7,
    periodLabel: 'Julho de 2026',
    channel: 'ALL',
    summary: {
      grossRevenue: 150,
      serviceFees: 10,
      discounts: 5,
      netRevenue: 155,
      receivedAmount: 155,
      closedTabs: 2,
      orders: 2,
      itemsSold: 3,
      averageTicket: 77.5,
    },
    comparison: { previousMonthNetRevenue: 100, netRevenueDifference: 55, percentageChange: 55 },
    products: [
      { productName: 'Suco', categoryName: 'Bebidas', quantity: 1, salesAmount: 50, revenueSharePercentage: 32.26, variants: [{ variantName: 'Copo', quantity: 1, salesAmount: 50 }] },
      { productName: 'Água', categoryName: 'Bebidas', quantity: 2, salesAmount: 100, revenueSharePercentage: 64.52, variants: [{ variantName: 'Garrafa', quantity: 2, salesAmount: 100 }] },
    ],
    categories: [{ categoryName: 'Bebidas', quantity: 3, salesAmount: 150, revenueSharePercentage: 100 }],
    paymentMethods: [{ method: 'PIX', payments: 2, amount: 155, receivedSharePercentage: 100 }],
    channels: [{ channel: 'COUNTER', closedTabs: 2, netRevenue: 155, averageTicket: 77.5 }],
    daily: [{ date: '2026-07-10', closedTabs: 2, netRevenue: 155, averageTicket: 77.5 }],
    cancellations: { cancelledOrders: 0, cancelledItems: 0, cancelledAmount: 0, mainReasons: [] },
  };

  const annualReport: AnnualReport = {
    year: 2026,
    periodLabel: 'Ano de 2026',
    channel: 'ALL',
    summary: report.summary,
    comparison: { previousYearNetRevenue: 100, netRevenueDifference: 55, percentageChange: 55 },
    products: report.products,
    categories: report.categories,
    paymentMethods: report.paymentMethods,
    channels: report.channels,
    monthly: [
      { month: 1, monthLabel: 'Janeiro', closedTabs: 1, netRevenue: 55, averageTicket: 55 },
      { month: 7, monthLabel: 'Julho', closedTabs: 1, netRevenue: 100, averageTicket: 100 },
    ],
    cancellations: report.cancellations,
  };

  const api = {
    getMonthly: vi.fn(() => of(report)),
    getAnnual: vi.fn(() => of(annualReport)),
    getMonthlyPdf: vi.fn(() => of(new Blob(['monthly-pdf'], { type: 'application/pdf' }))),
    getAnnualPdf: vi.fn(() => of(new Blob(['annual-pdf'], { type: 'application/pdf' }))),
  };
  let animationFrameCallbacks: FrameRequestCallback[];

  beforeEach(async () => {
    vi.clearAllMocks();
    animationFrameCallbacks = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);
      return animationFrameCallbacks.length;
    });
    api.getMonthly.mockReturnValue(of(report));
    api.getAnnual.mockReturnValue(of(annualReport));
    api.getMonthlyPdf.mockReturnValue(of(new Blob(['monthly-pdf'], { type: 'application/pdf' })));
    api.getAnnualPdf.mockReturnValue(of(new Blob(['annual-pdf'], { type: 'application/pdf' })));
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
    const fixture = createComponent();
    const component = fixture.componentInstance;

    expect(api.getMonthly).toHaveBeenCalledWith(component.year, component.month, 'ALL');
    component.setChannel('COUNTER');
    expect(api.getMonthly).toHaveBeenLastCalledWith(component.year, component.month, 'COUNTER');
    expect(component.report()).toEqual(report);
  });

  it('loads the annual consolidation and reuses the same product sorting controls', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.setPeriod('ANNUAL');
    fixture.detectChanges();

    expect(api.getAnnual).toHaveBeenCalledWith(component.year, 'ALL');
    expect(component.report()).toEqual(annualReport);
    expect(component.seriesTitle()).toBe('Receita por mês');
    expect(component.revenueSeries().map((item) => item.label)).toEqual(['Janeiro', 'Julho']);
    expect(fixture.nativeElement.textContent).toContain('Relatório anual');
    expect(fixture.nativeElement.textContent).toContain('2 produtos no período');
    const periodButtons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.report-filters .segmented-control button'),
    ).slice(0, 2);
    expect(periodButtons.map((button) => button.classList.contains('active'))).toEqual([false, true]);

    component.setProductSort('NAME');
    component.setProductSortDirection('DESC');
    expect(component.sortedProducts().map((item) => item.productName)).toEqual(['Suco', 'Água']);
    expect(api.getAnnual).toHaveBeenCalledTimes(1);
  });

  it('keeps the loading state until the request completes', () => {
    const pending = new Subject<MonthlyReport>();
    api.getMonthly.mockReturnValue(pending);
    const fixture = createComponent();
    const component = fixture.componentInstance;

    expect(component.loading()).toBe(true);
    pending.next(report);
    pending.complete();
    expect(component.loading()).toBe(false);
    expect(component.report()).toEqual(report);
  });

  it('shows empty and error states without retaining stale report data', () => {
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
    expect(component.error()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível gerar o relatório');
  });

  it('sorts products by revenue, quantity and name', () => {
    const component = createComponent().componentInstance;
    expect(component.sortedProducts().map((item) => item.productName)).toEqual(['Água', 'Suco']);

    component.setProductSort('QUANTITY');
    expect(component.sortedProducts().map((item) => item.productName)).toEqual(['Água', 'Suco']);

    component.setProductSort('NAME');
    expect(component.productSortDirection()).toBe('ASC');
    expect(component.sortedProducts().map((item) => item.productName)).toEqual(['Água', 'Suco']);

    component.setProductSortDirection('DESC');
    expect(component.sortedProducts().map((item) => item.productName)).toEqual(['Suco', 'Água']);
  });

  it('keeps sorting in the URL without requesting the report again', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?sort=NAME&direction=DESC');
    const fixture = createComponent();
    const component = fixture.componentInstance;

    expect(component.productSort()).toBe('NAME');
    expect(component.productSortDirection()).toBe('DESC');
    expect(api.getMonthly).toHaveBeenCalledTimes(1);

    component.setProductSort('QUANTITY');
    await fixture.whenStable();

    expect(router.url).toContain('sort=QUANTITY');
    expect(router.url).toContain('direction=DESC');
    expect(api.getMonthly).toHaveBeenCalledTimes(1);

    await router.navigateByUrl('/?sort=REVENUE&direction=ASC');
    await fixture.whenStable();
    expect(component.productSort()).toBe('REVENUE');
    expect(component.productSortDirection()).toBe('ASC');
    expect(api.getMonthly).toHaveBeenCalledTimes(1);
  });

  it('shows contextual counts and removes inactive sorting controls for short lists', () => {
    const multiple = createComponent();
    expect(multiple.nativeElement.textContent).toContain('2 produtos no período');
    expect(multiple.nativeElement.querySelectorAll('.report-sort-criteria button')).toHaveLength(3);

    multiple.destroy();
    api.getMonthly.mockReturnValueOnce(of({ ...report, products: [report.products[0]] }));
    const single = createComponent();
    expect(single.nativeElement.textContent).toContain('1 produto no período');
    expect(single.nativeElement.querySelector('.report-sort-criteria')).toBeNull();

    single.destroy();
    api.getMonthly.mockReturnValueOnce(of({ ...report, products: [] }));
    const empty = createComponent();
    expect(empty.nativeElement.textContent).toContain('Nenhum produto vendido no período');
    expect(empty.nativeElement.querySelector('.report-products-table')).toBeNull();
  });

  it('exports products in the selected order and leaves the summary unchanged', () => {
    const component = createComponent().componentInstance;
    const download = vi.spyOn(
      component as unknown as { download(content: string, filename: string): void },
      'download',
    ).mockImplementation(() => undefined);

    component.setProductSort('NAME');
    component.setProductSortDirection('DESC');
    component.exportProducts();
    const productsCsv = download.mock.calls[0][0];
    expect(productsCsv.indexOf('Suco')).toBeLessThan(productsCsv.indexOf('Água'));

    component.exportSummary();
    const firstSummary = download.mock.calls[1][0];
    component.setProductSort('QUANTITY');
    component.exportSummary();
    expect(download.mock.calls[2][0]).toBe(firstSummary);
  });

  it('uses the fixed business order while printing and restores the selected view', () => {
    const component = createComponent().componentInstance;
    component.setProductSort('NAME');
    component.setProductSortDirection('DESC');
    expect(component.displayedProducts().map((item) => item.productName)).toEqual(['Suco', 'Água']);

    component.preparePrint();
    expect(component.displayedProducts().map((item) => item.productName)).toEqual(['Água', 'Suco']);

    component.restoreAfterPrint();
    expect(component.displayedProducts().map((item) => item.productName)).toEqual(['Suco', 'Água']);
  });

  it('groups the report commands and keeps export options in a compact menu', () => {
    const fixture = createComponent();
    const actions = fixture.nativeElement.querySelector('.page-header-actions') as HTMLElement;

    expect(actions).not.toBeNull();
    expect(Array.from(actions.querySelectorAll('button')).map((button) => button.textContent?.trim())).toEqual([
      'Exportar',
      'Baixar PDF',
    ]);

    const trigger = actions.querySelector<HTMLButtonElement>('[aria-controls="report-export-menu"]')!;
    trigger.click();
    fixture.detectChanges();
    flushAnimationFrame();

    const menu = document.querySelector('#report-export-menu') as HTMLElement;
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Exportar resumo CSV',
      'Exportar produtos CSV',
    ]);
    expect(document.activeElement).toBe(items[0]);
  });

  it('downloads the server-rendered PDF instead of printing the Angular route', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const downloadBlob = vi.spyOn(
      component as unknown as { downloadBlob(content: Blob, filename: string): void },
      'downloadBlob',
    ).mockImplementation(() => undefined);
    const browserPrint = vi.spyOn(window, 'print').mockImplementation(() => undefined);

    const pdfButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.page-header-actions button'),
    ).find((button) => button.textContent?.includes('Baixar PDF'))!;
    pdfButton.click();

    expect(api.getMonthlyPdf).toHaveBeenCalledWith(report.year, report.month, 'ALL');
    expect(downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      `hubon-relatorio-mensal-${report.year}-${String(report.month).padStart(2, '0')}.pdf`,
    );
    expect(browserPrint).not.toHaveBeenCalled();
  });

  it('identifies the active sorting criterion with text, style and aria-pressed', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.setProductSort('QUANTITY');
    fixture.detectChanges();

    const active = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.report-sort-criteria button.active')!;
    expect(active.textContent?.trim()).toBe('Quantidade');
    expect(active.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('.report-sort-direction').textContent).toContain('Decrescente');
  });

  it('supports menu keyboard navigation, Escape, focus return and outside click', async () => {
    const fixture = createComponent();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-controls="report-export-menu"]')!;

    trigger.click();
    fixture.detectChanges();
    flushAnimationFrame();
    const items = Array.from(document.querySelectorAll<HTMLButtonElement>('#report-export-menu [role="menuitem"]'));
    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);

    items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await Promise.resolve();
    expect(document.querySelector('#report-export-menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    fixture.detectChanges();
    flushAnimationFrame();
    expect(document.querySelector('#report-export-menu')).not.toBeNull();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(document.querySelector('#report-export-menu')).toBeNull();
  });

  it('exports annual CSVs in the selected order and requests a fixed-order PDF', () => {
    const component = createComponent().componentInstance;
    component.setPeriod('ANNUAL');
    component.setProductSort('NAME');
    component.setProductSortDirection('DESC');
    const download = vi.spyOn(
      component as unknown as { download(content: string, filename: string): void },
      'download',
    ).mockImplementation(() => undefined);
    const downloadBlob = vi.spyOn(
      component as unknown as { downloadBlob(content: Blob, filename: string): void },
      'downloadBlob',
    ).mockImplementation(() => undefined);

    component.exportProducts();
    component.exportSummary();
    component.exportPdf();

    expect(download.mock.calls[0][0].indexOf('Suco')).toBeLessThan(download.mock.calls[0][0].indexOf('Água'));
    expect(download.mock.calls[0][1]).toBe('hubon-produtos-anual-2026.csv');
    expect(download.mock.calls[1][0]).toContain('Relatório anual;Ano de 2026');
    expect(api.getAnnualPdf).toHaveBeenCalledWith(2026, 'ALL');
    expect(api.getMonthlyPdf).not.toHaveBeenCalled();
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'hubon-relatorio-anual-2026.pdf');
  });
});
