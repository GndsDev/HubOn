export type RestaurantTableState = 'FREE' | 'OCCUPIED' | 'DISABLED';

export interface RestaurantTable {
  id: number;
  number: number;
  label: string | null;
  state: RestaurantTableState;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantTableRequest {
  number: number;
  label: string | null;
  active: boolean;
}
