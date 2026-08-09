import { describe, expect, it } from 'vitest';
import { Product, ProductOptionGroup } from '../models/product.model';
import { Sale, SaleItem } from '../models/sale.model';
import {
  activeOptionGroups,
  activeSaleItems,
  itemMatchesRequest,
  optionSelectionIsValid,
  productRequiresChoice,
  saleChoiceSummary,
  saleCanChangeItems,
  saleCanClose,
} from './sale-workflow';

const item: SaleItem = {
  id: 10,
  productId: 2,
  productName: 'Jantinha',
  categoryName: null,
  baseUnitPrice: 20,
  unitPrice: 22,
  quantity: 1,
  subtotal: 22,
  notes: null,
  options: [{ id: 1, productOptionId: 8, optionGroupName: 'Espeto', optionName: 'Coração', additionalPrice: 2 }],
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
    id: 1,
    type: 'TABLE',
    status: 'OPEN',
    tableNumber: 4,
    customerName: null,
    customerPhone: null,
    subtotal: 22,
    serviceFee: 0,
    discountAmount: 0,
    finalAmount: 22,
    paidAmount: 0,
    remainingAmount: 22,
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

const choiceGroup: ProductOptionGroup = {
  id: 3,
  productId: 2,
  name: 'Espeto',
  minimumSelections: 1,
  maximumSelections: 1,
  displayOrder: 0,
  active: true,
  options: [
    { id: 7, groupId: 3, name: 'Carne', additionalPrice: 0, displayOrder: 0, active: true, stockLink: null, createdAt: '', updatedAt: '' },
    { id: 8, groupId: 3, name: 'Coração', additionalPrice: 2, displayOrder: 1, active: true, stockLink: null, createdAt: '', updatedAt: '' },
  ],
  createdAt: '',
  updatedAt: '',
};

function product(optionGroups: ProductOptionGroup[] = []): Product {
  return { id: 2, categoryId: null, categoryName: null, name: 'Jantinha', description: null, price: 20, active: true, available: true, displayOrder: 0, optionGroups, createdAt: '', updatedAt: '' };
}

describe('sale workflow', () => {
  it('keeps uncategorized products valid and detects required choices', () => {
    expect(product().categoryId).toBeNull();
    expect(productRequiresChoice(product())).toBe(false);
    expect(productRequiresChoice(product([choiceGroup]))).toBe(true);
  });

  it('validates option limits and ignores inactive groups', () => {
    expect(optionSelectionIsValid([choiceGroup], [])).toBe(false);
    expect(optionSelectionIsValid([choiceGroup], [8])).toBe(true);
    expect(activeOptionGroups(product([{ ...choiceGroup, active: false }]))).toEqual([]);
  });

  it('keeps the configured order of active groups and choices', () => {
    const beanGroup = {
      ...choiceGroup,
      id: 4,
      name: 'Escolha o feijão',
      displayOrder: 0,
      options: [
        { ...choiceGroup.options[1], id: 10, groupId: 4, name: 'Feijão de caldo', displayOrder: 1 },
        { ...choiceGroup.options[0], id: 9, groupId: 4, name: 'Feijão tropeiro', displayOrder: 0 },
      ],
    };
    const skewerGroup = { ...choiceGroup, name: 'Escolha o espeto', displayOrder: 1 };

    const groups = activeOptionGroups(product([skewerGroup, beanGroup]));

    expect(groups.map((group) => group.name)).toEqual(['Escolha o feijão', 'Escolha o espeto']);
    expect(groups[0].options.map((option) => option.name)).toEqual(['Feijão tropeiro', 'Feijão de caldo']);
  });

  it('matches repeated items by product, options and notes', () => {
    expect(itemMatchesRequest(item, { productId: 2, quantity: 1, notes: null, optionIds: [8] })).toBe(true);
    expect(itemMatchesRequest(item, { productId: 2, quantity: 1, notes: null, optionIds: [7] })).toBe(false);
  });

  it('formats choices with operational question labels', () => {
    expect(saleChoiceSummary([
      { id: 1, productOptionId: 7, optionGroupName: 'Escolha o feijão', optionName: 'Feijão tropeiro', additionalPrice: 0 },
      { id: 2, productOptionId: 8, optionGroupName: 'Escolha o espeto', optionName: 'Picanha montada', additionalPrice: 0 },
    ])).toBe('Feijão: Tropeiro · Espeto: Picanha montada');
  });

  it('blocks item changes as soon as a payment exists', () => {
    expect(saleCanChangeItems(sale())).toBe(true);
    expect(saleCanChangeItems(sale({ payments: [{ id: 1, saleId: 1, method: 'PIX', amount: 10, paidAt: '', receivedByUserId: 1, receivedByUserName: 'Gerente' }] }))).toBe(false);
  });

  it('only closes non-empty fully settled sales and excludes cancelled items', () => {
    expect(saleCanClose(sale({ remainingAmount: 0 }))).toBe(true);
    expect(saleCanClose(sale({ items: [], finalAmount: 0, remainingAmount: 0 }))).toBe(false);
    expect(activeSaleItems(sale({ items: [{ ...item, cancelledAt: '2026-08-07T12:10:00' }] }))).toEqual([]);
  });
});
