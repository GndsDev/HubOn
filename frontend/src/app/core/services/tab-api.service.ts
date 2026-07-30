import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CounterHistoryFilters,
  CounterSaleDetail,
  CounterSaleSummary,
  OpenCounterTabRequest,
  OpenTabRequest,
  Tab,
  UpdateCounterTabRequest,
} from '../../shared/models/tab.model';

@Injectable({ providedIn: 'root' })
export class TabApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/tabs`;

  getOpen(): Observable<Tab[]> {
    return this.http.get<Tab[]>(`${this.baseUrl}/open`);
  }

  getById(id: number): Observable<Tab> {
    return this.http.get<Tab>(`${this.baseUrl}/${id}`);
  }

  getCurrentByTable(tableId: number): Observable<Tab> {
    return this.http.get<Tab>(`${environment.apiUrl}/tables/${tableId}/current-tab`);
  }

  open(request: OpenTabRequest): Observable<Tab> {
    return this.http.post<Tab>(`${this.baseUrl}/open`, request);
  }

  openCounter(request: OpenCounterTabRequest): Observable<Tab> {
    return this.http.post<Tab>(`${this.baseUrl}/counter`, request);
  }

  getActiveCounterSales(): Observable<CounterSaleSummary[]> {
    return this.http.get<CounterSaleSummary[]>(`${this.baseUrl}/counter/active`);
  }

  getCounterSalesFinishedToday(): Observable<CounterSaleSummary[]> {
    return this.http.get<CounterSaleSummary[]>(`${this.baseUrl}/counter/finished-today`);
  }

  getCounterHistory(filters: CounterHistoryFilters = {}): Observable<CounterSaleSummary[]> {
    let params = new HttpParams();
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.number != null) params = params.set('number', filters.number);
    if (filters.customer?.trim()) params = params.set('customer', filters.customer.trim());
    if (filters.status) params = params.set('status', filters.status);
    if (filters.operator?.trim()) params = params.set('operator', filters.operator.trim());
    return this.http.get<CounterSaleSummary[]>(`${this.baseUrl}/counter/history`, { params });
  }

  getCounterSale(id: number): Observable<CounterSaleDetail> {
    return this.http.get<CounterSaleDetail>(`${this.baseUrl}/counter/${id}`);
  }

  updateCounterSale(id: number, request: UpdateCounterTabRequest): Observable<CounterSaleDetail> {
    return this.http.patch<CounterSaleDetail>(`${this.baseUrl}/counter/${id}`, request);
  }

  finishCounterSale(id: number): Observable<CounterSaleDetail> {
    return this.http.post<CounterSaleDetail>(`${this.baseUrl}/counter/${id}/finish`, {});
  }

  close(id: number): Observable<Tab> {
    return this.http.post<Tab>(`${this.baseUrl}/${id}/close`, {});
  }

  cancel(id: number): Observable<Tab> {
    return this.http.post<Tab>(`${this.baseUrl}/${id}/cancel`, {});
  }
}
