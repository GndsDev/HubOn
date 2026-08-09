import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { SalesApiService } from '../../core/services/sales-api.service';
import { SaleProductPickerComponent } from '../../shared/components/sale-product-picker/sale-product-picker.component';
import { Product } from '../../shared/models/product.model';
import { Sale, SaleItem } from '../../shared/models/sale.model';
import { saleMenuProducts } from '../../shared/testing/sale-menu-products.fixture';
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
    addItem: vi.fn(() => of(sale())), updateItemQuantity: vi.fn(() => of(sale())),
    cancelItem: vi.fn(() => of(sale())), close: vi.fn(() => of(sale({ status: 'CLOSED' }))),
    cancel: vi.fn(() => of(sale({ status: 'CANCELLED' }))),
  };
  const productApi = { getAll: vi.fn(() => of([] as Product[])) };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  let fixture: ComponentFixture<TabsPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of([]));
    api.get.mockReturnValue(of(sale()));
    api.open.mockReturnValue(of(sale()));
    api.addItem.mockReturnValue(of(sale()));
    api.updateItemQuantity.mockReturnValue(of(sale()));
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

  function renderCatalog(): SaleProductPickerComponent {
    const products = saleMenuProducts();
    productApi.getAll.mockReturnValueOnce(of(products));
    fixture = TestBed.createComponent(TabsPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.currentSale.set(sale({ items: [], subtotal: 0, finalAmount: 0, remainingAmount: 0 }));
    fixture.componentInstance.productPanelOpen.set(true);
    fixture.detectChanges();
    return fixture.debugElement.query(By.directive(SaleProductPickerComponent)).componentInstance;
  }

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
    expect(instance.productFeedback()).toBe('Produto adicionado');
    expect(feedback.success).not.toHaveBeenCalled();
  });

  it.each(['Jantinha completa', 'Carreteiro completo', 'Arroz branco'])(
    'opens the shared choices dialog for %s in comandas',
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

  it('adds a simple product directly from the shared picker in comandas', () => {
    renderCatalog();
    const root = fixture.nativeElement as HTMLElement;
    const button = [...root.querySelectorAll<HTMLButtonElement>('.counter-product')]
      .find((item) => item.querySelector('.counter-product-copy strong')?.textContent?.trim() === 'Água mineral');

    button?.click();

    expect(api.addItem).toHaveBeenCalledWith(20, {
      productId: 104,
      quantity: 1,
      notes: null,
      optionIds: [],
    });
    expect(document.body.querySelector('.choice-dialog')).toBeNull();
  });

  it('keeps the shared picker mounted while the comanda catalog is hidden', () => {
    const picker = renderCatalog();
    fixture.componentInstance.productPanelOpen.set(false);
    fixture.detectChanges();

    const mountedPicker = fixture.debugElement.query(By.directive(SaleProductPickerComponent)).componentInstance;
    expect(mountedPicker).toBe(picker);
    expect((fixture.nativeElement as HTMLElement).querySelector('.tab-catalog-panel-hidden')).not.toBeNull();
  });

  it('changes quantity while preserving the same sale item', () => {
    const instance = component();
    const updated = sale({ items: [{ ...line, quantity: 3, subtotal: 18 }], subtotal: 18, finalAmount: 18, remainingAmount: 18 });
    api.updateItemQuantity.mockReturnValueOnce(of(updated));
    instance.currentSale.set(sale());
    instance.changeQuantity(line, 3);
    expect(api.updateItemQuantity).toHaveBeenCalledWith(20, 9, { quantity: 3 });
    expect(api.cancelItem).not.toHaveBeenCalled();
    expect(api.addItem).not.toHaveBeenCalled();
    expect(instance.currentSale()).toBe(updated);
  });

  it('does not use quantity zero to remove an item', () => {
    const instance = component();
    instance.currentSale.set(sale());

    instance.changeQuantity(line, 0);

    expect(api.updateItemQuantity).not.toHaveBeenCalled();
    expect(api.cancelItem).not.toHaveBeenCalled();
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
