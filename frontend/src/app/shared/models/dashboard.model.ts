export type MetricTone = 'blue' | 'purple' | 'emerald' | 'amber';

export interface StatMetric {
  label: string;
  value: string;
  detail: string;
  icon: string;
  tone: MetricTone;
  trend: string;
}

export interface RecentOrder {
  id: string;
  table: string;
  status: string;
  amount: string;
  time: string;
  tone: 'info' | 'warning' | 'success';
}

export interface BestSeller {
  name: string;
  category: string;
  quantity: number;
  revenue: string;
}

export interface TableStatusSummary {
  label: string;
  value: number;
  total: number;
  tone: 'free' | 'occupied' | 'reserved' | 'disabled';
}

export interface CashierSummary {
  label: string;
  value: string;
  detail: string;
}

export interface DashboardSnapshot {
  stats: StatMetric[];
  recentOrders: RecentOrder[];
  bestSellers: BestSeller[];
  tableStatus: TableStatusSummary[];
  cashier: CashierSummary[];
}
