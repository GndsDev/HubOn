export type ReportChannel = 'ALL' | 'TABLE' | 'COUNTER';
export type ReportPeriod = 'MONTHLY' | 'ANNUAL';

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
}

export interface ReportCancellationSummary {
  cancelledOrders: number;
  cancelledItems: number;
  cancelledAmount: number;
  mainReasons: { reason: string; occurrences: number }[];
}

interface ConsolidatedReport {
  year: number;
  periodLabel: string;
  channel: ReportChannel;
  summary: ReportSummary;
  products: ReportProductPerformance[];
  categories: { categoryName: string; quantity: number; salesAmount: number; revenueSharePercentage: number }[];
  paymentMethods: { method: string; payments: number; amount: number; receivedSharePercentage: number }[];
  channels: { channel: string; closedTabs: number; netRevenue: number; averageTicket: number }[];
  cancellations: ReportCancellationSummary;
}

export interface MonthlyReport extends ConsolidatedReport {
  month: number;
  comparison: {
    previousMonthNetRevenue: number;
    netRevenueDifference: number;
    percentageChange: number | null;
  };
  daily: { date: string; closedTabs: number; netRevenue: number; averageTicket: number }[];
}

export interface AnnualReport extends ConsolidatedReport {
  comparison: {
    previousYearNetRevenue: number;
    netRevenueDifference: number;
    percentageChange: number | null;
  };
  monthly: { month: number; monthLabel: string; closedTabs: number; netRevenue: number; averageTicket: number }[];
}

export type ReportData = MonthlyReport | AnnualReport;
