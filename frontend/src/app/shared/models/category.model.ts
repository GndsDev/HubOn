export interface Category {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRequest {
  name: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
}
