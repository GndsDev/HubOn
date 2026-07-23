import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Ingredient, IngredientRequest } from '../../shared/models/ingredient.model';

@Injectable({ providedIn: 'root' })
export class IngredientApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/ingredients`;

  getAll(): Observable<Ingredient[]> {
    return this.http.get<Ingredient[]>(this.baseUrl);
  }

  getActive(): Observable<Ingredient[]> {
    return this.http.get<Ingredient[]>(`${this.baseUrl}/active`);
  }

  getAlerts(): Observable<Ingredient[]> {
    return this.http.get<Ingredient[]>(`${this.baseUrl}/alerts`);
  }

  getById(id: number): Observable<Ingredient> {
    return this.http.get<Ingredient>(`${this.baseUrl}/${id}`);
  }

  create(request: IngredientRequest): Observable<Ingredient> {
    return this.http.post<Ingredient>(this.baseUrl, request);
  }

  update(id: number, request: IngredientRequest): Observable<Ingredient> {
    return this.http.put<Ingredient>(`${this.baseUrl}/${id}`, request);
  }

  activate(id: number): Observable<Ingredient> {
    return this.http.patch<Ingredient>(`${this.baseUrl}/${id}/activate`, {});
  }

  deactivate(id: number): Observable<Ingredient> {
    return this.http.patch<Ingredient>(`${this.baseUrl}/${id}/deactivate`, {});
  }
}
