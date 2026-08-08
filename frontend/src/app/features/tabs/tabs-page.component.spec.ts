import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { SalesApiService } from '../../core/services/sales-api.service';
import { Sale, SaleItem } from '../../shared/models/sale.model';
import { TabsPageComponent } from './tabs-page.component';

const line: SaleItem = {
  id: 9, productId: 3, productName: 'Coca-Cola', categoryName: 'Bebidas', baseUnitPrice: 6, unitPrice: 6,
  quantity: 2, subtotal: 12, notes: null, options: [], createdByUserId: 1, createdByUserName: 'Gerente',
  createdAt: '', cancelledAt: null, cancelledByUserId: null, cancelledByUserName: null, cancellationReason: null,
};

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 20, type: 'TABLE', status: 'OPEN', tableNumber: 4,
    customerName: null, customerPhone: null, subtotal: 12, serviceFee: 0, discountAmount: 0,
    finalAmount: 12, paidAmount: 0, remainingAmount: 12, items: [line], payments: [], openedByUserId: 1,
    openedByUserName: 'Gerente', openedAt: '2026-08-07T12:00:00', closedByUserId: null, closedByUserName: null, closedAt: null,
    closedBusinessDate: null, cancelledByUserId: null, cancelledByUserName: null, cancelledAt: null,
    cancellationReason: null, ...overrides,
  };
}

describe('TabsPageComponent', () => {
  const api = {
    list: vi.fn(() => of([] as Sale[])), get: vi.fn(() => of(sale())), open: vi.fn(() => of(sale())),
    addItem: vi.fn(() => of(sale())), cancelItem: vi.fn(() => of(sale())), close: vi.fn(() => of(sale({ status: 'CLOSED' }))),
    cancel: vi.fn(() => of(sale({ status: 'CANCELLED' }))),
  };
  const productApi = { getAll: vi.fn(() => of([])) };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  let fixture: ComponentFixture<TabsPageComponent>;

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
    await TestBed.configureTestingModule({
      imports: [TabsPageComponent],
      providers: [
        provideRouter([]),
        { provide: SalesApiService, useValue: api },
        { provide: ProductApiService, useValue: productApi },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
  });

  function component(): TabsPageComponent { return TestBed.createComponent(TabsPageComponent).componentInstance; }

  it('lists only open TABLE sales as comandas', () => {
    const openTable = sale();
    api.list.mockReturnValueOnce(of([openTable, sale({ id: 21, type: 'COUNTER', tableNumber: null })]));
    const instance = component();

    instance.load();

    expect(api.list).toHaveBeenCalledWith('OPEN', 'TABLE');
    expect(instance.openSales()).toEqual([openTable]);
  });

  it('renders open comandas without table grid or table management', () => {
    api.list.mockReturnValueOnce(of([sale()]));
    fixture = TestBed.createComponent(TabsPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Comanda #20');
    expect(text).toContain('Mesa 4');
    expect(fixture.nativeElement.querySelector('.table-tile')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-manager')).toBeNull();
  });

  it('shows an empty state when there are no open comandas', () => {
    fixture = TestBed.createComponent(TabsPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nenhuma comanda aberta');
  });

  it('opens a TABLE sale from the typed table number', () => {
    const instance = component();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    instance.form = { tableNumber: 5 };

    instance.create();

    expect(api.open).toHaveBeenCalledWith({ type: 'TABLE', tableNumber: 5, customerName: null, customerPhone: null, serviceFee: 0, discountAmount: 0 });
    expect(router.navigate).toHaveBeenCalledWith(['/comandas', 20]);
  });

  it('rejects an invalid table number before calling the API', () => {
    const instance = component();
    instance.form = { tableNumber: 0 };

    instance.create();

    expect(api.open).not.toHaveBeenCalled();
    expect(feedback.error).toHaveBeenCalled();
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

  it('closes a fully paid table sale explicitly', () => {
    const instance = component();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    instance.currentSale.set(sale({ paidAmount: 12, remainingAmount: 0 }));
    instance.closeSale();
    expect(api.close).toHaveBeenCalledWith(20);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/comandas');
  });

  it('keeps the current sale when an API operation fails', () => {
    const existing = sale();
    api.addItem.mockReturnValueOnce(throwError(() => ({ error: { message: 'Falha controlada' } })));
    const instance = component();
    instance.currentSale.set(existing);

    instance.addProduct({ productId: 7, quantity: 1, notes: null, optionIds: [] });

    expect(instance.currentSale()).toBe(existing);
    expect(feedback.error).toHaveBeenCalled();
    expect(instance.busyProductId()).toBeNull();
  });
});
