import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AnnualReport, DailyReport, MonthlyReport, ReportChannel } from '../../shared/models/monthly-report.model';

@Injectable({ providedIn: 'root' })
export class MonthlyReportApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reports`;

  getDaily(date: string, channel: ReportChannel): Observable<DailyReport> {
    return this.http.get<DailyReport>(`${this.baseUrl}/daily`, {
      params: this.dailyParams(date, channel),
    });
  }

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

  getDailyPdf(date: string, channel: ReportChannel): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/daily/pdf`, {
      params: this.dailyParams(date, channel),
      responseType: 'blob',
    });
  }

  getAnnualPdf(year: number, channel: ReportChannel): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/annual/pdf`, {
      params: this.params(year, channel),
      responseType: 'blob',
    });
  }

  getDailyXlsx(date: string, channel: ReportChannel): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/daily/xlsx`, {
      params: this.dailyParams(date, channel),
      responseType: 'blob',
    });
  }

  getMonthlyXlsx(year: number, month: number, channel: ReportChannel): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/monthly/xlsx`, {
      params: this.params(year, channel).set('month', month),
      responseType: 'blob',
    });
  }

  getAnnualXlsx(year: number, channel: ReportChannel): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/annual/xlsx`, {
      params: this.params(year, channel),
      responseType: 'blob',
    });
  }

  private params(year: number, channel: ReportChannel): HttpParams {
    return new HttpParams().set('year', year).set('channel', channel);
  }

  private dailyParams(date: string, channel: ReportChannel): HttpParams {
    return new HttpParams().set('date', date).set('channel', channel);
  }
}
