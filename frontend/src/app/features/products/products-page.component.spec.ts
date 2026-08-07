import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryApiService } from '../../core/services/category-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { Product } from '../../shared/models/product.model';
import { ProductsPageComponent } from './products-page.component';

const uncategorizedProduct: Product = {
  id: 1,
  categoryId: null,
  categoryName: null,
  name: 'Coca-Cola 350ml',
  description: null,
  price: 6,
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
  };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProductsPageComponent],
      providers: [
        { provide: ProductApiService, useValue: api },
        { provide: CategoryApiService, useValue: { getAll: () => of([]) } },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
  });

  it('sends the exact simplified product body and preserves nullable category', () => {
    const component = TestBed.createComponent(ProductsPageComponent).componentInstance;
    component.openProduct();
    component.productForm = { categoryId: null, name: '  Coca-Cola 350ml  ', description: '', price: 6, active: true, available: true, displayOrder: 0 };
    component.saveProduct();
    expect(api.create).toHaveBeenCalledWith({ categoryId: null, name: 'Coca-Cola 350ml', description: null, price: 6, active: true, available: true, displayOrder: 0 });
    expect(component.products()).toEqual([uncategorizedProduct]);
  });

  it('updates the product filter immediately while typing', () => {
    const component = TestBed.createComponent(ProductsPageComponent).componentInstance;
    component.products.set([uncategorizedProduct, { ...uncategorizedProduct, id: 2, name: 'Jantinha', categoryName: 'Refeições' }]);
    component.searchTerm = 'janta';
    expect(component.filteredProducts().map((product) => product.name)).toEqual(['Jantinha']);
    component.searchTerm = 'coca';
    expect(component.filteredProducts().map((product) => product.name)).toEqual(['Coca-Cola 350ml']);
  });
});
