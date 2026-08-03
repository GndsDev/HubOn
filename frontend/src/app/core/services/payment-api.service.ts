import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaymentOperation, PaymentRequest, PaymentSummary } from '../../shared/models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payments`;

  create(request: PaymentRequest): Observable<PaymentOperation> {
    return this.http.post<PaymentOperation>(this.baseUrl, request);
  }

  getByTab(tabId: number): Observable<PaymentSummary> {
    return this.http.get<PaymentSummary>(`${this.baseUrl}/tab/${tabId}`);
  }
}
