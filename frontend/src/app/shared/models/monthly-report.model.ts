export type ReportChannel = 'ALL' | 'TABLE' | 'COUNTER';

export interface MonthlyReport {
  year: number;
  month: number;
  periodLabel: string;
  channel: ReportChannel;
  summary: {
    grossRevenue: number;
    serviceFees: number;
    discounts: number;
    netRevenue: number;
    receivedAmount: number;
    closedTabs: number;
    orders: number;
    itemsSold: number;
    averageTicket: number;
  };
  comparison: {
    previousMonthNetRevenue: number;
    netRevenueDifference: number;
    percentageChange: number | null;
  };
  products: {
    productName: string;
    categoryName: string;
    quantity: number;
    salesAmount: number;
    revenueSharePercentage: number;
    variants: { variantName: string; quantity: number; salesAmount: number }[];
  }[];
  categories: { categoryName: string; quantity: number; salesAmount: number; revenueSharePercentage: number }[];
  paymentMethods: { method: string; payments: number; amount: number; receivedSharePercentage: number }[];
  channels: { channel: string; closedTabs: number; netRevenue: number; averageTicket: number }[];
  daily: { date: string; closedTabs: number; netRevenue: number; averageTicket: number }[];
  cancellations: {
    cancelledOrders: number;
    cancelledItems: number;
    cancelledAmount: number;
    mainReasons: { reason: string; occurrences: number }[];
  };
}
