import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  RestaurantTable,
  RestaurantTableRequest,
  RestaurantTableStatus,
} from '../../shared/models/table.model';

@Injectable({ providedIn: 'root' })
export class TableApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/tables`;

  getAll(): Observable<RestaurantTable[]> {
    return this.http.get<RestaurantTable[]>(this.baseUrl);
  }

  getById(id: number): Observable<RestaurantTable> {
    return this.http.get<RestaurantTable>(`${this.baseUrl}/${id}`);
  }

  create(request: RestaurantTableRequest): Observable<RestaurantTable> {
    return this.http.post<RestaurantTable>(this.baseUrl, request);
  }

  update(id: number, request: RestaurantTableRequest): Observable<RestaurantTable> {
    return this.http.put<RestaurantTable>(`${this.baseUrl}/${id}`, request);
  }

  updateStatus(id: number, status: RestaurantTableStatus): Observable<RestaurantTable> {
    return this.http.patch<RestaurantTable>(`${this.baseUrl}/${id}/status`, { status });
  }
}
