import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Product,
  ProductOption,
  ProductOptionGroup,
  ProductOptionGroupRequest,
  ProductOptionRequest,
  ProductRegistrationRequest,
  ProductRequest,
  ProductVariant,
  ProductVariantRequest,
} from '../../shared/models/product.model';

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

  register(request: ProductRegistrationRequest): Observable<Product> {
    return this.http.post<Product>(`${this.baseUrl}/registration`, request);
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

  setAvailable(id: number, available: boolean): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/${id}/${available ? 'available' : 'unavailable'}`, {});
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

  setVariantAvailable(productId: number, variantId: number, available: boolean): Observable<ProductVariant> {
    return this.http.patch<ProductVariant>(
      `${this.baseUrl}/${productId}/variants/${variantId}/${available ? 'available' : 'unavailable'}`,
      {},
    );
  }

  getOptionGroups(productId: number): Observable<ProductOptionGroup[]> {
    return this.http.get<ProductOptionGroup[]>(`${this.baseUrl}/${productId}/option-groups`);
  }

  createOptionGroup(productId: number, request: ProductOptionGroupRequest): Observable<ProductOptionGroup> {
    return this.http.post<ProductOptionGroup>(`${this.baseUrl}/${productId}/option-groups`, request);
  }

  updateOptionGroup(productId: number, groupId: number, request: ProductOptionGroupRequest): Observable<ProductOptionGroup> {
    return this.http.put<ProductOptionGroup>(`${this.baseUrl}/${productId}/option-groups/${groupId}`, request);
  }

  setOptionGroupActive(productId: number, groupId: number, active: boolean): Observable<ProductOptionGroup> {
    return this.http.patch<ProductOptionGroup>(
      `${this.baseUrl}/${productId}/option-groups/${groupId}/${active ? 'activate' : 'deactivate'}`,
      {},
    );
  }

  createOption(productId: number, groupId: number, request: ProductOptionRequest): Observable<ProductOption> {
    return this.http.post<ProductOption>(`${this.baseUrl}/${productId}/option-groups/${groupId}/options`, request);
  }

  updateOption(productId: number, groupId: number, optionId: number, request: ProductOptionRequest): Observable<ProductOption> {
    return this.http.put<ProductOption>(
      `${this.baseUrl}/${productId}/option-groups/${groupId}/options/${optionId}`,
      request,
    );
  }

  setOptionActive(productId: number, groupId: number, optionId: number, active: boolean): Observable<ProductOption> {
    return this.http.patch<ProductOption>(
      `${this.baseUrl}/${productId}/option-groups/${groupId}/options/${optionId}/${active ? 'activate' : 'deactivate'}`,
      {},
    );
  }
}
