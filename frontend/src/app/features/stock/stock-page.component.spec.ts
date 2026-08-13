import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { StockApiService } from '../../core/services/stock-api.service';
import { Product } from '../../shared/models/product.model';
import { ProductStockLink, StockItem, StockMovement } from '../../shared/models/stock.model';
import { StockPageComponent } from './stock-page.component';

const stockItem: StockItem = {
  id: 1,
  name: 'Carne',
  description: null,
  unit: 'KG',
  currentStock: 10,
  minimumStock: 2,
  status: 'NORMAL',
  active: true,
  createdAt: '',
  updatedAt: '',
};

const movement: StockMovement = {
  id: 5,
  stockItemId: 1,
  stockItemName: 'Carne',
  unit: 'KG',
  type: 'ENTRY',
  deltaQuantity: 5,
  previousBalance: 5,
  resultingBalance: 10,
  saleItemId: null,
  reversedMovementId: null,
  reason: 'Compra semanal',
  createdByUserId: 1,
  createdByUserName: 'Gerente',
  createdAt: '2026-08-07T10:00:00',
};

const product: Product = {
  id: 20,
  categoryId: null,
  categoryName: null,
  name: 'Espetinho de carne',
  description: null,
  price: 12,
  active: true,
  available: true,
  displayOrder: 0,
  optionGroups: [],
  createdAt: '',
  updatedAt: '',
};

const link: ProductStockLink = {
  id: 8,
  productId: 20,
  productName: 'Espetinho de carne',
  stockItemId: 1,
  stockItemName: 'Carne',
  unit: 'KG',
  quantityPerSale: 0.15,
  active: true,
  createdAt: '',
  updatedAt: '',
};

describe('StockPageComponent', () => {
  const api = {
    listItems: vi.fn(() => of([stockItem])),
    listMovements: vi.fn(() => of([movement])),
    getProductLink: vi.fn(() => of(link)),
    createItem: vi.fn(() => of(stockItem)),
    updateItem: vi.fn(() => of(stockItem)),
    setItemActive: vi.fn(() => of(stockItem)),
    entry: vi.fn(() => of(movement)),
    exit: vi.fn(() => of({ ...movement, type: 'EXIT' as const, deltaQuantity: -1 })),
    loss: vi.fn(() => of({ ...movement, type: 'LOSS' as const, deltaQuantity: -1 })),
    adjust: vi.fn(() => of({ ...movement, type: 'ADJUSTMENT' as const, deltaQuantity: -2 })),
    createProductLink: vi.fn(() => of(link)),
    updateProductLink: vi.fn(() => of(link)),
    deactivateProductLink: vi.fn(() => of(undefined)),
  };
  const productApi = { getAll: vi.fn(() => of([product])) };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.listItems.mockReturnValue(of([stockItem]));
    api.listMovements.mockReturnValue(of([movement]));
    api.getProductLink.mockReturnValue(of(link));
    api.createItem.mockReturnValue(of(stockItem));
    api.updateItem.mockReturnValue(of(stockItem));
    api.setItemActive.mockReturnValue(of(stockItem));
    api.entry.mockReturnValue(of(movement));
    api.exit.mockReturnValue(of({ ...movement, type: 'EXIT', deltaQuantity: -1 }));
    api.loss.mockReturnValue(of({ ...movement, type: 'LOSS', deltaQuantity: -1 }));
    api.adjust.mockReturnValue(of({ ...movement, type: 'ADJUSTMENT', deltaQuantity: -2 }));
    api.createProductLink.mockReturnValue(of(link));
    api.updateProductLink.mockReturnValue(of(link));
    api.deactivateProductLink.mockReturnValue(of(undefined));
    productApi.getAll.mockReturnValue(of([product]));

    await TestBed.configureTestingModule({
      imports: [StockPageComponent],
      providers: [
        { provide: StockApiService, useValue: api },
        { provide: ProductApiService, useValue: productApi },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
  });

  function component(): StockPageComponent {
    return TestBed.createComponent(StockPageComponent).componentInstance;
  }

  it('loads StockItem, StockMovement and ProductStockLink data', () => {
    const instance = component();

    instance.load();

    expect(instance.items()).toEqual([stockItem]);
    expect(instance.movements()).toEqual([movement]);
    expect(api.getProductLink).toHaveBeenCalledWith(20);
    expect(instance.linkFor(20)).toEqual(link);
    expect(instance.alertCount()).toBe(0);
  });

  it('creates and updates stock items with the current contract', () => {
    const instance = component();
    instance.openItem();
    instance.itemForm = { name: '  Carne  ', description: '', unit: 'KG', currentStock: 10, minimumStock: 2, active: true };

    instance.saveItem();

    expect(api.createItem).toHaveBeenCalledWith({ name: 'Carne', description: null, unit: 'KG', currentStock: 10, minimumStock: 2, active: true });

    instance.openItem(stockItem);
    instance.itemForm.minimumStock = 3;
    instance.saveItem();
    expect(api.updateItem).toHaveBeenCalledWith(1, { name: 'Carne', description: null, unit: 'KG', currentStock: 10, minimumStock: 3, active: true });
  });

  it('records entry and exit movements using stock item identifiers', () => {
    const instance = component();
    instance.movementForm = { stockItemId: 1, type: 'ENTRY', quantity: 4, reason: 'Compra' };
    instance.saveMovement();
    expect(api.entry).toHaveBeenCalledWith({ stockItemId: 1, quantity: 4, reason: 'Compra' });

    instance.movementForm = { stockItemId: 1, type: 'EXIT', quantity: 1, reason: '' };
    instance.saveMovement();
    expect(api.exit).toHaveBeenCalledWith({ stockItemId: 1, quantity: 1, reason: null });
  });

  it('requires reasons for loss and adjustment movements', () => {
    const instance = component();
    instance.movementForm = { stockItemId: 1, type: 'LOSS', quantity: 0.5, reason: '' };
    instance.saveMovement();
    expect(api.loss).not.toHaveBeenCalled();

    instance.movementForm.reason = 'Validade vencida';
    instance.saveMovement();
    expect(api.loss).toHaveBeenCalledWith({ stockItemId: 1, quantity: 0.5, reason: 'Validade vencida' });

    instance.movementForm = { stockItemId: 1, type: 'ADJUSTMENT', quantity: 0, reason: 'Contagem fisica' };
    instance.saveMovement();
    expect(api.adjust).toHaveBeenCalledWith({ stockItemId: 1, newStock: 0, reason: 'Contagem fisica' });
  });

  it('rejects zero for entry, exit and loss while allowing a zero adjustment', () => {
    const instance = component();

    for (const type of ['ENTRY', 'EXIT', 'LOSS'] as const) {
      instance.movementForm = { stockItemId: 1, type, quantity: 0, reason: 'Motivo' };
      expect(instance.invalidMovementQuantity()).toBe(true);
      instance.saveMovement();
    }

    expect(api.entry).not.toHaveBeenCalled();
    expect(api.exit).not.toHaveBeenCalled();
    expect(api.loss).not.toHaveBeenCalled();
    instance.movementForm = { stockItemId: 1, type: 'ADJUSTMENT', quantity: 0, reason: 'Zeragem' };
    expect(instance.invalidMovementQuantity()).toBe(false);
  });

  it('creates and updates the automatic product link with quantityPerSale', () => {
    const instance = component();
    instance.items.set([stockItem]);
    instance.openLink(product);
    instance.linkForm = { stockItemId: 1, quantityPerSale: 0.15 };

    instance.saveLink(product);

    expect(api.createProductLink).toHaveBeenCalledWith(20, { stockItemId: 1, quantityPerSale: 0.15 });
    expect(instance.linkFor(20)).toEqual(link);

    instance.productLinks.set(new Map([[20, link]]));
    instance.linkForm = { stockItemId: 1, quantityPerSale: 0.2 };
    instance.saveLink(product);
    expect(api.updateProductLink).toHaveBeenCalledWith(20, { stockItemId: 1, quantityPerSale: 0.2 });
  });

  it('filters movement history by text, type and stock item and clears the filters', () => {
    const saleMovement: StockMovement = {
      ...movement,
      id: 6,
      stockItemId: 2,
      stockItemName: 'Refri Lata',
      type: 'SALE',
      reason: null,
      createdByUserName: 'Maria',
    };
    const instance = component();
    instance.movements.set([movement, saleMovement]);

    instance.movementSearchTerm = 'compra semanal';
    expect(instance.filteredMovements()).toEqual([movement]);
    instance.movementSearchTerm = 'maria';
    expect(instance.filteredMovements()).toEqual([saleMovement]);
    instance.movementSearchTerm = 'refri';
    expect(instance.filteredMovements()).toEqual([saleMovement]);

    instance.movementSearchTerm = '';
    instance.movementTypeFilter = 'ENTRY';
    expect(instance.filteredMovements()).toEqual([movement]);
    instance.movementTypeFilter = 'ALL';
    instance.movementItemFilter = 2;
    expect(instance.filteredMovements()).toEqual([saleMovement]);

    instance.clearMovementFilters();
    expect(instance.movementSearchTerm).toBe('');
    expect(instance.movementTypeFilter).toBe('ALL');
    expect(instance.movementItemFilter).toBe('ALL');
    expect(instance.filteredMovements()).toHaveLength(2);
  });

  it('filters automatic stock links by product, category, stock item and link status', () => {
    const linkedProduct: Product = {
      ...product,
      id: 21,
      name: 'Refri Lata',
      categoryId: 3,
      categoryName: 'Bebidas',
    };
    const linked: ProductStockLink = {
      ...link,
      productId: linkedProduct.id,
      productName: linkedProduct.name,
      stockItemName: 'Refri Lata',
    };
    const instance = component();
    instance.products.set([product, linkedProduct]);
    instance.productLinks.set(new Map([[product.id, null], [linkedProduct.id, linked]]));

    for (const query of ['refri lata', 'bebidas']) {
      instance.linkSearchTerm = query;
      expect(instance.filteredLinkProducts()).toEqual([linkedProduct]);
    }

    instance.linkSearchTerm = '';
    instance.linkStatusFilter = 'LINKED';
    expect(instance.filteredLinkProducts()).toEqual([linkedProduct]);
    instance.linkStatusFilter = 'UNLINKED';
    expect(instance.filteredLinkProducts()).toEqual([product]);
    instance.linkStatusFilter = 'ALL';
    instance.linkCategoryFilter = 3;
    expect(instance.filteredLinkProducts()).toEqual([linkedProduct]);

    instance.clearLinkFilters();
    expect(instance.linkSearchTerm).toBe('');
    expect(instance.linkStatusFilter).toBe('ALL');
    expect(instance.linkCategoryFilter).toBe('ALL');
    expect(instance.filteredLinkProducts()).toHaveLength(2);
  });

  it('uses a valid PrimeIcons class to deactivate an automatic link', () => {
    const fixture = TestBed.createComponent(StockPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.view.set('LINKS');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[title="Desativar vínculo"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.querySelector('i')?.classList.contains('pi-times-circle')).toBe(true);
    expect(button.querySelector('i')?.classList.contains('pi-link-slash')).toBe(false);
  });

  it('exposes load failures without replacing existing stock state', () => {
    const instance = component();
    instance.items.set([stockItem]);
    api.listItems.mockReturnValueOnce(throwError(() => ({ error: { message: 'Falha controlada' } })));

    instance.load();

    expect(instance.items()).toEqual([stockItem]);
    expect(instance.error()).toBeTruthy();
    expect(instance.loading()).toBe(false);
  });
});
