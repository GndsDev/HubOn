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
  minimumSelections: number;
  maximumSelections: number;
  displayOrder: number;
  active: boolean;
  options: ProductOption[];
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  available: boolean;
  displayOrder: number;
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

export interface ProductRegistrationRequest {
  product: ProductRequest;
  optionGroups: ProductOptionGroupRequest[];
}
