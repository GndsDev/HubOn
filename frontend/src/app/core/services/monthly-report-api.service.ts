import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AnnualReport, MonthlyReport, ReportChannel } from '../../shared/models/monthly-report.model';

@Injectable({ providedIn: 'root' })
export class MonthlyReportApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reports`;

  getMonthly(year: number, month: number, channel: ReportChannel): Observable<MonthlyReport> {
    return this.http.get<MonthlyReport>(`${this.baseUrl}/monthly`, {
      params: this.params(year, channel).set('month', month),
    });
  }

  getAnnual(year: number, channel: ReportChannel): Observable<AnnualReport> {
    return this.http.get<AnnualReport>(`${this.baseUrl}/annual`, { params: this.params(year, channel) });
  }

  getMonthlyPdf(year: number, month: number, channel: ReportChannel): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/monthly/pdf`, {
      params: this.params(year, channel).set('month', month),
      responseType: 'blob',
    });
  }

  getAnnualPdf(year: number, channel: ReportChannel): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/annual/pdf`, {
      params: this.params(year, channel),
      responseType: 'blob',
    });
  }

  private params(year: number, channel: ReportChannel): HttpParams {
    return new HttpParams().set('year', year).set('channel', channel);
  }
}
