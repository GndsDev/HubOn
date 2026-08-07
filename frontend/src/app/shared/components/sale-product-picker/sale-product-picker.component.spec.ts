import { describe, expect, it, vi } from 'vitest';
import { Product } from '../../models/product.model';
import { SaleProductPickerComponent } from './sale-product-picker.component';

function product(overrides: Partial<Product> = {}): Product {
  return { id: 1, categoryId: 1, categoryName: 'Bebidas', name: 'Coca-Cola 350ml', description: null, price: 6, active: true, available: true, displayOrder: 0, optionGroups: [], createdAt: '', updatedAt: '', ...overrides };
}

describe('SaleProductPickerComponent', () => {
  it('filters locally while typing, ignoring accents and without an API request', () => {
    const component = new SaleProductPickerComponent();
    component.products = [product(), product({ id: 2, name: 'Água mineral' })];
    component.searchTerm = 'agua';
    expect(component.filteredProducts().map((item) => item.id)).toEqual([2]);
  });

  it('keeps uncategorized products in Todos and filters named categories', () => {
    const component = new SaleProductPickerComponent();
    component.products = [product(), product({ id: 2, categoryId: null, categoryName: null, name: 'Avulso' })];
    expect(component.filteredProducts()).toHaveLength(2);
    component.category = 'Bebidas';
    expect(component.filteredProducts().map((item) => item.name)).toEqual(['Coca-Cola 350ml']);
  });

  it('adds a simple product in one click', () => {
    const component = new SaleProductPickerComponent();
    const emitted = vi.fn();
    component.addItem.subscribe(emitted);
    component.select(product());
    expect(emitted).toHaveBeenCalledWith({ productId: 1, quantity: 1, notes: null, optionIds: [] });
  });

  it('requires a valid choice before adding a configured product', () => {
    const component = new SaleProductPickerComponent();
    const configured = product({ optionGroups: [{ id: 4, productId: 1, name: 'Espeto', minimumSelections: 1, maximumSelections: 1, displayOrder: 0, active: true, options: [{ id: 9, groupId: 4, name: 'Carne', additionalPrice: 0, displayOrder: 0, active: true, createdAt: '', updatedAt: '' }], createdAt: '', updatedAt: '' }] });
    const emitted = vi.fn();
    component.addItem.subscribe(emitted);
    component.select(configured);
    expect(component.selectedProduct()).toBe(configured);
    expect(component.selectionValid()).toBe(false);
    component.toggleChoice(component.choiceGroups()[0], 9);
    component.confirmChoices();
    expect(emitted).toHaveBeenCalledWith({ productId: 1, quantity: 1, notes: null, optionIds: [9] });
  });
});
