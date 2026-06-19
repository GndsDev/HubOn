export type TabStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';

export interface Tab {
  id: number;
  tableId: number;
  tableNumber: number;
  tableName: string | null;
  status: TabStatus;
  openedByUserId: number;
  openedByUserName: string;
  openedAt: string;
  closedAt: string | null;
  totalAmount: number;
  serviceFee: number;
  discountAmount: number;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export interface OpenTabRequest {
  tableId: number;
  openedByUserId?: number;
  serviceFee: number;
  discountAmount: number;
}
