import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AddSaleItemRequest,
  CancellationRequest,
  OpenSaleRequest,
  PaymentRequest,
  Sale,
  SaleStatus,
  SaleType,
  UpdateSaleItemQuantityRequest,
} from '../../shared/models/sale.model';

@Injectable({ providedIn: 'root' })
export class SalesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/sales`;

  list(status?: SaleStatus, type?: SaleType): Observable<Sale[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (type) params = params.set('type', type);
    return this.http.get<Sale[]>(this.baseUrl, { params });
  }

  get(id: number): Observable<Sale> {
    return this.http.get<Sale>(`${this.baseUrl}/${id}`);
  }

  open(request: OpenSaleRequest): Observable<Sale> {
    return this.http.post<Sale>(this.baseUrl, request);
  }

  addItem(saleId: number, request: AddSaleItemRequest): Observable<Sale> {
    return this.http.post<Sale>(`${this.baseUrl}/${saleId}/items`, request);
  }

  updateItemQuantity(
    saleId: number,
    itemId: number,
    request: UpdateSaleItemQuantityRequest,
  ): Observable<Sale> {
    return this.http.patch<Sale>(`${this.baseUrl}/${saleId}/items/${itemId}/quantity`, request);
  }

  cancelItem(saleId: number, itemId: number, request: CancellationRequest): Observable<Sale> {
    return this.http.post<Sale>(`${this.baseUrl}/${saleId}/items/${itemId}/cancel`, request);
  }

  pay(saleId: number, request: PaymentRequest): Observable<Sale> {
    return this.http.post<Sale>(`${this.baseUrl}/${saleId}/payments`, request);
  }

  close(saleId: number): Observable<Sale> {
    return this.http.post<Sale>(`${this.baseUrl}/${saleId}/close`, {});
  }

  cancel(saleId: number, request: CancellationRequest): Observable<Sale> {
    return this.http.post<Sale>(`${this.baseUrl}/${saleId}/cancel`, request);
  }
}
