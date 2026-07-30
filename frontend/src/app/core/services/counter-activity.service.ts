import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, filter, merge, of, Subject, switchMap, timer } from 'rxjs';
import { CounterSaleSummary } from '../../shared/models/tab.model';
import { AuthService } from './auth.service';
import { TabApiService } from './tab-api.service';

@Injectable({ providedIn: 'root' })
export class CounterActivityService {
  private readonly api = inject(TabApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequest = new Subject<void>();

  readonly activeSales = signal<CounterSaleSummary[]>([]);
  readonly loading = signal(false);
  readonly unavailable = signal(false);
  readonly activeCount = computed(() => this.activeSales().length);
  readonly readyCount = computed(() => this.activeSales().filter((sale) => this.isReadyForHandoff(sale)).length);

  constructor() {
    merge(timer(0, 30_000), this.refreshRequest)
      .pipe(
        filter(() => this.canAccess()),
        switchMap(() => {
          this.loading.set(true);
          this.unavailable.set(false);
          return this.api.getActiveCounterSales().pipe(
            catchError(() => {
              this.unavailable.set(true);
              return of([] as CounterSaleSummary[]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((sales) => {
        this.activeSales.set(sales);
        this.loading.set(false);
      });
  }

  refresh(): void {
    if (!this.canAccess()) {
      this.activeSales.set([]);
      return;
    }
    this.refreshRequest.next();
  }

  private canAccess(): boolean {
    return this.auth.isAuthenticated() && this.auth.hasAnyRole(['OWNER', 'ADMIN', 'CASHIER']);
  }

  private isReadyForHandoff(sale: CounterSaleSummary): boolean {
    return sale.draftItemCount === 0
      && sale.waitingItemCount === 0
      && sale.inPreparationItemCount === 0
      && sale.readyItemCount > 0
      && sale.readyItemCount + sale.deliveredItemCount === sale.itemCount
      && sale.deliveredItemCount < sale.itemCount;
  }
}
