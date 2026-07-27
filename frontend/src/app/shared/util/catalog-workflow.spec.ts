import { describe, expect, it } from 'vitest';
import { Product, ProductOptionGroup, ProductRequest, ProductVariant } from '../models/product.model';
import {
  automaticVariantId,
  isCatalogProductSellable,
  isDefaultVariant,
  operationalVariantLabel,
  optionSelectionsAreValid,
  preparationFlowLabel,
  priceRangeSummary,
  registrationStepIsValid,
  sellableVariants,
  statusAfterConfirmation,
} from './catalog-workflow';

const productRequest: ProductRequest = {
  categoryId: 1,
  name: 'Coca-Cola',
  description: null,
  preparationFlow: 'DIRECT_SERVICE',
  active: true,
  available: true,
  displayOrder: 0,
  imageUrl: null,
};

function variant(id: number, name: string, price: number, available = true): ProductVariant {
  return {
    id,
    productId: 1,
    productName: 'Coca-Cola',
    name,
    sku: null,
    price,
    active: true,
    available,
    displayOrder: 0,
    stockLinkActive: false,
    stockLinkId: null,
    stockItemId: null,
    stockItemName: null,
    quantityPerSale: null,
    createdAt: '',
    updatedAt: '',
  };
}

function product(variants: ProductVariant[], overrides: Partial<Product> = {}): Product {
  const sellableCount = variants.filter((item) => item.active && item.available).length;
  return {
    id: 1,
    categoryId: 1,
    categoryName: 'Bebidas',
    categoryActive: true,
    name: 'Coca-Cola',
    description: null,
    preparationFlow: 'DIRECT_SERVICE',
    active: true,
    available: true,
    displayOrder: 0,
    imageUrl: null,
    variantCount: variants.length,
    activeVariantCount: variants.length,
    sellableVariantCount: sellableCount,
    minimumVariantPrice: variants.length ? Math.min(...variants.map((item) => item.price)) : null,
    maximumVariantPrice: variants.length ? Math.max(...variants.map((item) => item.price)) : null,
    hasAutomaticStockLink: false,
    complete: variants.length > 0,
    variants,
    optionGroups: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('catalog workflow', () => {
  it('validates the three product assistant steps without a base price field', () => {
    const variants = [{ variant: { name: 'Padrao', sku: null, price: 5, active: true, available: true, displayOrder: 0 }, stockItemId: null, quantityPerSale: null }];
    expect('price' in productRequest).toBe(false);
    expect(registrationStepIsValid(1, productRequest, variants, [])).toBe(true);
    expect(registrationStepIsValid(2, productRequest, variants, [])).toBe(true);
    expect(registrationStepIsValid(3, productRequest, variants, [])).toBe(true);
    expect(registrationStepIsValid(2, productRequest, [], [])).toBe(false);
  });

  it('suppresses the default variant label but preserves real variation names', () => {
    expect(isDefaultVariant('Padrão')).toBe(true);
    expect(isDefaultVariant('Padrao')).toBe(true);
    expect(operationalVariantLabel('Padrão')).toBe('Produto simples');
    expect(operationalVariantLabel('600 mL')).toBe('600 mL');
  });

  it('automatically selects one sellable variant and requires a choice for multiple variants', () => {
    const single = product([variant(10, 'Padrao', 5)]);
    const multiple = product([variant(10, 'Lata', 5), variant(11, '2 L', 12)]);
    expect(automaticVariantId(single)).toBe(10);
    expect(automaticVariantId(multiple)).toBe(0);
    expect(sellableVariants(product([variant(10, 'Lata', 5, false), variant(11, '2 L', 12)])).map((item) => item.id)).toEqual([11]);
  });

  it('formats one price and a price range', () => {
    const currency = (value: number) => `R$ ${value.toFixed(2)}`;
    expect(priceRangeSummary(5, 5, currency)).toBe('R$ 5.00');
    expect(priceRangeSummary(5, 12, currency)).toBe('R$ 5.00 a R$ 12.00');
    expect(priceRangeSummary(5, 12, currency, true)).toBe('de R$ 5.00 a R$ 12.00');
  });

  it('excludes unavailable or incomplete products from order selection', () => {
    const complete = product([variant(1, 'Padrao', 5)]);
    expect(isCatalogProductSellable(complete)).toBe(true);
    expect(isCatalogProductSellable({ ...complete, available: false })).toBe(false);
    expect(isCatalogProductSellable({ ...complete, sellableVariantCount: 0 })).toBe(false);
    expect(isCatalogProductSellable({ ...complete, complete: false })).toBe(false);
  });

  it('enforces required option choices and min/max selection limits', () => {
    const group = {
      id: 1,
      productId: 1,
      name: 'Espeto',
      required: true,
      minimumSelections: 1,
      maximumSelections: 1,
      displayOrder: 0,
      active: true,
      options: [
        { id: 10, groupId: 1, name: 'Carne', additionalPrice: 0, displayOrder: 0, active: true, createdAt: '', updatedAt: '' },
        { id: 11, groupId: 1, name: 'Frango', additionalPrice: 0, displayOrder: 1, active: true, createdAt: '', updatedAt: '' },
      ],
      createdAt: '',
      updatedAt: '',
    } satisfies ProductOptionGroup;
    expect(optionSelectionsAreValid([group], [])).toBe(false);
    expect(optionSelectionsAreValid([group], [10])).toBe(true);
    expect(optionSelectionsAreValid([group], [10, 11])).toBe(false);
  });

  it('maps direct service and preparation flows to their operational states', () => {
    expect(preparationFlowLabel('DIRECT_SERVICE')).toBe('Entrega direta');
    expect(statusAfterConfirmation('DIRECT_SERVICE')).toBe('READY');
    expect(preparationFlowLabel('REQUIRES_PREPARATION')).toBe('Requer preparo');
    expect(statusAfterConfirmation('REQUIRES_PREPARATION')).toBe('WAITING_PREPARATION');
  });
});
