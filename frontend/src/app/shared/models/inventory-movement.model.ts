export type InventoryMovementType = 'ENTRY' | 'EXIT' | 'LOSS' | 'ADJUSTMENT' | 'REVERSAL';

export interface InventoryMovement {
  id: number;
  ingredientId: number;
  ingredientName: string;
  type: InventoryMovementType;
  quantity: number;
  previousStock: number;
  resultingStock: number;
  reason: string | null;
  userId: number;
  userName: string;
  createdAt: string;
}

export interface StockEntryRequest {
  ingredientId: number;
  quantity: number;
  reason: string | null;
}

export interface StockExitRequest {
  ingredientId: number;
  quantity: number;
  reason: string | null;
}

export interface StockLossRequest {
  ingredientId: number;
  quantity: number;
  reason: string;
}

export interface StockAdjustmentRequest {
  ingredientId: number;
  newStock: number;
  reason: string;
}
