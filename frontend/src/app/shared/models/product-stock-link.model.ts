import { UnitOfMeasure } from './ingredient.model';

export interface ProductStockLinkRequest {
  stockItemId: number;
  quantityPerSale: number;
}

export interface ProductStockLink {
  id: number;
  variantId: number;
  variantName: string;
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
