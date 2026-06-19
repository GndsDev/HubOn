import { TabStatus } from './tab.model';

export type OrderStatus =
  | 'CREATED'
  | 'SENT_TO_KITCHEN'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';
export type OrderType = 'TABLE' | 'COUNTER' | 'TAKEAWAY';

export interface OrderItem {
  id: number;
  productId: number;
  productNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  notes: string | null;
  status: 'ACTIVE' | 'CANCELLED';
  subtotal: number;
}

export interface RestaurantOrder {
  id: number;
  tabId: number;
  tabStatus: TabStatus;
  tableId: number;
  tableNumber: number;
  status: OrderStatus;
  type: OrderType;
  createdByUserId: number;
  createdByUserName: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface OrderItemRequest {
  productId: number;
  quantity: number;
  notes: string | null;
}

export interface RestaurantOrderRequest {
  tabId: number;
  createdByUserId?: number;
  type: OrderType;
  notes: string | null;
  items: OrderItemRequest[];
}
