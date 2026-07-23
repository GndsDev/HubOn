export type UnitOfMeasure = 'KG' | 'G' | 'L' | 'ML' | 'UN' | 'CX' | 'PACKAGE' | 'TRAY';

export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NORMAL';

export interface Ingredient {
  id: number;
  name: string;
  description: string | null;
  unit: UnitOfMeasure;
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
  minimumStock: number;
  idealStock: number;
  active: boolean;
}
