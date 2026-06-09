import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Payment, PaymentRequest, PaymentSummary } from '../../shared/models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payments`;

  create(request: PaymentRequest): Observable<Payment> {
    return this.http.post<Payment>(this.baseUrl, request);
  }

  getByTab(tabId: number): Observable<PaymentSummary> {
    return this.http.get<PaymentSummary>(`${this.baseUrl}/tab/${tabId}`);
  }
}
