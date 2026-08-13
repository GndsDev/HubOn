import { UnitOfMeasure } from './stock.model';

export type ExpenseCategory =
  | 'STOCK_PURCHASE'
  | 'FOOD'
  | 'BEVERAGE'
  | 'PACKAGING'
  | 'CLEANING'
  | 'MAINTENANCE'
  | 'UTILITIES'
  | 'TRANSPORT'
  | 'SERVICES'
  | 'TAX'
  | 'OTHER';

export type ExpensePaymentMethod =
  | 'CASH'
  | 'PIX'
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'BANK_TRANSFER'
  | 'BOLETO'
  | 'OTHER';

export type ExpenseStatus = 'PAID' | 'PENDING';
export type ExpenseValueMode = 'DIRECT' | 'DETAILED';

export interface Expense {
  id: number;
  expenseDate: string;
  description: string;
  category: ExpenseCategory;
  supplier: string | null;
  valueMode: ExpenseValueMode;
  quantity: number | null;
  unit: UnitOfMeasure | null;
  unitPrice: number | null;
  totalAmount: number;
  paymentMethod: ExpensePaymentMethod;
  status: ExpenseStatus;
  stockItemId: number | null;
  stockItemName: string | null;
  stockItemUnit: UnitOfMeasure | null;
  stockQuantity: number | null;
  stockMovementId: number | null;
  createdByUserId: number;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseRequest {
  expenseDate: string;
  description: string;
  category: ExpenseCategory;
  supplier: string | null;
  valueMode: ExpenseValueMode;
  quantity: number | null;
  unit: UnitOfMeasure | null;
  unitPrice: number | null;
  totalAmount: number | null;
  paymentMethod: ExpensePaymentMethod;
  status: ExpenseStatus;
  generateStockEntry: boolean;
  stockItemId: number | null;
  stockQuantity: number | null;
}

export interface ExpenseSummary {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  stockPurchaseAmount: number;
  expenseCount: number;
}

export interface ExpenseListResponse {
  summary: ExpenseSummary;
  items: Expense[];
}

export interface ExpenseFilters {
  from?: string;
  to?: string;
  category?: ExpenseCategory;
  status?: ExpenseStatus;
  paymentMethod?: ExpensePaymentMethod;
  search?: string;
}
