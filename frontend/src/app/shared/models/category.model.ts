export interface Category {
  id: number;
  name: string;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRequest {
  name: string;
  displayOrder: number;
  active: boolean;
}
