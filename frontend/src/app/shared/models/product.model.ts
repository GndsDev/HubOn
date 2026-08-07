export type PreparationFlow = 'REQUIRES_PREPARATION' | 'DIRECT_SERVICE';

export interface ProductOption {
  id: number;
  groupId: number;
  name: string;
  additionalPrice: number;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductOptionGroup {
  id: number;
  productId: number;
  name: string;
  required?: boolean;
  minimumSelections: number;
  maximumSelections: number;
  displayOrder: number;
  active: boolean;
  options: ProductOption[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: number;
  productId: number;
  productName: string;
  name: string;
  sku: string | null;
  price: number;
  active: boolean;
  available: boolean;
  displayOrder: number;
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
  categoryId: number | null;
  categoryName: string | null;
  categoryActive: boolean;
  name: string;
  description: string | null;
  price: number;
  preparationFlow: PreparationFlow;
  active: boolean;
  available: boolean;
  displayOrder: number;
  imageUrl: string | null;
  variantCount: number;
  activeVariantCount: number;
  sellableVariantCount: number;
  minimumVariantPrice: number | null;
  maximumVariantPrice: number | null;
  hasAutomaticStockLink: boolean;
  complete: boolean;
  variants: ProductVariant[];
  optionGroups: ProductOptionGroup[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductRequest {
  categoryId: number | null;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  available: boolean;
  displayOrder: number;
}

export interface ProductVariantRequest {
  name: string;
  sku: string | null;
  price: number;
  active: boolean;
  available: boolean;
  displayOrder: number;
}

export interface ProductOptionRequest {
  name: string;
  additionalPrice: number;
  displayOrder: number;
  active: boolean;
}

export interface ProductOptionGroupRequest {
  name: string;
  minimumSelections: number;
  maximumSelections: number;
  displayOrder: number;
  active: boolean;
  options: ProductOptionRequest[];
}

export interface ProductVariantRegistrationRequest {
  variant: ProductVariantRequest;
  stockItemId: number | null;
  quantityPerSale: number | null;
}

export interface ProductRegistrationRequest {
  product: ProductRequest;
  optionGroups: ProductOptionGroupRequest[];
}
