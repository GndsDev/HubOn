import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MonthlyReport, ReportChannel } from '../../shared/models/monthly-report.model';

@Injectable({ providedIn: 'root' })
export class MonthlyReportApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reports/monthly`;

  getMonthly(year: number, month: number, channel: ReportChannel): Observable<MonthlyReport> {
    const params = new HttpParams()
      .set('year', year)
      .set('month', month)
      .set('channel', channel);
    return this.http.get<MonthlyReport>(this.baseUrl, { params });
  }
}
