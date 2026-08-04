import { describe, expect, it } from 'vitest';
import { AnnualReport, DailyReport, MonthlyReport, ReportPerformance } from '../models/monthly-report.model';
import {
  annualProductsCsv,
  annualSummaryCsv,
  dailySalesCsv,
  dailySummaryCsv,
  monthlyProductsCsv,
  monthlySalesCsv,
  monthlySummaryCsv,
} from './monthly-report-csv';

const performance: ReportPerformance = {
  closedTabs: 2,
  orders: 2,
  itemsSold: 4,
  grossRevenue: 110,
  serviceFees: 10,
  discounts: 5,
  netRevenue: 105,
  receivedAmount: 105,
  averageTicket: 52.5,
};
const shared = {
  periodLabel: 'Julho de 2026',
  channel: 'COUNTER' as const,
  summary: {
    ...performance,
    tableSales: 0,
    counterSales: 2,
    cancelledOrders: 1,
    cancelledItems: 1,
    cancelledAmount: 10,
  },
  products: [{
    productName: 'Coca-Cola; Especial',
    categoryName: 'Bebidas',
    quantity: 4,
    salesAmount: 100,
    revenueSharePercentage: 100,
    variants: [
      { variantName: 'Lata', quantity: 3, salesAmount: 60 },
      { variantName: '600 mL', quantity: 1, salesAmount: 40 },
    ],
  }],
  categories: [{ categoryName: 'Bebidas', quantity: 4, salesAmount: 100, revenueSharePercentage: 100 }],
  paymentMethods: [{ method: 'PIX', payments: 2, amount: 105, receivedSharePercentage: 100 }],
  channels: [{ channel: 'COUNTER', closedTabs: 2, netRevenue: 105, averageTicket: 52.5 }],
  sales: [{
    id: 10,
    origin: 'Balcão #10',
    openedAt: '2026-07-10T11:00:00',
    closedAt: '2026-07-10T12:00:00',
    durationMinutes: 60,
    responsible: 'Operador',
    orders: 2,
    items: 4,
    grossRevenue: 110,
    serviceFees: 10,
    discounts: 5,
    finalAmount: 105,
    receivedAmount: 105,
    paymentMethods: 'PIX',
  }],
  cancellations: { cancelledOrders: 1, cancelledItems: 1, cancelledAmount: 10, mainReasons: [] },
};
const report: MonthlyReport = {
  ...shared,
  year: 2026,
  month: 7,
  comparison: { previousMonthNetRevenue: 0, netRevenueDifference: 105, percentageChange: null },
  daily: [{ date: '2026-07-10', ...performance }],
};

describe('report CSV exports', () => {
  it('exports a UTF-8 monthly summary with enriched operational values', () => {
    const csv = monthlySummaryCsv(report);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Canal;Balcão');
    expect(csv).toContain('Vendas no balcão;2');
    expect(csv).toContain('Taxa de serviço;10,00');
    expect(csv).toContain('2026-07-10;2;2;4;110,00;10,00;5,00;105,00;105,00;52,50');
  });

  it('keeps variants separated, ordered and properly escaped', () => {
    const secondProduct = {
      ...report.products[0],
      productName: 'Água',
      variants: [{ variantName: 'Garrafa', quantity: 2, salesAmount: 50 }],
    };
    const csv = monthlyProductsCsv(report, [secondProduct, report.products[0]]);

    expect(csv.indexOf('Água')).toBeLessThan(csv.indexOf('Coca-Cola'));
    expect(csv.indexOf('Lata')).toBeLessThan(csv.indexOf('600 mL'));
    expect(csv).toContain('"Coca-Cola; Especial"');
  });

  it('exports auditable sale details', () => {
    const csv = monthlySalesCsv(report);
    expect(csv).toContain('Duração (min)');
    expect(csv).toContain('Responsável');
    expect(csv).toContain('Balcão #10');
    expect(csv).toContain('105,00;105,00;PIX');
  });

  it('exports daily hourly performance and sales', () => {
    const daily: DailyReport = {
      ...shared,
      date: '2026-07-10',
      comparison: { previousDayNetRevenue: 0, netRevenueDifference: 105, percentageChange: null },
      hourly: [{ hour: 12, hourLabel: '12:00-12:59', ...performance }],
    };

    expect(dailySummaryCsv(daily)).toContain('12:00-12:59;2;2;4');
    expect(dailySalesCsv(daily)).toContain('Balcão #10');
  });

  it('exports annual indicators and complete monthly performance', () => {
    const annual: AnnualReport = {
      ...shared,
      year: 2026,
      periodLabel: 'Ano de 2026',
      comparison: { previousYearNetRevenue: 50, netRevenueDifference: 55, percentageChange: 110 },
      monthly: [{ month: 1, monthLabel: 'Janeiro', cancelledAmount: 10, ...performance }],
      indicators: { bestMonthLabel: 'Janeiro', bestMonthNetRevenue: 105, averageMonthlyRevenue: 8.75, activeMonths: 1 },
    };
    const csv = annualSummaryCsv(annual);

    expect(csv).toContain('Relatório anual;Ano de 2026');
    expect(csv).toContain('Melhor mês;Janeiro');
    expect(csv).toContain('Janeiro;2;2;4;110,00;10,00;5,00;105,00;105,00;52,50;10,00');
    expect(annualProductsCsv(annual)).toContain('600 mL');
  });
});
