export type ReportChannel = 'ALL' | 'TABLE' | 'COUNTER';
export type ReportPeriod = 'DAILY' | 'MONTHLY' | 'ANNUAL';

export interface ReportSummary {
  grossRevenue: number;
  serviceFees: number;
  discounts: number;
  netRevenue: number;
  receivedAmount: number;
  closedSales: number;
  itemsSold: number;
  averageTicket: number;
  tableSales: number;
  counterSales: number;
  cancelledSales: number;
  cancelledItems: number;
  cancelledAmount: number;
}

export interface ReportProductPerformance { productName: string; categoryName: string | null; quantity: number; salesAmount: number; revenueSharePercentage: number; }
export interface ReportCategoryPerformance { categoryName: string; quantity: number; salesAmount: number; revenueSharePercentage: number; }
export interface ReportPaymentPerformance { method: string; payments: number; amount: number; receivedSharePercentage: number; }
export interface ReportChannelPerformance { channel: string; closedSales: number; netRevenue: number; averageTicket: number; }
export interface ReportPerformance { closedSales: number; itemsSold: number; grossRevenue: number; serviceFees: number; discounts: number; netRevenue: number; receivedAmount: number; averageTicket: number; }
export interface ReportSaleDetail { id: number; origin: string; openedAt: string; closedAt: string; durationMinutes: number; responsible: string; items: number; grossRevenue: number; serviceFees: number; discounts: number; finalAmount: number; receivedAmount: number; paymentMethods: string; }
export interface ReportCancellationSummary { cancelledSales: number; cancelledItems: number; cancelledAmount: number; mainReasons: Array<{ reason: string; occurrences: number }>; }

interface ConsolidatedReport {
  periodLabel: string;
  channel: ReportChannel;
  summary: ReportSummary;
  products: ReportProductPerformance[];
  categories: ReportCategoryPerformance[];
  paymentMethods: ReportPaymentPerformance[];
  channels: ReportChannelPerformance[];
  sales: ReportSaleDetail[];
  cancellations: ReportCancellationSummary;
}

export interface DailyReport extends ConsolidatedReport {
  date: string;
  comparison: { previousDayNetRevenue: number; netRevenueDifference: number; percentageChange: number | null };
  hourly: Array<ReportPerformance & { hour: number; hourLabel: string }>;
}

export interface MonthlyReport extends ConsolidatedReport {
  year: number;
  month: number;
  comparison: { previousMonthNetRevenue: number; netRevenueDifference: number; percentageChange: number | null };
  daily: Array<ReportPerformance & { date: string }>;
}

export interface AnnualReport extends ConsolidatedReport {
  year: number;
  comparison: { previousYearNetRevenue: number; netRevenueDifference: number; percentageChange: number | null };
  monthly: Array<ReportPerformance & { month: number; monthLabel: string; cancelledAmount: number }>;
  indicators: { bestMonthLabel: string; bestMonthNetRevenue: number; averageMonthlyRevenue: number; activeMonths: number };
}

export type ReportData = DailyReport | MonthlyReport | AnnualReport;
