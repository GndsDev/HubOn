export interface Product {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRequest {
  categoryId: number;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  imageUrl: string | null;
}
