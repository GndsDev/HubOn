import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CashMovementRequest, CashShift, CloseCashShiftRequest, OpenCashShiftRequest } from '../../shared/models/cash.model';

@Injectable({ providedIn: 'root' })
export class CashApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/cash-shifts`;

  getCurrent(): Observable<CashShift | null> {
    return this.http.get<CashShift | null>(`${this.baseUrl}/current`);
  }

  getHistory(): Observable<CashShift[]> {
    return this.http.get<CashShift[]>(`${this.baseUrl}/history`);
  }

  open(request: OpenCashShiftRequest): Observable<CashShift> {
    return this.http.post<CashShift>(this.baseUrl, request);
  }

  addMovement(shiftId: number, request: CashMovementRequest): Observable<CashShift> {
    return this.http.post<CashShift>(`${this.baseUrl}/${shiftId}/movements`, request);
  }

  close(shiftId: number, request: CloseCashShiftRequest): Observable<CashShift> {
    return this.http.post<CashShift>(`${this.baseUrl}/${shiftId}/close`, request);
  }
}
