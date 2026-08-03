import { ReportProductPerformance, ReportVariantPerformance } from '../models/monthly-report.model';

export type ReportProductSort = 'REVENUE' | 'QUANTITY' | 'NAME';
export type ReportSortDirection = 'ASC' | 'DESC';

export const REPORT_PRODUCT_SORTS: readonly ReportProductSort[] = ['REVENUE', 'QUANTITY', 'NAME'];
export const REPORT_SORT_DIRECTIONS: readonly ReportSortDirection[] = ['ASC', 'DESC'];

export function defaultReportSortDirection(sort: ReportProductSort): ReportSortDirection {
  return sort === 'NAME' ? 'ASC' : 'DESC';
}

export function parseReportProductSort(value: string | null): ReportProductSort | null {
  return REPORT_PRODUCT_SORTS.includes(value as ReportProductSort) ? value as ReportProductSort : null;
}

export function parseReportSortDirection(value: string | null): ReportSortDirection | null {
  return REPORT_SORT_DIRECTIONS.includes(value as ReportSortDirection) ? value as ReportSortDirection : null;
}

export function sortReportProducts(
  products: readonly ReportProductPerformance[],
  sort: ReportProductSort,
  direction: ReportSortDirection,
): ReportProductPerformance[] {
  return products
    .map((product) => ({ ...product, variants: sortReportVariants(product.variants) }))
    .sort((left, right) => compareProducts(left, right, sort, direction));
}

export function sortReportVariants(variants: readonly ReportVariantPerformance[]): ReportVariantPerformance[] {
  return [...variants].sort((left, right) => (
    descendingNumber(left.salesAmount, right.salesAmount)
    || descendingNumber(left.quantity, right.quantity)
    || comparePtBr(left.variantName, right.variantName)
  ));
}

function compareProducts(
  left: ReportProductPerformance,
  right: ReportProductPerformance,
  sort: ReportProductSort,
  direction: ReportSortDirection,
): number {
  if (sort === 'REVENUE') {
    return directionalNumber(left.salesAmount, right.salesAmount, direction)
      || descendingNumber(left.quantity, right.quantity)
      || comparePtBr(left.productName, right.productName)
      || comparePtBr(left.categoryName, right.categoryName);
  }

  if (sort === 'QUANTITY') {
    return directionalNumber(left.quantity, right.quantity, direction)
      || descendingNumber(left.salesAmount, right.salesAmount)
      || comparePtBr(left.productName, right.productName)
      || comparePtBr(left.categoryName, right.categoryName);
  }

  return directionalText(left.productName, right.productName, direction)
    || descendingNumber(left.salesAmount, right.salesAmount)
    || descendingNumber(left.quantity, right.quantity)
    || comparePtBr(left.categoryName, right.categoryName);
}

function directionalNumber(left: number, right: number, direction: ReportSortDirection): number {
  return direction === 'ASC' ? numeric(left) - numeric(right) : numeric(right) - numeric(left);
}

function descendingNumber(left: number, right: number): number {
  return numeric(right) - numeric(left);
}

function directionalText(left: string, right: string, direction: ReportSortDirection): number {
  return direction === 'ASC' ? comparePtBr(left, right) : comparePtBr(right, left);
}

function comparePtBr(left: string, right: string): number {
  return left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })
    || left.localeCompare(right, 'pt-BR');
}

function numeric(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
