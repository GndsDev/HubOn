export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'VOUCHER';

export interface Payment {
  id: number;
  tabId: number;
  method: PaymentMethod;
  amount: number;
  paidAt: string;
  receivedByUserId: number;
  receivedByUserName: string;
}

export interface PaymentRequest {
  tabId: number;
  method: PaymentMethod;
  amount: number;
  receivedByUserId?: number;
}

export interface PaymentSummary {
  tabId: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  payments: Payment[];
}

export type PaymentFinancialState = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type PaymentNextAction = 'COMPLETE_PAYMENT' | 'FOLLOW_PREPARATION' | 'DELIVER' | 'FINALIZE' | 'RETURN_TO_TAB';

export interface PaymentOperation {
  payment: Payment;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  financialState: PaymentFinancialState;
  orders: import('./order.model').RestaurantOrder[];
  nextAction: PaymentNextAction;
}
