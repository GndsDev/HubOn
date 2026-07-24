import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product, ProductRequest, ProductVariant, ProductVariantRequest } from '../../shared/models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/products`;

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.baseUrl);
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  create(request: ProductRequest): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, request);
  }

  update(id: number, request: ProductRequest): Observable<Product> {
    return this.http.put<Product>(`${this.baseUrl}/${id}`, request);
  }

  activate(id: number): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/${id}/activate`, {});
  }

  deactivate(id: number): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/${id}/deactivate`, {});
  }

  getVariants(productId: number): Observable<ProductVariant[]> {
    return this.http.get<ProductVariant[]>(`${this.baseUrl}/${productId}/variants`);
  }

  createVariant(productId: number, request: ProductVariantRequest): Observable<ProductVariant> {
    return this.http.post<ProductVariant>(`${this.baseUrl}/${productId}/variants`, request);
  }

  updateVariant(productId: number, variantId: number, request: ProductVariantRequest): Observable<ProductVariant> {
    return this.http.put<ProductVariant>(`${this.baseUrl}/${productId}/variants/${variantId}`, request);
  }

  activateVariant(productId: number, variantId: number): Observable<ProductVariant> {
    return this.http.patch<ProductVariant>(`${this.baseUrl}/${productId}/variants/${variantId}/activate`, {});
  }

  deactivateVariant(productId: number, variantId: number): Observable<ProductVariant> {
    return this.http.patch<ProductVariant>(`${this.baseUrl}/${productId}/variants/${variantId}/deactivate`, {});
  }
}
