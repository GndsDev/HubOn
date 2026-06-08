export type KitchenColumnStatus = 'received' | 'preparing' | 'ready';
export type KitchenPriority = 'normal' | 'high' | 'urgent';

export interface KitchenOrderItem {
  quantity: number;
  name: string;
}

export interface KitchenOrder {
  id: string;
  table: string;
  elapsed: string;
  priority: KitchenPriority;
  notes: string;
  status: KitchenColumnStatus;
  items: KitchenOrderItem[];
}

export interface OrderListItem {
  id: string;
  table: string;
  status: string;
  total: string;
  items: string;
  createdAt: string;
}

export interface TabListItem {
  id: string;
  table: string;
  waiter: string;
  openedAt: string;
  total: string;
  status: string;
}
