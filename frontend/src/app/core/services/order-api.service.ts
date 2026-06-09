import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
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

  getById(id: number): Observable<RestaurantOrder> {
    return this.http.get<RestaurantOrder>(`${this.baseUrl}/${id}`);
  }

  create(request: RestaurantOrderRequest): Observable<RestaurantOrder> {
    return this.http.post<RestaurantOrder>(this.baseUrl, request);
  }

  sendToKitchen(id: number): Observable<RestaurantOrder> {
    return this.http.post<RestaurantOrder>(`${this.baseUrl}/${id}/send-to-kitchen`, {});
  }

  updateStatus(id: number, status: OrderStatus): Observable<RestaurantOrder> {
    return this.http.patch<RestaurantOrder>(`${this.baseUrl}/${id}/status`, { status });
  }

  cancel(id: number): Observable<RestaurantOrder> {
    return this.http.post<RestaurantOrder>(`${this.baseUrl}/${id}/cancel`, {});
  }
}
