import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Expense,
  ExpenseFilters,
  ExpenseListResponse,
  ExpenseRequest,
} from '../../shared/models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpenseApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/expenses`;

  list(filters: ExpenseFilters = {}): Observable<ExpenseListResponse> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value != null && value !== '') params = params.set(key, value);
    });
    return this.http.get<ExpenseListResponse>(this.baseUrl, { params });
  }

  get(id: number): Observable<Expense> {
    return this.http.get<Expense>(`${this.baseUrl}/${id}`);
  }

  create(request: ExpenseRequest): Observable<Expense> {
    return this.http.post<Expense>(this.baseUrl, request);
  }

  update(id: number, request: ExpenseRequest): Observable<Expense> {
    return this.http.put<Expense>(`${this.baseUrl}/${id}`, request);
  }
}
