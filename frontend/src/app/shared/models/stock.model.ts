export type UnitOfMeasure = 'KG' | 'G' | 'L' | 'ML' | 'UN' | 'CX' | 'PACKAGE' | 'TRAY';
export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NORMAL';
export type StockMovementType = 'ENTRY' | 'SALE' | 'SALE_REVERSAL' | 'EXIT' | 'LOSS' | 'ADJUSTMENT';

export interface StockItem {
  id: number;
  name: string;
  description: string | null;
  unit: UnitOfMeasure;
  currentStock: number;
  minimumStock: number;
  status: StockStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockItemRequest {
  name: string;
  description: string | null;
  unit: UnitOfMeasure;
  currentStock: number;
  minimumStock: number;
  active: boolean;
}

export interface StockMovement {
  id: number;
  stockItemId: number;
  stockItemName: string;
  unit: UnitOfMeasure;
  type: StockMovementType;
  deltaQuantity: number;
  previousBalance: number;
  resultingBalance: number;
  saleItemId: number | null;
  reversedMovementId: number | null;
  reason: string | null;
  createdByUserId: number;
  createdByUserName: string;
  createdAt: string;
}

export interface StockQuantityRequest {
  stockItemId: number;
  quantity: number;
  reason: string | null;
}

export interface StockLossRequest extends StockQuantityRequest {
  reason: string;
}

export interface StockAdjustmentRequest {
  stockItemId: number;
  newStock: number;
  reason: string;
}

export interface ProductStockLink {
  id: number;
  productId: number;
  productName: string;
  stockItemId: number;
  stockItemName: string;
  unit: UnitOfMeasure;
  quantityPerSale: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductStockLinkRequest {
  stockItemId: number;
  quantityPerSale: number;
}

export interface ProductOptionStockLink {
  id: number;
  productOptionId: number;
  stockItemId: number;
  stockItemName: string;
  unit: UnitOfMeasure;
  quantityPerSelection: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductOptionStockLinkRequest {
  stockItemId: number;
  quantityPerSelection: number;
}
