export type TabStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type TabType = 'TABLE' | 'COUNTER';
export type CounterAttendanceState = 'ASSEMBLING' | 'CONFIRMED' | 'IN_PROGRESS' | 'READY_TO_FINISH' | 'FINISHED' | 'CANCELLED';
export type CounterPreparationState = 'NOT_APPLICABLE' | 'WAITING_PAYMENT' | 'WAITING' | 'IN_PREPARATION' | 'PARTIALLY_READY' | 'READY' | 'DELIVERED';
export type CounterFinancialState = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type CounterNextAction = 'ADD_ITEMS' | 'CONFIRM_ORDER' | 'FOLLOW_PREPARATION' | 'REGISTER_PAYMENT' | 'COMPLETE_PAYMENT' | 'DELIVER' | 'FINALIZE' | 'VIEW' | 'NONE';

export interface Tab {
  id: number;
  type: TabType;
  tableId: number | null;
  tableNumber: number | null;
  tableName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  identificationNote: string | null;
  displayLabel: string;
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

export interface OpenCounterTabRequest {
  customerName: string | null;
  customerPhone: string | null;
  identificationNote: string | null;
  serviceFee: number;
  discountAmount: number;
}

export interface UpdateCounterTabRequest {
  customerName: string | null;
  customerPhone: string | null;
  identificationNote: string | null;
}

export interface CounterSaleSummary {
  id: number;
  number: number;
  displayLabel: string;
  customerName: string | null;
  openedAt: string;
  closedAt: string | null;
  openedByUserName: string;
  tabStatus: TabStatus;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  itemCount: number;
  draftItemCount: number;
  waitingItemCount: number;
  inPreparationItemCount: number;
  readyItemCount: number;
  deliveredItemCount: number;
  attendanceState: CounterAttendanceState;
  preparationState: CounterPreparationState;
  financialState: CounterFinancialState;
  nextAction: CounterNextAction;
  cancellationAllowed: boolean;
}

export interface CounterSaleDetail {
  summary: CounterSaleSummary;
  customerPhone: string | null;
  identificationNote: string | null;
  orders: import('./order.model').RestaurantOrder[];
}

export interface CounterHistoryFilters {
  from?: string;
  to?: string;
  number?: number | null;
  customer?: string;
  status?: Exclude<TabStatus, 'OPEN'> | '';
  operator?: string;
}

export interface OpenTabRequest {
  tableId: number;
  openedByUserId?: number;
  serviceFee: number;
  discountAmount: number;
}
