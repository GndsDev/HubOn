export type RestaurantTableStatus = 'free' | 'occupied' | 'reserved' | 'disabled';

export interface RestaurantTableView {
  id: number;
  number: number;
  seats: number;
  status: RestaurantTableStatus;
  amount: string;
  openedFor: string;
  waiter: string;
}
