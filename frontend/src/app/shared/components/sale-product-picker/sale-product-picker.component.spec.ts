import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Product } from '../../models/product.model';
import { saleMenuProducts } from '../../testing/sale-menu-products.fixture';
import { SaleProductPickerComponent } from './sale-product-picker.component';

function product(overrides: Partial<Product> = {}): Product {
  return { id: 1, categoryId: 1, categoryName: 'Bebidas', name: 'Refri Lata', description: null, price: 7, active: true, available: true, displayOrder: 0, optionGroups: [], createdAt: '', updatedAt: '', ...overrides };
}

describe('SaleProductPickerComponent', () => {
  let fixture: ComponentFixture<SaleProductPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SaleProductPickerComponent],
    }).compileComponents();
  });

  it('filters locally while typing, ignoring accents and without an API request', () => {
    const component = new SaleProductPickerComponent();
    component.products = [product(), product({ id: 2, name: 'Água Natural', price: 4 })];
    component.searchTerm = 'agua';
    expect(component.filteredProducts().map((item) => item.id)).toEqual([2]);
  });

  it('keeps uncategorized products in Todos and filters named categories', () => {
    const component = new SaleProductPickerComponent();
    component.products = [product(), product({ id: 2, categoryId: null, categoryName: null, name: 'Avulso' })];
    expect(component.filteredProducts()).toHaveLength(2);
    component.category = 'Bebidas';
    expect(component.filteredProducts().map((item) => item.name)).toEqual(['Refri Lata']);
  });

  it('orders the catalog by category and product name without display order', () => {
    const component = new SaleProductPickerComponent();
    component.products = [
      product({ id: 1, categoryName: 'Pratos', name: 'Jantinha Completa', displayOrder: 0 }),
      product({ id: 2, categoryName: 'Bebidas', name: 'Água', displayOrder: 99 }),
      product({ id: 3, categoryName: 'Bebidas', name: 'Cerveja', displayOrder: 1 }),
    ];

    expect(component.filteredProducts().map((item) => item.name)).toEqual(['Água', 'Cerveja', 'Jantinha Completa']);
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
    const configured = product({ optionGroups: [{ id: 4, productId: 1, name: 'Espeto', minimumSelections: 1, maximumSelections: 1, displayOrder: 0, active: true, options: [{ id: 9, groupId: 4, name: 'Carne', additionalPrice: 0, displayOrder: 0, active: true, stockLink: null, createdAt: '', updatedAt: '' }], createdAt: '', updatedAt: '' }] });
    const emitted = vi.fn();
    component.addItem.subscribe(emitted);
    component.select(configured);
    expect(component.selectedProduct()).toBe(configured);
    expect(component.selectionValid()).toBe(false);
    component.toggleChoice(component.choiceGroups()[0], 9);
    component.confirmChoices();
    expect(emitted).toHaveBeenCalledWith({ productId: 1, quantity: 1, notes: null, optionIds: [9] });
  });

  it('emits the selected bean and skewer ids for a meal', () => {
    const component = new SaleProductPickerComponent();
    const configured = product({
      optionGroups: [
        {
          id: 4,
          productId: 1,
          name: 'Escolha o feijão',
          minimumSelections: 1,
          maximumSelections: 1,
          displayOrder: 0,
          active: true,
          options: [{ id: 8, groupId: 4, name: 'Tropeiro', additionalPrice: 0, displayOrder: 0, active: true, stockLink: null, createdAt: '', updatedAt: '' }],
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 5,
          productId: 1,
          name: 'Escolha o espeto',
          minimumSelections: 1,
          maximumSelections: 1,
          displayOrder: 1,
          active: true,
          options: [{ id: 9, groupId: 5, name: 'Picanha Montada', additionalPrice: 0, displayOrder: 0, active: true, stockLink: null, createdAt: '', updatedAt: '' }],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    const emitted = vi.fn();
    component.addItem.subscribe(emitted);
    component.select(configured);
    const groups = component.choiceGroups();
    const beanGroup = groups.find((group) => group.name.includes('feijão'))!;
    const skewerGroup = groups.find((group) => group.name.includes('espeto'))!;

    component.toggleChoice(beanGroup, 8);
    expect(component.selectionValid()).toBe(false);
    component.toggleChoice(skewerGroup, 9);
    component.confirmChoices();

    expect(emitted).toHaveBeenCalledWith({ productId: 1, quantity: 1, notes: null, optionIds: [8, 9] });
    expect(component.isSkewerGroup(skewerGroup)).toBe(true);
  });

  it('shows final prices for medium and large portions', () => {
    const component = new SaleProductPickerComponent();
    const portion = product({ price: 10 });
    const size = {
      id: 7,
      productId: 1,
      name: 'Tamanho',
      minimumSelections: 1,
      maximumSelections: 1,
      displayOrder: 0,
      active: true,
      options: [
        { id: 10, groupId: 7, name: 'Média', additionalPrice: 0, displayOrder: 0, active: true, stockLink: null, createdAt: '', updatedAt: '' },
        { id: 11, groupId: 7, name: 'Grande', additionalPrice: 8, displayOrder: 1, active: true, stockLink: null, createdAt: '', updatedAt: '' },
      ],
      createdAt: '',
      updatedAt: '',
    };

    expect(component.choicePriceLabel(portion, size, size.options[0])).toContain('10,00');
    expect(component.choicePriceLabel(portion, size, size.options[1])).toContain('18,00');
  });

  it('renders required single choices as radios and blocks confirmation until they are complete', () => {
    fixture = TestBed.createComponent(SaleProductPickerComponent);
    const component = fixture.componentInstance;
    const emitted = vi.fn();
    component.products = saleMenuProducts();
    component.confirmLabel = 'Adicionar à comanda';
    component.addItem.subscribe(emitted);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const productButton = [...root.querySelectorAll<HTMLButtonElement>('.counter-product')]
      .find((button) => button.querySelector('.counter-product-copy strong')?.textContent?.trim() === 'Jantinha Completa');
    productButton?.click();
    fixture.detectChanges();

    const dialog = document.body.querySelector<HTMLElement>('.choice-dialog');
    expect(dialog?.textContent).toContain('Pratos');
    expect(dialog?.textContent).toContain('Jantinha Completa');
    expect(dialog?.textContent).toContain('Arroz branco, feijão tropeiro ou de caldo, mandioca, vinagrete e 1 espeto');

    const radios = [...dialog!.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    const submit = dialog!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const groupTitles = [...dialog!.querySelectorAll<HTMLElement>('.choice-group-header h3')]
      .map((title) => title.textContent?.trim());
    expect(groupTitles).toEqual(['Escolha o feijão', 'Escolha o espeto']);
    expect(radios).toHaveLength(21);
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toContain('Adicionar à comanda');

    const options = [...dialog!.querySelectorAll<HTMLElement>('.choice-option')];
    options.find((item) => item.textContent?.includes('Tropeiro'))
      ?.querySelector<HTMLInputElement>('input')?.click();
    options.find((item) => item.textContent?.includes('Picanha Montada'))
      ?.querySelector<HTMLInputElement>('input')?.click();
    fixture.detectChanges();

    expect(dialog!.querySelectorAll('.choice-option-selected')).toHaveLength(2);
    expect(submit.disabled).toBe(false);
    submit.click();

    expect(emitted).toHaveBeenCalledWith({
      productId: 101,
      quantity: 1,
      notes: null,
      optionIds: [10101, 10103],
    });
  });

  it('shows only the bean choice for Jantinha Sem Espeto', () => {
    fixture = TestBed.createComponent(SaleProductPickerComponent);
    const component = fixture.componentInstance;
    const emitted = vi.fn();
    component.products = saleMenuProducts();
    component.addItem.subscribe(emitted);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const productButton = [...root.querySelectorAll<HTMLButtonElement>('.counter-product')]
      .find((button) => button.querySelector('.counter-product-copy strong')?.textContent?.trim() === 'Jantinha Sem Espeto');
    productButton?.click();
    fixture.detectChanges();

    const dialog = document.body.querySelector<HTMLElement>('.choice-dialog')!;
    const groupTitles = [...dialog.querySelectorAll<HTMLElement>('.choice-group-header h3')]
      .map((title) => title.textContent?.trim());
    expect(groupTitles).toEqual(['Escolha o feijão']);
    expect(dialog.textContent).not.toContain('Escolha o espeto');
    expect(dialog.querySelectorAll('input[type="radio"]')).toHaveLength(2);

    [...dialog.querySelectorAll<HTMLElement>('.choice-option')]
      .find((item) => item.textContent?.includes('Tropeiro'))
      ?.querySelector<HTMLInputElement>('input')?.click();
    fixture.detectChanges();
    dialog.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();

    expect(emitted).toHaveBeenCalledWith({
      productId: 103,
      quantity: 1,
      notes: null,
      optionIds: [10301],
    });
  });

  it('uses current menu prices and all 19 skewer choices', () => {
    const products = saleMenuProducts();
    const byName = new Map(products.map((item) => [item.name, item]));

    expect(byName.get('Jantinha Completa')?.price).toBe(34.9);
    expect(byName.get('Carreteiro Completo')?.price).toBe(34.9);
    expect(byName.get('Jantinha Sem Espeto')?.price).toBe(22);
    expect(byName.get('Choripan')?.price).toBe(25);
    expect(byName.get('Picanha Montada')?.price).toBe(12.9);
    expect(byName.get('Refri Lata')?.price).toBe(7);
    expect(byName.get('Jantinha Completa')?.optionGroups[1].options).toHaveLength(19);
  });

  it('shows final size prices in the rendered sale dialog', () => {
    fixture = TestBed.createComponent(SaleProductPickerComponent);
    fixture.componentInstance.products = saleMenuProducts();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const productButton = [...root.querySelectorAll<HTMLButtonElement>('.counter-product')]
      .find((button) => button.querySelector('.counter-product-copy strong')?.textContent?.trim() === 'Arroz Branco');
    productButton?.click();
    fixture.detectChanges();

    const dialogText = (document.body.querySelector('.choice-dialog')?.textContent ?? '').replace(/\s/g, ' ');
    expect(dialogText).toContain('Média');
    expect(dialogText).toContain('R$ 10,00');
    expect(dialogText).toContain('Grande');
    expect(dialogText).toContain('R$ 18,00');
    expect(dialogText).not.toContain('Acréscimo R$ 8,00');
  });
});
