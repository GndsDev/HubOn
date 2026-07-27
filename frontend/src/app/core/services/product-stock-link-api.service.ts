import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProductStockLink, ProductStockLinkRequest } from '../../shared/models/product-stock-link.model';

@Injectable({ providedIn: 'root' })
export class ProductStockLinkApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/product-variants`;

  getByVariant(variantId: number): Observable<ProductStockLink> {
    return this.http.get<ProductStockLink>(`${this.baseUrl}/${variantId}/stock-link`);
  }

  create(variantId: number, request: ProductStockLinkRequest): Observable<ProductStockLink> {
    return this.http.post<ProductStockLink>(`${this.baseUrl}/${variantId}/stock-link`, request);
  }

  update(variantId: number, request: ProductStockLinkRequest): Observable<ProductStockLink> {
    return this.http.put<ProductStockLink>(`${this.baseUrl}/${variantId}/stock-link`, request);
  }

  deactivate(variantId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${variantId}/stock-link`);
  }
}
