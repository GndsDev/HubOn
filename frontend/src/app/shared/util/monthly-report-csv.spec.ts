import { describe, expect, it } from 'vitest';
import { MonthlyReport } from '../models/monthly-report.model';
import { monthlyProductsCsv, monthlySummaryCsv } from './monthly-report-csv';

const report: MonthlyReport = {
  year: 2026,
  month: 7,
  periodLabel: 'julho de 2026',
  channel: 'COUNTER',
  summary: {
    grossRevenue: 110,
    serviceFees: 10,
    discounts: 5,
    netRevenue: 105,
    receivedAmount: 105,
    closedTabs: 2,
    orders: 2,
    itemsSold: 4,
    averageTicket: 52.5,
  },
  comparison: { previousMonthNetRevenue: 0, netRevenueDifference: 105, percentageChange: null },
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
  daily: [{ date: '2026-07-10', closedTabs: 2, netRevenue: 105, averageTicket: 52.5 }],
  cancellations: { cancelledOrders: 1, cancelledItems: 1, cancelledAmount: 10, mainReasons: [] },
};

describe('monthly report CSV', () => {
  it('exports the filtered period, channel and summary values', () => {
    const csv = monthlySummaryCsv(report);
    expect(csv).toContain('julho de 2026');
    expect(csv).toContain('Canal;Balcão');
    expect(csv).toContain('Receita líquida;105,00');
  });

  it('includes daily results and operational quantities', () => {
    const csv = monthlySummaryCsv(report);
    expect(csv).toContain('Pedidos concluídos;2');
    expect(csv).toContain('Itens vendidos;4');
    expect(csv).toContain('2026-07-10;2;105,00');
  });

  it('keeps variants separated in the products export', () => {
    const csv = monthlyProductsCsv(report);
    expect(csv).toContain('Lata;Bebidas;3;60,00');
    expect(csv).toContain('600 mL;Bebidas;1;40,00');
  });

  it('escapes cells containing the CSV separator', () => {
    expect(monthlyProductsCsv(report)).toContain('"Coca-Cola; Especial"');
  });
});
