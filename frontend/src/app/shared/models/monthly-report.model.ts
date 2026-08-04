export type ReportChannel = 'ALL' | 'TABLE' | 'COUNTER';
export type ReportPeriod = 'DAILY' | 'MONTHLY' | 'ANNUAL';

export interface ReportVariantPerformance {
  variantName: string;
  quantity: number;
  salesAmount: number;
}

export interface ReportProductPerformance {
  productName: string;
  categoryName: string;
  quantity: number;
  salesAmount: number;
  revenueSharePercentage: number;
  variants: ReportVariantPerformance[];
}

export interface ReportSummary {
  grossRevenue: number;
  serviceFees: number;
  discounts: number;
  netRevenue: number;
  receivedAmount: number;
  closedTabs: number;
  orders: number;
  itemsSold: number;
  averageTicket: number;
  tableSales: number;
  counterSales: number;
  cancelledOrders: number;
  cancelledItems: number;
  cancelledAmount: number;
}

export interface ReportCancellationSummary {
  cancelledOrders: number;
  cancelledItems: number;
  cancelledAmount: number;
  mainReasons: { reason: string; occurrences: number }[];
}

export interface ReportPerformance {
  closedTabs: number;
  orders: number;
  itemsSold: number;
  grossRevenue: number;
  serviceFees: number;
  discounts: number;
  netRevenue: number;
  receivedAmount: number;
  averageTicket: number;
}

export interface ReportSaleDetail {
  id: number;
  origin: string;
  openedAt: string;
  closedAt: string;
  durationMinutes: number;
  responsible: string;
  orders: number;
  items: number;
  grossRevenue: number;
  serviceFees: number;
  discounts: number;
  finalAmount: number;
  receivedAmount: number;
  paymentMethods: string;
}

interface ConsolidatedReport {
  periodLabel: string;
  channel: ReportChannel;
  summary: ReportSummary;
  products: ReportProductPerformance[];
  categories: { categoryName: string; quantity: number; salesAmount: number; revenueSharePercentage: number }[];
  paymentMethods: { method: string; payments: number; amount: number; receivedSharePercentage: number }[];
  channels: { channel: string; closedTabs: number; netRevenue: number; averageTicket: number }[];
  sales: ReportSaleDetail[];
  cancellations: ReportCancellationSummary;
}

export interface DailyReport extends ConsolidatedReport {
  date: string;
  comparison: {
    previousDayNetRevenue: number;
    netRevenueDifference: number;
    percentageChange: number | null;
  };
  hourly: (ReportPerformance & { hour: number; hourLabel: string })[];
}

export interface MonthlyReport extends ConsolidatedReport {
  year: number;
  month: number;
  comparison: {
    previousMonthNetRevenue: number;
    netRevenueDifference: number;
    percentageChange: number | null;
  };
  daily: (ReportPerformance & { date: string })[];
}

export interface AnnualReport extends ConsolidatedReport {
  year: number;
  comparison: {
    previousYearNetRevenue: number;
    netRevenueDifference: number;
    percentageChange: number | null;
  };
  monthly: (ReportPerformance & { month: number; monthLabel: string; cancelledAmount: number })[];
  indicators: {
    bestMonthLabel: string;
    bestMonthNetRevenue: number;
    averageMonthlyRevenue: number;
    activeMonths: number;
  };
}

export type ReportData = DailyReport | MonthlyReport | AnnualReport;
