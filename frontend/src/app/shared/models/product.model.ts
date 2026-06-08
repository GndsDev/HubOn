export type ProductStatus = 'active' | 'inactive';

export interface ProductView {
  id: number;
  name: string;
  category: string;
  price: string;
  margin: string;
  status: ProductStatus;
}

export interface CategoryView {
  id: number;
  name: string;
  description: string;
  products: number;
  status: ProductStatus;
}
