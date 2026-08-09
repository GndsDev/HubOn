export type SaleType = 'TABLE' | 'COUNTER';
export type SaleStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'VOUCHER';

export interface SaleItemOption {
  id: number;
  productOptionId: number;
  optionGroupName: string;
  optionName: string;
  additionalPrice: number;
}

export interface SaleItem {
  id: number;
  productId: number;
  productName: string;
  categoryName: string | null;
  baseUnitPrice: number;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  notes: string | null;
  options: SaleItemOption[];
  createdByUserId: number;
  createdByUserName: string;
  createdAt: string;
  cancelledAt: string | null;
  cancelledByUserId: number | null;
  cancelledByUserName: string | null;
  cancellationReason: string | null;
}

export interface Payment {
  id: number;
  saleId: number;
  method: PaymentMethod;
  amount: number;
  paidAt: string;
  receivedByUserId: number;
  receivedByUserName: string;
}

export interface Sale {
  id: number;
  type: SaleType;
  status: SaleStatus;
  tableNumber: number | null;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: number;
  serviceFee: number;
  discountAmount: number;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  items: SaleItem[];
  payments: Payment[];
  openedByUserId: number;
  openedByUserName: string;
  openedAt: string;
  closedByUserId: number | null;
  closedByUserName: string | null;
  closedAt: string | null;
  closedBusinessDate: string | null;
  cancelledByUserId: number | null;
  cancelledByUserName: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface OpenSaleRequest {
  type: SaleType;
  tableNumber: number | null;
  customerName: string | null;
  customerPhone: string | null;
  serviceFee: number;
  discountAmount: number;
}

export interface AddSaleItemRequest {
  productId: number;
  quantity: number;
  notes: string | null;
  optionIds: number[];
}

export interface UpdateSaleItemQuantityRequest {
  quantity: number;
}

export interface PaymentRequest {
  method: PaymentMethod;
  amount: number;
  receivedByUserId?: number;
}

export interface CancellationRequest {
  reason: string;
}
