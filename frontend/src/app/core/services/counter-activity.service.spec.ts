import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sale } from '../../shared/models/sale.model';
import { AuthService } from './auth.service';
import { CounterActivityService } from './counter-activity.service';
import { SalesApiService } from './sales-api.service';

const openSale: Sale = {
  id: 8, type: 'COUNTER', status: 'OPEN', restaurantTableId: null, tableNumber: null, tableLabel: null,
  customerName: null, customerPhone: null, subtotal: 6, serviceFee: 0, discountAmount: 0,
  finalAmount: 6, paidAmount: 0, remainingAmount: 6, items: [], payments: [], openedByUserId: 1,
  openedByUserName: 'Gerente', openedAt: '', closedByUserId: null, closedByUserName: null, closedAt: null,
  closedBusinessDate: null, cancelledByUserId: null, cancelledByUserName: null, cancelledAt: null,
  cancellationReason: null,
};

describe('CounterActivityService', () => {
  const authenticated = signal(true);
  const api = { list: vi.fn(() => of([openSale])) };

  beforeEach(() => {
    vi.useFakeTimers();
    authenticated.set(true);
    api.list.mockReturnValue(of([openSale]));
    TestBed.configureTestingModule({
      providers: [
        CounterActivityService,
        { provide: SalesApiService, useValue: api },
        { provide: AuthService, useValue: { isAuthenticated: authenticated, hasAnyRole: () => true } },
      ],
    });
  });

  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); vi.clearAllMocks(); });

  it('counts open counter sales from the sales endpoint', () => {
    const service = TestBed.inject(CounterActivityService);
    vi.advanceTimersByTime(1);
    expect(api.list).toHaveBeenCalledWith('OPEN', 'COUNTER');
    expect(service.activeCount()).toBe(1);
  });

  it('clears the indicator after authentication ends', () => {
    const service = TestBed.inject(CounterActivityService);
    vi.advanceTimersByTime(1);
    authenticated.set(false);
    service.refresh();
    expect(service.activeSales()).toEqual([]);
  });
});
