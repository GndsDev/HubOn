export type UnitOfMeasure = 'KG' | 'G' | 'L' | 'ML' | 'UN' | 'CX' | 'PACKAGE' | 'TRAY';

export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NORMAL';
export type StockControlMode = 'MANUAL' | 'DIRECT_SALE';

export interface Ingredient {
  id: number;
  name: string;
  description: string | null;
  unit: UnitOfMeasure;
  controlMode: StockControlMode;
  currentStock: number;
  minimumStock: number;
  idealStock: number;
  active: boolean;
  stockStatus: StockStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IngredientRequest {
  name: string;
  description: string | null;
  unit: UnitOfMeasure;
  controlMode: StockControlMode;
  minimumStock: number;
  idealStock: number;
  active: boolean;
}
