export interface DashboardBestSellingProduct {
  name: string;
  category: string;
  quantity: number;
  revenue: number;
}

export interface DashboardRecentOrder {
  id: number;
  tableNumber: number | null;
  originLabel: string;
  status: string;
  amount: number;
  createdAt: string;
}

export interface DashboardSummary {
  todaySales: number;
  openTabs: number;
  activeCounterSales: number;
  ordersInPreparation: number;
  readyOrders: number;
  pendingPayments: number;
  averageTicket: number;
  bestSellingProducts: DashboardBestSellingProduct[];
  tableSummary: {
    available: number;
    occupied: number;
    reserved: number;
    disabled: number;
    total: number;
  };
  cashSummary: {
    received: number;
    openAmount: number;
    cancelledAmount: number;
  };
  recentOrders: DashboardRecentOrder[];
}

export type MetricTone = 'blue' | 'purple' | 'emerald' | 'amber';

export interface StatMetric {
  label: string;
  value: string;
  detail: string;
  icon: string;
  tone: MetricTone;
  trend: string;
}
