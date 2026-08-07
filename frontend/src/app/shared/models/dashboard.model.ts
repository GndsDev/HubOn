export interface DashboardSummary {
  todaySales: number;
  openSales: number;
  openTableSales: number;
  openCounterSales: number;
  pendingPayments: number;
  averageTicket: number;
  tableSummary: {
    free: number;
    occupied: number;
    disabled: number;
    total: number;
  };
  cashSummary: {
    received: number;
    openAmount: number;
    cancelledAmount: number;
  };
  recentSales: Array<{
    id: number;
    tableNumber: number | null;
    originLabel: string;
    status: string;
    amount: number;
    createdAt: string;
  }>;
}
