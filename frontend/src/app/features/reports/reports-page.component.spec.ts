import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthlyReportApiService } from '../../core/services/monthly-report-api.service';
import { MonthlyReport } from '../../shared/models/monthly-report.model';
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
      { productName: 'Suco', categoryName: 'Bebidas', quantity: 1, salesAmount: 50, revenueSharePercentage: 32.26, variants: [] },
      { productName: 'Agua', categoryName: 'Bebidas', quantity: 2, salesAmount: 100, revenueSharePercentage: 64.52, variants: [] },
    ],
    categories: [{ categoryName: 'Bebidas', quantity: 3, salesAmount: 150, revenueSharePercentage: 100 }],
    paymentMethods: [{ method: 'PIX', payments: 2, amount: 155, receivedSharePercentage: 100 }],
    channels: [{ channel: 'COUNTER', closedTabs: 2, netRevenue: 155, averageTicket: 77.5 }],
    daily: [{ date: '2026-07-10', closedTabs: 2, netRevenue: 155, averageTicket: 77.5 }],
    cancellations: { cancelledOrders: 0, cancelledItems: 0, cancelledAmount: 0, mainReasons: [] },
  };

  const api = { getMonthly: vi.fn(() => of(report)) };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getMonthly.mockReturnValue(of(report));
    await TestBed.configureTestingModule({
      imports: [ReportsPageComponent],
      providers: [{ provide: MonthlyReportApiService, useValue: api }],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the selected period and reloads when the channel changes', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    expect(api.getMonthly).toHaveBeenCalledWith(component.year, component.month, 'ALL');
    component.setChannel('COUNTER');
    expect(api.getMonthly).toHaveBeenLastCalledWith(component.year, component.month, 'COUNTER');
    expect(component.report()).toEqual(report);
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
    expect(component.sortedProducts().map((item) => item.productName)).toEqual(['Agua', 'Suco']);

    component.productSort.set('QUANTITY');
    expect(component.sortedProducts().map((item) => item.productName)).toEqual(['Agua', 'Suco']);

    component.productSort.set('NAME');
    expect(component.sortedProducts().map((item) => item.productName)).toEqual(['Agua', 'Suco']);
  });
});
