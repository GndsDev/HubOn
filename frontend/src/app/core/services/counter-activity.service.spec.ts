import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CounterSaleSummary } from '../../shared/models/tab.model';
import { AuthService } from './auth.service';
import { CounterActivityService } from './counter-activity.service';
import { TabApiService } from './tab-api.service';

describe('CounterActivityService', () => {
  const sale: CounterSaleSummary = {
    id: 104,
    number: 104,
    displayLabel: 'Balcão #104',
    customerName: null,
    openedAt: '2026-07-30T10:00:00',
    closedAt: null,
    openedByUserName: 'Operadora',
    tabStatus: 'OPEN',
    totalAmount: 30,
    paidAmount: 30,
    remainingAmount: 0,
    itemCount: 2,
    draftItemCount: 0,
    waitingItemCount: 0,
    inPreparationItemCount: 0,
    readyItemCount: 2,
    deliveredItemCount: 0,
    attendanceState: 'IN_PROGRESS',
    preparationState: 'READY',
    financialState: 'PAID',
    nextAction: 'DELIVER',
    cancellationAllowed: false,
  };

  const authenticated = signal(true);
  const roles = signal(['OWNER']);
  const api = { getActiveCounterSales: vi.fn(() => of([sale])) };
  const auth = {
    isAuthenticated: computed(() => authenticated()),
    hasAnyRole: (allowed: string[]) => allowed.some((role) => roles().includes(role)),
  };

  beforeEach(() => {
    authenticated.set(true);
    roles.set(['OWNER']);
    api.getActiveCounterSales.mockReset();
    api.getActiveCounterSales.mockReturnValue(of([sale]));
    TestBed.configureTestingModule({
      providers: [
        CounterActivityService,
        { provide: AuthService, useValue: auth },
        { provide: TabApiService, useValue: api },
      ],
    });
  });

  it('loads active sales and exposes a ready indicator from backend data', () => {
    const service = TestBed.inject(CounterActivityService);

    service.refresh();

    expect(api.getActiveCounterSales).toHaveBeenCalledTimes(1);
    expect(service.activeCount()).toBe(1);
    expect(service.readyCount()).toBe(1);
    expect(service.unavailable()).toBe(false);
  });

  it('clears activity and skips requests when the current role cannot access Balcão', () => {
    roles.set(['WAITER']);
    const service = TestBed.inject(CounterActivityService);
    service.activeSales.set([sale]);

    service.refresh();

    expect(api.getActiveCounterSales).not.toHaveBeenCalled();
    expect(service.activeSales()).toEqual([]);
  });

  it('keeps navigation usable and marks the indicator unavailable when polling fails', () => {
    api.getActiveCounterSales.mockReturnValue(throwError(() => new Error('indisponível')));
    const service = TestBed.inject(CounterActivityService);

    service.refresh();

    expect(service.activeSales()).toEqual([]);
    expect(service.unavailable()).toBe(true);
    expect(service.loading()).toBe(false);
  });
});
