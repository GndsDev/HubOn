import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryApiService } from '../../core/services/category-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { StockApiService } from '../../core/services/stock-api.service';
import { Product } from '../../shared/models/product.model';
import { ProductsPageComponent } from './products-page.component';

const uncategorizedProduct: Product = {
  id: 1,
  categoryId: null,
  categoryName: null,
  name: 'Refri Lata',
  description: null,
  price: 7,
  active: true,
  available: true,
  displayOrder: 0,
  optionGroups: [],
  createdAt: '',
  updatedAt: '',
};

describe('ProductsPageComponent', () => {
  const api = {
    getAll: vi.fn(() => of([uncategorizedProduct])),
    create: vi.fn(() => of(uncategorizedProduct)),
    update: vi.fn(() => of(uncategorizedProduct)),
    createOptionGroup: vi.fn(),
    updateOptionGroup: vi.fn(),
    createOption: vi.fn(),
    updateOption: vi.fn(),
  };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const stockApi = {
    listActiveItems: vi.fn(() => of([])),
    createOptionLink: vi.fn(),
    updateOptionLink: vi.fn(),
    deactivateOptionLink: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProductsPageComponent],
      providers: [
        { provide: ProductApiService, useValue: api },
        { provide: CategoryApiService, useValue: { getAll: () => of([]) } },
        { provide: StockApiService, useValue: stockApi },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
  });

  it('sends the exact simplified product body and preserves nullable category', () => {
    const component = TestBed.createComponent(ProductsPageComponent).componentInstance;
    component.openProduct();
    component.productForm = { categoryId: null, name: '  Refri Lata  ', description: '', price: 7, active: true, available: true, displayOrder: 0 };
    component.saveProduct();
    expect(api.create).toHaveBeenCalledWith({ categoryId: null, name: 'Refri Lata', description: null, price: 7, active: true, available: true, displayOrder: 0 });
    expect(component.products()).toEqual([uncategorizedProduct]);
  });

  it('updates the product filter immediately while typing', () => {
    const component = TestBed.createComponent(ProductsPageComponent).componentInstance;
    component.products.set([uncategorizedProduct, { ...uncategorizedProduct, id: 2, name: 'Jantinha Completa', categoryName: 'Pratos' }]);
    component.searchTerm = 'janti';
    expect(component.filteredProducts().map((product) => product.name)).toEqual(['Jantinha Completa']);
    component.searchTerm = 'refri';
    expect(component.filteredProducts().map((product) => product.name)).toEqual(['Refri Lata']);
  });

  it('creates option groups with the current selection limits', () => {
    const group = {
      id: 4,
      productId: 1,
      name: 'Tamanho',
      minimumSelections: 1,
      maximumSelections: 1,
      displayOrder: 0,
      active: true,
      options: [],
      createdAt: '',
      updatedAt: '',
    };
    api.createOptionGroup.mockReturnValueOnce(of(group));
    const component = TestBed.createComponent(ProductsPageComponent).componentInstance;
    component.products.set([uncategorizedProduct]);
    component.openOptions(uncategorizedProduct);

    component.saveGroup({ id: null, name: '  Tamanho  ', required: true, maximumSelections: 1, displayOrder: 0, active: true });

    expect(api.createOptionGroup).toHaveBeenCalledWith(1, {
      name: 'Tamanho',
      minimumSelections: 1,
      maximumSelections: 1,
      displayOrder: 0,
      active: true,
      options: [],
    });
    expect(component.optionsProduct()?.optionGroups).toEqual([group]);
  });

  it('does not send option limits rejected by the backend contract', () => {
    const component = TestBed.createComponent(ProductsPageComponent).componentInstance;
    component.openOptions(uncategorizedProduct);

    component.saveGroup({ id: null, name: 'Opcional', required: false, maximumSelections: 0, displayOrder: 0, active: true });

    expect(api.createOptionGroup).not.toHaveBeenCalled();
  });

  it('saves optional stock control for a product choice', () => {
    const group = {
      id: 4,
      productId: 1,
      name: 'Escolha o espeto',
      minimumSelections: 1,
      maximumSelections: 1,
      displayOrder: 0,
      active: true,
      options: [],
      createdAt: '',
      updatedAt: '',
    };
    const configuredProduct = { ...uncategorizedProduct, optionGroups: [group] };
    const choice = {
      id: 9,
      groupId: 4,
      name: 'Picanha Montada',
      additionalPrice: 0,
      displayOrder: 0,
      active: true,
      stockLink: null,
      createdAt: '',
      updatedAt: '',
    };
    const stockLink = {
      id: 12,
      productOptionId: 9,
      stockItemId: 20,
      stockItemName: 'Picanha Montada',
      unit: 'UN' as const,
      quantityPerSelection: 1,
      active: true,
      createdAt: '',
      updatedAt: '',
    };
    api.createOption.mockReturnValueOnce(of(choice));
    stockApi.createOptionLink.mockReturnValueOnce(of(stockLink));
    const component = TestBed.createComponent(ProductsPageComponent).componentInstance;
    component.products.set([configuredProduct]);
    component.openOptions(configuredProduct);

    component.saveOption({
      id: null,
      groupId: 4,
      name: 'Picanha Montada',
      additionalPrice: 0,
      displayOrder: 0,
      active: true,
      stockItemId: 20,
      quantityPerSelection: 1,
    });

    expect(stockApi.createOptionLink).toHaveBeenCalledWith(1, 4, 9, {
      stockItemId: 20,
      quantityPerSelection: 1,
    });
    expect(component.optionsProduct()?.optionGroups[0].options[0].stockLink).toEqual(stockLink);
  });

  it('uses Escolhas do produto and does not expose display order', () => {
    const fixture = TestBed.createComponent(ProductsPageComponent);
    fixture.componentInstance.products.set([uncategorizedProduct]);
    fixture.componentInstance.openOptions(uncategorizedProduct);
    fixture.detectChanges();

    const text = `${fixture.nativeElement.textContent} ${document.body.textContent}`;
    expect(text).toContain('Escolhas do produto');
    expect(text).not.toContain('Ordem de exibição');
    expect(text).not.toContain('displayOrder');
  });
});
