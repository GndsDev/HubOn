import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CounterActivityService } from '../../core/services/counter-activity.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { SalesApiService } from '../../core/services/sales-api.service';
import { SaleProductPickerComponent } from '../../shared/components/sale-product-picker/sale-product-picker.component';
import { Product } from '../../shared/models/product.model';
import { Sale, SaleItem } from '../../shared/models/sale.model';
import { saleMenuProducts } from '../../shared/testing/sale-menu-products.fixture';
import { CounterPageComponent } from './counter-page.component';

const product: Product = {
  id: 10,
  categoryId: 2,
  categoryName: 'Bebidas',
  name: 'Suco',
  description: null,
  price: 8,
  active: true,
  available: true,
  displayOrder: 0,
  optionGroups: [],
  createdAt: '',
  updatedAt: '',
};

const item: SaleItem = {
  id: 70,
  productId: 10,
  productName: 'Suco',
  categoryName: 'Bebidas',
  baseUnitPrice: 8,
  unitPrice: 8,
  quantity: 1,
  subtotal: 8,
  notes: null,
  options: [],
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
    id: 50,
    type: 'COUNTER',
    status: 'OPEN',
    tableNumber: null,
    customerName: null,
    customerPhone: null,
    subtotal: 8,
    serviceFee: 0,
    discountAmount: 0,
    finalAmount: 8,
    paidAmount: 0,
    remainingAmount: 8,
    items: [item],
    payments: [],
    openedByUserId: 1,
    openedByUserName: 'Gerente',
    openedAt: '2026-08-07T12:00:00',
    closedByUserId: null,
    closedByUserName: null,
    closedAt: null,
    closedBusinessDate: null,
    cancelledByUserId: null,
    cancelledByUserName: null,
    cancelledAt: null,
    cancellationReason: null,
    ...overrides,
  };
}

describe('CounterPageComponent', () => {
  const api = {
    list: vi.fn(() => of([] as Sale[])),
    get: vi.fn(() => of(sale())),
    open: vi.fn(() => of(sale({ items: [], subtotal: 0, finalAmount: 0, remainingAmount: 0 }))),
    addItem: vi.fn(() => of(sale())),
    updateItemQuantity: vi.fn(() => of(sale())),
    removeItem: vi.fn(() => of(sale())),
    pay: vi.fn(() => of(sale())),
    close: vi.fn(() => of(sale({ status: 'CLOSED' }))),
    cancel: vi.fn(() => of(sale({ status: 'CANCELLED' }))),
  };
  const productApi = { getAll: vi.fn(() => of([product])) };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const activity = { refresh: vi.fn() };
  let fixture: ComponentFixture<CounterPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of([]));
    api.get.mockReturnValue(of(sale()));
    api.open.mockReturnValue(of(sale({ items: [], subtotal: 0, finalAmount: 0, remainingAmount: 0 })));
    api.addItem.mockReturnValue(of(sale()));
    api.updateItemQuantity.mockReturnValue(of(sale()));
    api.removeItem.mockReturnValue(of(sale()));
    api.pay.mockReturnValue(of(sale()));
    api.close.mockReturnValue(of(sale({ status: 'CLOSED' })));
    api.cancel.mockReturnValue(of(sale({ status: 'CANCELLED' })));
    productApi.getAll.mockReturnValue(of([product]));

    await TestBed.configureTestingModule({
      imports: [CounterPageComponent],
      providers: [
        provideRouter([]),
        { provide: SalesApiService, useValue: api },
        { provide: ProductApiService, useValue: productApi },
        { provide: FeedbackService, useValue: feedback },
        { provide: CounterActivityService, useValue: activity },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  function component(): CounterPageComponent {
    return TestBed.createComponent(CounterPageComponent).componentInstance;
  }

  function renderCatalog(): SaleProductPickerComponent {
    const products = saleMenuProducts();
    productApi.getAll.mockReturnValueOnce(of(products));
    fixture = TestBed.createComponent(CounterPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.currentSale.set(sale({ items: [], subtotal: 0, finalAmount: 0, remainingAmount: 0 }));
    fixture.detectChanges();
    return fixture.debugElement.query(By.directive(SaleProductPickerComponent)).componentInstance;
  }

  it('loads only open COUNTER sales and the current sale', () => {
    const existing = sale();
    api.list.mockReturnValueOnce(of([existing]));
    const instance = component();

    instance.load(existing.id);

    expect(api.list).toHaveBeenCalledWith('OPEN', 'COUNTER');
    expect(api.get).toHaveBeenCalledWith(50);
    expect(instance.products()).toEqual([product]);
    expect(instance.openSales()).toEqual([existing]);
    expect(instance.currentSale()).toEqual(existing);
  });

  it('creates a persistent COUNTER sale before navigation', () => {
    const instance = component();
    const router = TestBed.inject(Router);

    instance.newSale();

    expect(api.open).toHaveBeenCalledWith({
      type: 'COUNTER',
      tableNumber: null,
      customerName: null,
      customerPhone: null,
      serviceFee: 0,
      discountAmount: 0,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/balcao', 50]);
  });

  it('opens a sale and adds a simple product in one operational action', () => {
    const opened = sale({ items: [], subtotal: 0, finalAmount: 0, remainingAmount: 0 });
    const updated = sale();
    api.open.mockReturnValueOnce(of(opened));
    api.addItem.mockReturnValueOnce(of(updated));
    const instance = component();
    instance.products.set([product]);

    instance.addProduct({ productId: 10, quantity: 1, notes: null, optionIds: [] });

    expect(api.open).toHaveBeenCalledOnce();
    expect(api.addItem).toHaveBeenCalledWith(50, { productId: 10, quantity: 1, notes: null, optionIds: [] });
    expect(instance.currentSale()).toBe(updated);
    expect(instance.openSales()).toEqual([updated]);
    expect(instance.productFeedback()).toBe('Suco adicionado');
    expect(feedback.success).not.toHaveBeenCalled();
  });

  it.each(['Jantinha completa', 'Carreteiro completo', 'Arroz branco'])(
    'opens the shared choices dialog for %s at the counter',
    (productName) => {
      const picker = renderCatalog();
      const root = fixture.nativeElement as HTMLElement;
      const button = [...root.querySelectorAll<HTMLButtonElement>('.counter-product')]
        .find((item) => item.querySelector('.counter-product-copy strong')?.textContent?.trim() === productName);

      button?.click();
      fixture.detectChanges();

      expect(picker.products.find((item) => item.name === productName)?.optionGroups.length).toBeGreaterThan(0);
      expect(picker.selectedProduct()?.name).toBe(productName);
      expect(document.body.querySelector('.choice-dialog')).not.toBeNull();
    },
  );

  it('adds a simple product directly from the shared picker at the counter', () => {
    renderCatalog();
    const root = fixture.nativeElement as HTMLElement;
    const button = [...root.querySelectorAll<HTMLButtonElement>('.counter-product')]
      .find((item) => item.querySelector('.counter-product-copy strong')?.textContent?.trim() === 'Água mineral');

    button?.click();

    expect(api.addItem).toHaveBeenCalledWith(50, {
      productId: 104,
      quantity: 1,
      notes: null,
      optionIds: [],
    });
    expect(document.body.querySelector('.choice-dialog')).toBeNull();
  });

  it('ignores repeated product clicks while the current action is in progress', () => {
    const instance = component();
    instance.busyProductId.set(10);

    instance.addProduct({ productId: 11, quantity: 1, notes: null, optionIds: [] });

    expect(api.open).not.toHaveBeenCalled();
    expect(api.addItem).not.toHaveBeenCalled();
  });

  it('increases quantity on the matching sale item', () => {
    const updated = sale({ items: [{ ...item, quantity: 2, subtotal: 16 }], subtotal: 16, finalAmount: 16, remainingAmount: 16 });
    api.updateItemQuantity.mockReturnValueOnce(of(updated));
    const instance = component();
    instance.products.set([product]);
    instance.currentSale.set(sale());

    instance.addProduct({ productId: 10, quantity: 1, notes: null, optionIds: [] });

    expect(api.updateItemQuantity).toHaveBeenCalledWith(50, 70, { quantity: 2 });
    expect(api.removeItem).not.toHaveBeenCalled();
    expect(api.addItem).not.toHaveBeenCalled();
    expect(instance.currentSale()).toBe(updated);
    expect(instance.productFeedback()).toBe('Suco adicionado');
    expect(feedback.success).not.toHaveBeenCalled();
  });

  it('removes an item directly without opening a reason dialog', () => {
    const updated = sale({ items: [], subtotal: 0, finalAmount: 0, remainingAmount: 0 });
    api.removeItem.mockReturnValueOnce(of(updated));
    fixture = TestBed.createComponent(CounterPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.currentSale.set(sale());
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[title="Remover item"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.getAttribute('aria-label')).toBe('Remover item');
    button.click();
    fixture.detectChanges();

    expect(api.removeItem).toHaveBeenCalledWith(50, 70);
    expect(document.querySelector('#counter-cancel-item-title')).toBeNull();
    expect(fixture.componentInstance.currentSale()).toBe(updated);
    expect(feedback.success).toHaveBeenCalledWith('Item removido da venda.');
  });

  it('keeps a partial payment in the active sale and updates the remaining amount', () => {
    const partial = sale({
      paidAmount: 3,
      remainingAmount: 5,
      payments: [{ id: 1, saleId: 50, method: 'PIX', amount: 3, paidAt: '', receivedByUserId: 1, receivedByUserName: 'Gerente' }],
    });
    api.pay.mockReturnValueOnce(of(partial));
    const instance = component();
    instance.currentSale.set(sale());

    instance.quickPay('PIX');

    expect(api.pay).toHaveBeenCalledWith(50, { method: 'PIX', amount: 8 });
    expect(instance.currentSale()).toBe(partial);
    expect(instance.currentSale()?.remainingAmount).toBe(5);
    expect(activity.refresh).not.toHaveBeenCalled();
  });

  it('automatically clears a positively settled sale after the backend closes it', () => {
    const closed = sale({ status: 'CLOSED', paidAmount: 8, remainingAmount: 0 });
    api.pay.mockReturnValueOnce(of(closed));
    const instance = component();
    const router = TestBed.inject(Router);
    instance.currentSale.set(sale());
    instance.openSales.set([sale()]);

    instance.quickPay('CASH');

    expect(instance.currentSale()).toBeNull();
    expect(instance.openSales()).toEqual([]);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/balcao');
    expect(activity.refresh).toHaveBeenCalledOnce();
  });

  it('closes a zero-value sale without creating a zero payment', () => {
    const freeItem = { ...item, baseUnitPrice: 0, unitPrice: 0, subtotal: 0 };
    const zeroSale = sale({ subtotal: 0, finalAmount: 0, remainingAmount: 0, items: [freeItem] });
    const instance = component();
    instance.currentSale.set(zeroSale);

    instance.quickPay('PIX');
    instance.finishZeroSale();

    expect(api.pay).not.toHaveBeenCalled();
    expect(api.close).toHaveBeenCalledWith(50);
  });

  it('blocks product changes as soon as any payment exists', () => {
    const paid = sale({
      paidAmount: 3,
      remainingAmount: 5,
      payments: [{ id: 1, saleId: 50, method: 'PIX', amount: 3, paidAt: '', receivedByUserId: 1, receivedByUserName: 'Gerente' }],
    });
    const instance = component();
    instance.currentSale.set(paid);

    instance.addProduct({ productId: 10, quantity: 1, notes: null, optionIds: [] });
    instance.changeQuantity(item, 2);

    expect(api.addItem).not.toHaveBeenCalled();
    expect(api.updateItemQuantity).not.toHaveBeenCalled();
    expect(api.removeItem).not.toHaveBeenCalled();
  });

  it('preserves the opened sale when adding the first item fails', () => {
    const opened = sale({ items: [], subtotal: 0, finalAmount: 0, remainingAmount: 0 });
    api.open.mockReturnValueOnce(of(opened));
    api.addItem.mockReturnValueOnce(throwError(() => ({ error: { message: 'Produto indisponivel' } })));
    const instance = component();

    instance.addProduct({ productId: 10, quantity: 1, notes: null, optionIds: [] });

    expect(instance.currentSale()).toBe(opened);
    expect(instance.openSales()).toEqual([opened]);
    expect(feedback.error).toHaveBeenCalled();
  });

  it('keeps an existing sale intact when an API operation fails', () => {
    const existing = sale();
    api.addItem.mockReturnValueOnce(throwError(() => ({ error: { message: 'Falha controlada' } })));
    const instance = component();
    instance.currentSale.set(existing);

    instance.addProduct({ productId: 11, quantity: 1, notes: null, optionIds: [] });

    expect(instance.currentSale()).toBe(existing);
    expect(feedback.error).toHaveBeenCalled();
    expect(instance.busyProductId()).toBeNull();
  });
});
