import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryApiService } from '../../core/services/category-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { IngredientApiService } from '../../core/services/ingredient-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { ProductStockLinkApiService } from '../../core/services/product-stock-link-api.service';
import { Product, ProductVariant } from '../../shared/models/product.model';
import { ProductsPageComponent } from './products-page.component';

describe('ProductsPageComponent', () => {
  const variants: ProductVariant[] = [
    {
      id: 11, productId: 1, productName: 'Executivo da casa', name: 'Padrão', sku: null,
      price: 32.91, active: true, available: true, displayOrder: 0,
      stockLinkActive: false, stockLinkId: null, stockItemId: null, stockItemName: null,
      quantityPerSale: null, createdAt: '', updatedAt: '',
    },
    {
      id: 12, productId: 1, productName: 'Executivo da casa', name: 'Grande', sku: 'EXEC-G',
      price: 39.9, active: true, available: false, displayOrder: 1,
      stockLinkActive: true, stockLinkId: 21, stockItemId: 31, stockItemName: 'Embalagem grande',
      quantityPerSale: 1, createdAt: '', updatedAt: '',
    },
  ];
  const product: Product = {
    id: 1,
    categoryId: 2,
    categoryName: 'Pratos principais',
    categoryActive: true,
    name: 'Executivo da casa',
    description: 'Prato executivo',
    preparationFlow: 'REQUIRES_PREPARATION',
    active: true,
    available: true,
    displayOrder: 0,
    imageUrl: null,
    variantCount: 2,
    activeVariantCount: 2,
    sellableVariantCount: 1,
    minimumVariantPrice: 32.91,
    maximumVariantPrice: 39.9,
    hasAutomaticStockLink: true,
    complete: true,
    variants,
    optionGroups: [],
    createdAt: '',
    updatedAt: '',
  };
  const productApi = {
    getAll: vi.fn(() => of([product])),
    getById: vi.fn(() => of(product)),
    update: vi.fn(() => of(product)),
    createVariant: vi.fn(() => of(variants[0])),
    updateVariant: vi.fn(() => of(variants[1])),
    activateVariant: vi.fn(() => of(variants[0])),
    deactivateVariant: vi.fn(() => of(variants[0])),
    setVariantAvailable: vi.fn(() => of(variants[0])),
    setAvailable: vi.fn(() => of(product)),
    activate: vi.fn(() => of(product)),
    deactivate: vi.fn(() => of(product)),
    createOptionGroup: vi.fn(),
    updateOptionGroup: vi.fn(),
    createOption: vi.fn(),
    updateOption: vi.fn(),
    setOptionGroupActive: vi.fn(),
    setOptionActive: vi.fn(),
  };
  const stockLinkApi = {
    create: vi.fn(() => of({})),
    update: vi.fn(() => of({})),
    deactivate: vi.fn(() => of(void 0)),
  };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  let fixture: ComponentFixture<ProductsPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    productApi.getAll.mockReturnValue(of([product]));
    productApi.getById.mockReturnValue(of(product));
    productApi.updateVariant.mockReturnValue(of(variants[1]));
    stockLinkApi.update.mockReturnValue(of({}));
    await TestBed.configureTestingModule({
      imports: [ProductsPageComponent],
      providers: [
        { provide: ProductApiService, useValue: productApi },
        { provide: CategoryApiService, useValue: { getAll: () => of([{ id: 2, name: 'Pratos principais', description: null, active: true, displayOrder: 0, createdAt: '', updatedAt: '' }]) } },
        { provide: IngredientApiService, useValue: { getAll: () => of([{ id: 31, name: 'Embalagem grande', description: null, unit: 'UN', controlMode: 'DIRECT_SALE', currentStock: 20, minimumStock: 2, idealStock: 30, active: true, stockStatus: 'NORMAL', createdAt: '', updatedAt: '' }]) } },
        { provide: ProductStockLinkApiService, useValue: stockLinkApi },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductsPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    document.getElementById('hubon-overlay-root')?.remove();
    document.body.classList.remove('hubon-overlay-open');
  });

  function openVariants(): HTMLElement {
    fixture.componentInstance.openEdit(product);
    fixture.componentInstance.showManagementTab('VARIANTS');
    fixture.detectChanges();
    return document.querySelector('.product-management-dialog') as HTMLElement;
  }

  it('renders one stable management dialog with independent list and form areas', () => {
    const dialog = openVariants();
    const layout = dialog.querySelector('.variant-manager-layout') as HTMLElement;

    expect(dialog.querySelector('.product-management-header')).not.toBeNull();
    expect(dialog.querySelector(':scope > .modal-body.product-management-body')).not.toBeNull();
    expect(dialog.querySelector(':scope > .modal-footer')).not.toBeNull();
    expect(dialog.querySelector('.product-manager-tabs')).not.toBeNull();
    expect(dialog.querySelector('.product-management-content')).not.toBeNull();
    expect(layout.children).toHaveLength(2);
    expect(layout.querySelectorAll('.variant-manager-row')).toHaveLength(2);
    expect(layout.querySelector('.variant-editor')).not.toBeNull();
    expect(dialog.textContent).toContain('Nova variação');
    expect(dialog.textContent).not.toContain('Limpar');
    expect(document.querySelector('.nested-modal')).toBeNull();
    expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
  });

  it('keeps the registration wizard inside the shared modal shell', () => {
    fixture.componentInstance.openRegistration();
    fixture.detectChanges();

    const dialog = document.querySelector('.product-wizard-panel') as HTMLElement;
    expect(dialog.querySelector(':scope > .modal-header')).not.toBeNull();
    expect(dialog.querySelector(':scope > .modal-body.product-wizard-body')).not.toBeNull();
    expect(dialog.querySelector(':scope > .modal-footer')).not.toBeNull();
    expect(dialog.querySelector('.wizard-progress')).not.toBeNull();
  });

  it('exposes a clear primary action and a keyboard-ready secondary menu for every variation', () => {
    const dialog = openVariants();
    const editButtons = dialog.querySelectorAll<HTMLButtonElement>('[aria-label^="Editar variação"]');
    const menuButtons = dialog.querySelectorAll<HTMLButtonElement>('[aria-label^="Mais ações da variação"]');

    expect(editButtons).toHaveLength(2);
    expect(menuButtons).toHaveLength(2);
    menuButtons[1].click();
    fixture.detectChanges();

    const menu = document.querySelector('.variant-action-menu') as HTMLElement;
    expect(menu.getAttribute('role')).toBe('menu');
    expect(menu.textContent).toContain('Alterar vínculo de estoque');
    expect(menu.textContent).toContain('Remover vínculo de estoque');
    expect(menu.textContent).toContain('Disponibilizar');
    expect(menu.textContent).toContain('Desativar');

    fixture.componentInstance.onVariantActionMenuKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(document.querySelector('.variant-action-menu')).toBeNull();
  });

  it('uses the same form for editing and saves the optional stock link together', () => {
    const dialog = openVariants();
    fixture.componentInstance.editVariant(variants[1]);
    fixture.detectChanges();

    expect(dialog.textContent).toContain('Editar variação');
    expect(fixture.componentInstance.variantForm.name).toBe('Grande');
    expect(fixture.componentInstance.stockLinkEnabled()).toBe(true);
    fixture.componentInstance.variantForm.price = 41;
    fixture.componentInstance.saveVariant();

    expect(productApi.updateVariant).toHaveBeenCalledWith(1, 12, expect.objectContaining({ price: 41 }));
    expect(stockLinkApi.update).toHaveBeenCalledWith(12, { stockItemId: 31, quantityPerSale: 1 });
    expect(feedback.success).toHaveBeenCalledWith('Variação salva.');
    expect(fixture.componentInstance.variantEditing()).toBeNull();
  });

  it('cancels editing by returning the form to a new variation', () => {
    openVariants();
    fixture.componentInstance.editVariant(variants[0]);
    fixture.componentInstance.resetVariantForm();
    fixture.detectChanges();

    expect(fixture.componentInstance.variantEditing()).toBeNull();
    expect(fixture.componentInstance.variantForm.name).toBe('');
    expect(fixture.componentInstance.stockLinkEnabled()).toBe(false);
    expect(document.querySelector('.product-management-dialog')?.textContent).toContain('Nova variação');
  });
});
