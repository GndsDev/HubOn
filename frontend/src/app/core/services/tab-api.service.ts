import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OpenTabRequest, Tab } from '../../shared/models/tab.model';

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

  close(id: number): Observable<Tab> {
    return this.http.post<Tab>(`${this.baseUrl}/${id}/close`, {});
  }

  cancel(id: number): Observable<Tab> {
    return this.http.post<Tab>(`${this.baseUrl}/${id}/cancel`, {});
  }
}
