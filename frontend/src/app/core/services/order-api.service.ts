import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  OrderItemStatus,
  OrderStatus,
  RestaurantOrder,
  RestaurantOrderRequest,
} from '../../shared/models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/orders`;

  getAll(): Observable<RestaurantOrder[]> {
    return this.http.get<RestaurantOrder[]>(this.baseUrl);
  }

  getPreparationQueue(): Observable<RestaurantOrder[]> {
    return this.http.get<RestaurantOrder[]>(`${this.baseUrl}/preparation-queue`);
  }

  getById(id: number): Observable<RestaurantOrder> {
    return this.http.get<RestaurantOrder>(`${this.baseUrl}/${id}`);
  }

  getByTab(tabId: number): Observable<RestaurantOrder[]> {
    return this.http.get<RestaurantOrder[]>(`${this.baseUrl}/tab/${tabId}`);
  }

  create(request: RestaurantOrderRequest): Observable<RestaurantOrder> {
    return this.http.post<RestaurantOrder>(this.baseUrl, request);
  }

  updateDraft(id: number, request: RestaurantOrderRequest): Observable<RestaurantOrder> {
    return this.http.put<RestaurantOrder>(`${this.baseUrl}/${id}`, request);
  }

  confirm(id: number): Observable<RestaurantOrder> {
    return this.http.post<RestaurantOrder>(`${this.baseUrl}/${id}/confirm`, {});
  }

  sendToKitchen(id: number): Observable<RestaurantOrder> {
    return this.http.post<RestaurantOrder>(`${this.baseUrl}/${id}/send-to-kitchen`, {});
  }

  updateStatus(id: number, status: OrderStatus): Observable<RestaurantOrder> {
    return this.http.patch<RestaurantOrder>(`${this.baseUrl}/${id}/status`, { status });
  }

  updateItemStatus(orderId: number, itemId: number, status: OrderItemStatus): Observable<RestaurantOrder> {
    return this.http.patch<RestaurantOrder>(`${this.baseUrl}/${orderId}/items/${itemId}/status`, { status });
  }

  cancel(id: number, reason: string): Observable<RestaurantOrder> {
    return this.http.post<RestaurantOrder>(`${this.baseUrl}/${id}/cancel`, { reason });
  }

  cancelItem(orderId: number, itemId: number, reason: string): Observable<RestaurantOrder> {
    return this.http.post<RestaurantOrder>(`${this.baseUrl}/${orderId}/items/${itemId}/cancel`, { reason });
  }
}
