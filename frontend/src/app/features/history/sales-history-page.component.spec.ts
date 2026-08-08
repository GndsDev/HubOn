import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesApiService } from '../../core/services/sales-api.service';
import { Sale, SaleItem } from '../../shared/models/sale.model';
import { SalesHistoryPageComponent } from './sales-history-page.component';

const item: SaleItem = {
  id: 1,
  productId: 2,
  productName: 'Jantinha',
  categoryName: 'Refeicoes',
  baseUnitPrice: 30,
  unitPrice: 32,
  quantity: 2,
  subtotal: 64,
  notes: null,
  options: [{ id: 3, productOptionId: 4, optionGroupName: 'Espeto', optionName: 'Carne', additionalPrice: 2 }],
  createdByUserId: 1,
  createdByUserName: 'Gerente',
  createdAt: '2026-08-07T12:00:00',
  cancelledAt: null,
  cancelledByUserId: null,
  cancelledByUserName: null,
  cancellationReason: null,
};

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 10,
    type: 'TABLE',
    status: 'CLOSED',
    restaurantTableId: 2,
    tableNumber: 2,
    tableLabel: null,
    customerName: null,
    customerPhone: null,
    subtotal: 64,
    serviceFee: 0,
    discountAmount: 0,
    finalAmount: 64,
    paidAmount: 64,
    remainingAmount: 0,
    items: [item],
    payments: [{ id: 5, saleId: 10, method: 'PIX', amount: 64, paidAt: '2026-08-07T13:00:00', receivedByUserId: 1, receivedByUserName: 'Gerente' }],
    openedByUserId: 1,
    openedByUserName: 'Gerente',
    openedAt: '2026-08-07T12:00:00',
    closedByUserId: 1,
    closedByUserName: 'Gerente',
    closedAt: '2026-08-07T13:00:00',
    closedBusinessDate: '2026-08-07',
    cancelledByUserId: null,
    cancelledByUserName: null,
    cancelledAt: null,
    cancellationReason: null,
    ...overrides,
  };
}

describe('SalesHistoryPageComponent', () => {
  const closedTable = sale();
  const cancelledCounter = sale({
    id: 11,
    type: 'COUNTER',
    status: 'CANCELLED',
    restaurantTableId: null,
    tableNumber: null,
    paidAmount: 0,
    payments: [],
    closedAt: null,
    closedBusinessDate: null,
    cancelledByUserId: 1,
    cancelledByUserName: 'Gerente',
    cancelledAt: '2026-08-06T18:00:00',
    cancellationReason: 'Cliente desistiu',
  });
  const openCounter = sale({ id: 12, type: 'COUNTER', status: 'OPEN', closedAt: null, closedBusinessDate: null });
  const api = { list: vi.fn(() => of([closedTable, cancelledCounter, openCounter])) };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of([closedTable, cancelledCounter, openCounter]));
    await TestBed.configureTestingModule({
      imports: [SalesHistoryPageComponent],
      providers: [{ provide: SalesApiService, useValue: api }],
    }).compileComponents();
  });

  function component(): SalesHistoryPageComponent {
    return TestBed.createComponent(SalesHistoryPageComponent).componentInstance;
  }

  it('loads Sale history and excludes open sales from the result', () => {
    const instance = component();
    instance.load();

    expect(api.list).toHaveBeenCalledWith();
    expect(instance.visibleSales().map((entry) => entry.id)).toEqual([10, 11]);
  });

  it('filters by period, TABLE or COUNTER, and CLOSED or CANCELLED', () => {
    const instance = component();
    instance.sales.set([closedTable, cancelledCounter, openCounter]);
    instance.from = '2026-08-07';
    instance.to = '2026-08-07';
    instance.type = 'TABLE';
    instance.status = 'CLOSED';

    expect(instance.visibleSales()).toEqual([closedTable]);

    instance.from = '';
    instance.to = '';
    instance.type = 'COUNTER';
    instance.status = 'CANCELLED';
    expect(instance.visibleSales()).toEqual([cancelledCounter]);
  });

  it('presents immutable item and payment snapshots from the Sale response', () => {
    const instance = component();

    expect(instance.origin(closedTable)).toBe('Mesa 2');
    expect(instance.activeItemCount(closedTable)).toBe(2);
    expect(instance.optionSummary(item.options)).toBe('Carne');
    expect(instance.paymentSummary(closedTable)).toBe('PIX');
    expect(instance.statusLabel('CANCELLED')).toBe('Cancelada');
  });

  it('surfaces API errors without manufacturing legacy order statuses', () => {
    api.list.mockReturnValueOnce(throwError(() => ({ error: { message: 'Falha controlada' } })));
    const instance = component();

    instance.load();

    expect(instance.error()).toBeTruthy();
    expect(instance.loading()).toBe(false);
  });
});
