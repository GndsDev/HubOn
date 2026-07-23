import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  InventoryMovement,
  StockAdjustmentRequest,
  StockEntryRequest,
  StockExitRequest,
  StockLossRequest,
} from '../../shared/models/inventory-movement.model';

@Injectable({ providedIn: 'root' })
export class InventoryMovementApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/inventory-movements`;

  getRecent(): Observable<InventoryMovement[]> {
    return this.http.get<InventoryMovement[]>(this.baseUrl);
  }

  getByIngredient(ingredientId: number): Observable<InventoryMovement[]> {
    return this.http.get<InventoryMovement[]>(`${this.baseUrl}/ingredient/${ingredientId}`);
  }

  registerEntry(request: StockEntryRequest): Observable<InventoryMovement> {
    return this.http.post<InventoryMovement>(`${this.baseUrl}/entries`, request);
  }

  registerExit(request: StockExitRequest): Observable<InventoryMovement> {
    return this.http.post<InventoryMovement>(`${this.baseUrl}/exits`, request);
  }

  registerLoss(request: StockLossRequest): Observable<InventoryMovement> {
    return this.http.post<InventoryMovement>(`${this.baseUrl}/losses`, request);
  }

  registerAdjustment(request: StockAdjustmentRequest): Observable<InventoryMovement> {
    return this.http.post<InventoryMovement>(`${this.baseUrl}/adjustments`, request);
  }
}
