import { TabStatus } from './tab.model';
import { PreparationFlow } from './product.model';

export type OrderStatus =
  | 'CREATED'
  | 'SENT_TO_KITCHEN'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';
export type OrderType = 'TABLE' | 'COUNTER' | 'TAKEAWAY';
export type OrderItemStatus =
  | 'DRAFT'
  | 'WAITING_PREPARATION'
  | 'IN_PREPARATION'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELED';

export interface OrderItemOption {
  id: number;
  optionId: number | null;
  groupName: string;
  optionName: string;
  additionalPrice: number;
}

export interface OrderItem {
  id: number;
  productId: number;
  variantId: number | null;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  displayNameSnapshot: string;
  categoryNameSnapshot: string;
  preparationFlow: PreparationFlow;
  unitPriceSnapshot: number;
  quantity: number;
  notes: string | null;
  status: OrderItemStatus;
  subtotal: number;
  options: OrderItemOption[];
  cancellationReason: string | null;
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
  confirmedAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface OrderItemRequest {
  productId: number;
  variantId: number;
  quantity: number;
  notes: string | null;
  optionIds: number[];
}

export interface RestaurantOrderRequest {
  tabId: number;
  type: OrderType;
  notes: string | null;
  items: OrderItemRequest[];
}
