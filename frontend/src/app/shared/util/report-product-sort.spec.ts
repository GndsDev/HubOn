import { describe, expect, it } from 'vitest';
import { ReportProductPerformance } from '../models/monthly-report.model';
import {
  defaultReportSortDirection,
  parseReportProductSort,
  parseReportSortDirection,
  sortReportProducts,
} from './report-product-sort';

function product(
  productName: string,
  quantity: number,
  salesAmount: number,
  variants: ReportProductPerformance['variants'] = [],
): ReportProductPerformance {
  return { productName, categoryName: 'Categoria', quantity, salesAmount, revenueSharePercentage: 0, variants };
}

describe('report product sorting', () => {
  const products = [
    product('Água', 5, 100),
    product('Bolo', 8, 100),
    product('café', 2, 250),
    product('Açaí', 8, 100),
  ];

  it('sorts revenue descending with quantity and pt-BR name tie-breakers', () => {
    expect(sortReportProducts(products, 'REVENUE', 'DESC').map((item) => item.productName))
      .toEqual(['café', 'Açaí', 'Bolo', 'Água']);
  });

  it('sorts quantity descending with revenue and name tie-breakers', () => {
    expect(sortReportProducts(products, 'QUANTITY', 'DESC').map((item) => item.productName))
      .toEqual(['Açaí', 'Bolo', 'Água', 'café']);
  });

  it('sorts names in pt-BR without prioritizing letter case', () => {
    expect(sortReportProducts(products, 'NAME', 'ASC').map((item) => item.productName))
      .toEqual(['Açaí', 'Água', 'Bolo', 'café']);
  });

  it('inverts the selected primary criterion while preserving deterministic tie-breakers', () => {
    expect(sortReportProducts(products, 'REVENUE', 'ASC').map((item) => item.productName))
      .toEqual(['Açaí', 'Bolo', 'Água', 'café']);
    expect(sortReportProducts(products, 'NAME', 'DESC').map((item) => item.productName))
      .toEqual(['café', 'Bolo', 'Água', 'Açaí']);
  });

  it('sorts variants by revenue, quantity and name without mutating the source', () => {
    const source = product('Produto', 6, 100, [
      { variantName: 'Pequena', quantity: 2, salesAmount: 40 },
      { variantName: 'Grande', quantity: 1, salesAmount: 60 },
      { variantName: 'Especial', quantity: 2, salesAmount: 40 },
    ]);
    const sorted = sortReportProducts([source], 'REVENUE', 'DESC')[0];

    expect(sorted.variants.map((item) => item.variantName)).toEqual(['Grande', 'Especial', 'Pequena']);
    expect(source.variants.map((item) => item.variantName)).toEqual(['Pequena', 'Grande', 'Especial']);
  });

  it('defines and validates URL-safe defaults', () => {
    expect(defaultReportSortDirection('REVENUE')).toBe('DESC');
    expect(defaultReportSortDirection('QUANTITY')).toBe('DESC');
    expect(defaultReportSortDirection('NAME')).toBe('ASC');
    expect(parseReportProductSort('NAME')).toBe('NAME');
    expect(parseReportProductSort('INVALID')).toBeNull();
    expect(parseReportSortDirection('ASC')).toBe('ASC');
    expect(parseReportSortDirection('DOWN')).toBeNull();
  });
});
