import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, filter, merge, of, Subject, switchMap, timer } from 'rxjs';
import { Sale } from '../../shared/models/sale.model';
import { AuthService } from './auth.service';
import { SalesApiService } from './sales-api.service';

@Injectable({ providedIn: 'root' })
export class CounterActivityService {
  private readonly api = inject(SalesApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequest = new Subject<void>();
  readonly activeSales = signal<Sale[]>([]);
  readonly loading = signal(false);
  readonly unavailable = signal(false);
  readonly activeCount = computed(() => this.activeSales().length);
  constructor() { merge(timer(0, 30_000), this.refreshRequest).pipe(filter(() => this.canAccess()), switchMap(() => { this.loading.set(true); this.unavailable.set(false); return this.api.list('OPEN', 'COUNTER').pipe(catchError(() => { this.unavailable.set(true); return of([] as Sale[]); })); }), takeUntilDestroyed(this.destroyRef)).subscribe((sales) => { this.activeSales.set(sales); this.loading.set(false); }); }
  refresh(): void { if (!this.canAccess()) { this.activeSales.set([]); return; } this.refreshRequest.next(); }
  private canAccess(): boolean { return this.auth.isAuthenticated() && this.auth.hasAnyRole(['OWNER', 'ADMIN', 'CASHIER']); }
}
