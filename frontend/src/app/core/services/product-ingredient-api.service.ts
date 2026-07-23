import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ProductIngredient,
  ProductIngredientRequest,
  ProductRecipe,
} from '../../shared/models/product-ingredient.model';

@Injectable({ providedIn: 'root' })
export class ProductIngredientApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/products`;

  getRecipe(productId: number): Observable<ProductRecipe> {
    return this.http.get<ProductRecipe>(`${this.baseUrl}/${productId}/ingredients`);
  }

  addIngredient(productId: number, request: ProductIngredientRequest): Observable<ProductIngredient> {
    return this.http.post<ProductIngredient>(`${this.baseUrl}/${productId}/ingredients`, request);
  }

  updateIngredientQuantity(
    productId: number,
    ingredientId: number,
    request: ProductIngredientRequest,
  ): Observable<ProductIngredient> {
    return this.http.put<ProductIngredient>(
      `${this.baseUrl}/${productId}/ingredients/${ingredientId}`,
      request,
    );
  }

  removeIngredient(productId: number, ingredientId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${productId}/ingredients/${ingredientId}`);
  }

  replaceRecipe(productId: number, request: ProductIngredientRequest[]): Observable<ProductRecipe> {
    return this.http.put<ProductRecipe>(`${this.baseUrl}/${productId}/ingredients`, request);
  }
}
