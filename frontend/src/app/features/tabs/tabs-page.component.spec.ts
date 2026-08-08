import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { SalesApiService } from '../../core/services/sales-api.service';
import { TableApiService } from '../../core/services/table-api.service';
import { Sale, SaleItem } from '../../shared/models/sale.model';
import { RestaurantTable } from '../../shared/models/table.model';
import { TabsPageComponent } from './tabs-page.component';

const line: SaleItem = {
  id: 9, productId: 3, productName: 'Coca-Cola', categoryName: 'Bebidas', baseUnitPrice: 6, unitPrice: 6,
  quantity: 2, subtotal: 12, notes: null, options: [], createdByUserId: 1, createdByUserName: 'Gerente',
  createdAt: '', cancelledAt: null, cancelledByUserId: null, cancelledByUserName: null, cancellationReason: null,
};

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 20, type: 'TABLE', status: 'OPEN', restaurantTableId: 4, tableNumber: 4, tableLabel: null,
    customerName: null, customerPhone: null, subtotal: 12, serviceFee: 0, discountAmount: 0,
    finalAmount: 12, paidAmount: 0, remainingAmount: 12, items: [line], payments: [], openedByUserId: 1,
    openedByUserName: 'Gerente', openedAt: '', closedByUserId: null, closedByUserName: null, closedAt: null,
    closedBusinessDate: null, cancelledByUserId: null, cancelledByUserName: null, cancelledAt: null,
    cancellationReason: null, ...overrides,
  };
}

const freeTable: RestaurantTable = { id: 4, number: 4, label: null, state: 'FREE', active: true, createdAt: '', updatedAt: '' };

describe('TabsPageComponent', () => {
  const api = {
    list: vi.fn(() => of([] as Sale[])), get: vi.fn(() => of(sale())), open: vi.fn(() => of(sale())),
    addItem: vi.fn(() => of(sale())), cancelItem: vi.fn(() => of(sale())), close: vi.fn(() => of(sale({ status: 'CLOSED' }))),
    cancel: vi.fn(() => of(sale({ status: 'CANCELLED' }))),
  };
  const productApi = { getAll: vi.fn(() => of([])) };
  const tableApi = {
    getAll: vi.fn(() => of([] as RestaurantTable[])),
    create: vi.fn(() => of(freeTable)),
    update: vi.fn(() => of(freeTable)),
  };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of([]));
    api.get.mockReturnValue(of(sale()));
    api.open.mockReturnValue(of(sale()));
    api.addItem.mockReturnValue(of(sale()));
    api.cancelItem.mockReturnValue(of(sale()));
    api.close.mockReturnValue(of(sale({ status: 'CLOSED' })));
    api.cancel.mockReturnValue(of(sale({ status: 'CANCELLED' })));
    productApi.getAll.mockReturnValue(of([]));
    tableApi.getAll.mockReturnValue(of([]));
    tableApi.create.mockReturnValue(of(freeTable));
    tableApi.update.mockReturnValue(of(freeTable));
    await TestBed.configureTestingModule({
      imports: [TabsPageComponent],
      providers: [
        provideRouter([]),
        { provide: SalesApiService, useValue: api },
        { provide: ProductApiService, useValue: productApi },
        { provide: TableApiService, useValue: tableApi },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
  });

  function component(): TabsPageComponent { return TestBed.createComponent(TabsPageComponent).componentInstance; }

  it('lists tables and maps free, occupied and disabled states', () => {
    const tables: RestaurantTable[] = [
      freeTable,
      { ...freeTable, id: 5, number: 5, state: 'OCCUPIED' },
      { ...freeTable, id: 6, number: 6, state: 'DISABLED', active: false },
    ];
    tableApi.getAll.mockReturnValueOnce(of(tables));
    api.list.mockReturnValueOnce(of([sale()]));
    const instance = component();

    instance.load();

    expect(tableApi.getAll).toHaveBeenCalledOnce();
    expect(api.list).toHaveBeenCalledWith('OPEN', 'TABLE');
    expect(instance.tables()).toEqual(tables);
    expect(tables.map((table) => instance.tableStateLabel(table))).toEqual(['Livre', 'Ocupada', 'Desativada']);
  });

  it('renders a stable visual state for each table status', () => {
    const fixture = TestBed.createComponent(TabsPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.loading.set(false);
    fixture.componentInstance.tables.set([
      freeTable,
      { ...freeTable, id: 5, number: 5, state: 'OCCUPIED' },
      { ...freeTable, id: 6, number: 6, state: 'DISABLED', active: false },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.table-tile.free')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.table-tile.occupied')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.table-tile.disabled')).toHaveLength(1);
  });

  it('opens a free table immediately with a TABLE sale', () => {
    const instance = component();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    instance.selectTable(freeTable);
    expect(api.open).toHaveBeenCalledWith({ type: 'TABLE', restaurantTableId: 4, customerName: null, customerPhone: null, serviceFee: 0, discountAmount: 0 });
    expect(router.navigate).toHaveBeenCalledWith(['/comandas', 20]);
  });

  it('resumes the existing sale without opening a second sale for the table', () => {
    const instance = component();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    instance.openSales.set([sale()]);
    instance.selectTable({ ...freeTable, state: 'OCCUPIED' });
    expect(api.open).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/comandas', 20]);
  });

  it('adds a simple product and updates only the current sale', () => {
    const instance = component();
    const updated = sale({ finalAmount: 18, remainingAmount: 18 });
    api.addItem.mockReturnValueOnce(of(updated));
    instance.currentSale.set(sale({ items: [] }));
    instance.addProduct({ productId: 3, quantity: 1, notes: null, optionIds: [] });
    expect(api.addItem).toHaveBeenCalledWith(20, { productId: 3, quantity: 1, notes: null, optionIds: [] });
    expect(instance.currentSale()).toBe(updated);
  });

  it('changes quantity through cancellation plus a replacement item', () => {
    const instance = component();
    const cancelled = sale({ items: [{ ...line, cancelledAt: '2026-08-07T12:10:00' }] });
    const updated = sale({ items: [{ ...line, id: 10, quantity: 3, subtotal: 18 }], subtotal: 18, finalAmount: 18, remainingAmount: 18 });
    api.cancelItem.mockReturnValueOnce(of(cancelled));
    api.addItem.mockReturnValueOnce(of(updated));
    instance.currentSale.set(sale());
    instance.changeQuantity(line, 3);
    expect(api.cancelItem).toHaveBeenCalledWith(20, 9, { reason: 'Ajuste de quantidade' });
    expect(api.addItem).toHaveBeenCalledWith(20, { productId: 3, quantity: 3, notes: null, optionIds: [] });
    expect(instance.currentSale()).toBe(updated);
  });

  it('reduces quantity to zero without adding a replacement item', () => {
    const cancelled = sale({ items: [{ ...line, cancelledAt: '2026-08-07T12:10:00' }] });
    api.cancelItem.mockReturnValueOnce(of(cancelled));
    const instance = component();
    instance.currentSale.set(sale());

    instance.changeQuantity(line, 0);

    expect(api.cancelItem).toHaveBeenCalledWith(20, 9, { reason: 'Ajuste de quantidade' });
    expect(api.addItem).not.toHaveBeenCalled();
    expect(instance.currentSale()).toBe(cancelled);
  });

  it('cancels with a reason and blocks item changes after payment', () => {
    const instance = component();
    instance.currentSale.set(sale());
    instance.cancellationReason = 'Lançamento duplicado';
    instance.cancelItem(line);
    expect(api.cancelItem).toHaveBeenCalledWith(20, 9, { reason: 'Lançamento duplicado' });

    instance.paymentCompleted(sale({ paidAmount: 12, remainingAmount: 0, payments: [{ id: 2, saleId: 20, method: 'PIX', amount: 12, paidAt: '', receivedByUserId: 1, receivedByUserName: 'Gerente' }] }));
    expect(instance.canChangeItems()).toBe(false);
    expect(instance.canClose()).toBe(true);
  });

  it('closes a fully paid table sale explicitly', () => {
    const instance = component();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    instance.currentSale.set(sale({ paidAmount: 12, remainingAmount: 0 }));
    instance.closeSale();
    expect(api.close).toHaveBeenCalledWith(20);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/comandas');
  });

  it('updates snapshots and remaining amount after a partial payment', () => {
    const optionLine: SaleItem = {
      ...line,
      productName: 'Jantinha',
      categoryName: 'Refeicoes',
      baseUnitPrice: 30,
      unitPrice: 32,
      subtotal: 32,
      options: [{ id: 2, productOptionId: 11, optionGroupName: 'Espeto', optionName: 'Carne', additionalPrice: 2 }],
    };
    const partial = sale({
      subtotal: 32,
      finalAmount: 32,
      paidAmount: 10,
      remainingAmount: 22,
      items: [optionLine],
      payments: [{ id: 3, saleId: 20, method: 'PIX', amount: 10, paidAt: '', receivedByUserId: 1, receivedByUserName: 'Gerente' }],
    });
    const instance = component();
    instance.paymentOpen.set(true);

    instance.paymentCompleted(partial);

    expect(instance.currentSale()).toBe(partial);
    expect(instance.currentSale()?.remainingAmount).toBe(22);
    expect(instance.optionSummary(optionLine)).toBe('Carne');
    expect(instance.canChangeItems()).toBe(false);
    expect(instance.paymentOpen()).toBe(false);
  });

  it('does not close an empty table sale', () => {
    const instance = component();
    instance.currentSale.set(sale({ items: [], subtotal: 0, finalAmount: 0, remainingAmount: 0 }));

    instance.closeSale();

    expect(api.close).not.toHaveBeenCalled();
  });

  it('keeps the current table sale when an API operation fails', () => {
    const existing = sale();
    api.addItem.mockReturnValueOnce(throwError(() => ({ error: { message: 'Falha controlada' } })));
    const instance = component();
    instance.currentSale.set(existing);

    instance.addProduct({ productId: 7, quantity: 1, notes: null, optionIds: [] });

    expect(instance.currentSale()).toBe(existing);
    expect(feedback.error).toHaveBeenCalled();
    expect(instance.busyProductId()).toBeNull();
  });

  it('exposes table loading errors and allows a retry', () => {
    tableApi.getAll.mockReturnValueOnce(throwError(() => ({ error: { message: 'Mesas indisponiveis' } })));
    const instance = component();

    instance.load();

    expect(instance.error()).toBeTruthy();
    expect(instance.loading()).toBe(false);
  });
});
