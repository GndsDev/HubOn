export type PreparationFlow = 'KITCHEN' | 'DIRECT_SERVICE';

export interface ProductVariant {
  id: number;
  productId: number;
  productName: string;
  name: string;
  sku: string | null;
  price: number;
  active: boolean;
  stockLinkActive: boolean;
  stockLinkId: number | null;
  stockItemId: number | null;
  stockItemName: string | null;
  quantityPerSale: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  categoryId: number;
  categoryName: string;
  categoryActive: boolean;
  name: string;
  description: string | null;
  preparationFlow: PreparationFlow;
  active: boolean;
  imageUrl: string | null;
  activeVariantCount: number;
  minimumVariantPrice: number | null;
  hasAutomaticStockLink: boolean;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductRequest {
  categoryId: number;
  name: string;
  description: string | null;
  preparationFlow: PreparationFlow;
  active: boolean;
  imageUrl: string | null;
}

export interface ProductVariantRequest {
  name: string;
  sku: string | null;
  price: number;
  active: boolean;
}
