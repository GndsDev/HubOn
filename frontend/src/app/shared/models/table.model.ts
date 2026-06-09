export type RestaurantTableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'DISABLED';

export interface RestaurantTable {
  id: number;
  number: number;
  name: string | null;
  status: RestaurantTableStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantTableRequest {
  number: number;
  name: string | null;
  status: RestaurantTableStatus;
  active: boolean;
}

export interface TableStatusRequest {
  status: RestaurantTableStatus;
}
