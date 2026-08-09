import { PaymentMethod } from './sale.model';

export type CashShiftStatus = 'OPEN' | 'CLOSED';
export type CashMovementType = 'SUPPLY' | 'WITHDRAWAL';

export interface CashMovement {
  id: string;
  type: string;
  origin: string;
  amount: number;
  method: PaymentMethod | null;
  responsible: string;
  reference: string;
  observation: string | null;
  occurredAt: string;
}

export interface CashShift {
  id: number;
  status: CashShiftStatus;
  openedByUserId: number;
  openedByUserName: string;
  openedAt: string;
  openingBalance: number;
  closedByUserId: number | null;
  closedByUserName: string | null;
  closedAt: string | null;
  receivedTotal: number;
  receivedByMethod: Partial<Record<PaymentMethod, number>>;
  cancellationAmount: number;
  supplyAmount: number;
  withdrawalAmount: number;
  expectedCash: number;
  countedCash: number | null;
  differenceAmount: number | null;
  closingNote: string | null;
  movements: CashMovement[];
}

export interface OpenCashShiftRequest { openingBalance: number; }
export interface CashMovementRequest { type: CashMovementType; amount: number; note: string; }
export interface CloseCashShiftRequest { countedCash: number; note: string | null; }
