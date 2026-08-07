import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ProductStockLink,
  ProductStockLinkRequest,
  StockAdjustmentRequest,
  StockItem,
  StockItemRequest,
  StockLossRequest,
  StockMovement,
  StockQuantityRequest,
} from '../../shared/models/stock.model';

@Injectable({ providedIn: 'root' })
export class StockApiService {
  private readonly http = inject(HttpClient);
  private readonly itemsUrl = `${environment.apiUrl}/stock-items`;
  private readonly movementsUrl = `${environment.apiUrl}/stock-movements`;

  listItems(): Observable<StockItem[]> {
    return this.http.get<StockItem[]>(this.itemsUrl);
  }

  listActiveItems(): Observable<StockItem[]> {
    return this.http.get<StockItem[]>(`${this.itemsUrl}/active`);
  }

  listAlerts(): Observable<StockItem[]> {
    return this.http.get<StockItem[]>(`${this.itemsUrl}/alerts`);
  }

  getItem(id: number): Observable<StockItem> {
    return this.http.get<StockItem>(`${this.itemsUrl}/${id}`);
  }

  createItem(request: StockItemRequest): Observable<StockItem> {
    return this.http.post<StockItem>(this.itemsUrl, request);
  }

  updateItem(id: number, request: StockItemRequest): Observable<StockItem> {
    return this.http.put<StockItem>(`${this.itemsUrl}/${id}`, request);
  }

  setItemActive(id: number, active: boolean): Observable<StockItem> {
    return this.http.patch<StockItem>(`${this.itemsUrl}/${id}/${active ? 'activate' : 'deactivate'}`, {});
  }

  listMovements(): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(this.movementsUrl);
  }

  listMovementsByItem(stockItemId: number): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${this.movementsUrl}/stock-item/${stockItemId}`);
  }

  entry(request: StockQuantityRequest): Observable<StockMovement> {
    return this.http.post<StockMovement>(`${this.movementsUrl}/entries`, request);
  }

  exit(request: StockQuantityRequest): Observable<StockMovement> {
    return this.http.post<StockMovement>(`${this.movementsUrl}/exits`, request);
  }

  loss(request: StockLossRequest): Observable<StockMovement> {
    return this.http.post<StockMovement>(`${this.movementsUrl}/losses`, request);
  }

  adjust(request: StockAdjustmentRequest): Observable<StockMovement> {
    return this.http.post<StockMovement>(`${this.movementsUrl}/adjustments`, request);
  }

  getProductLink(productId: number): Observable<ProductStockLink> {
    return this.http.get<ProductStockLink>(`${environment.apiUrl}/products/${productId}/stock-link`);
  }

  createProductLink(productId: number, request: ProductStockLinkRequest): Observable<ProductStockLink> {
    return this.http.post<ProductStockLink>(`${environment.apiUrl}/products/${productId}/stock-link`, request);
  }

  updateProductLink(productId: number, request: ProductStockLinkRequest): Observable<ProductStockLink> {
    return this.http.put<ProductStockLink>(`${environment.apiUrl}/products/${productId}/stock-link`, request);
  }

  deactivateProductLink(productId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/products/${productId}/stock-link`);
  }
}
