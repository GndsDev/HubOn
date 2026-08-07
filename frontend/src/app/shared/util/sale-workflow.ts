import { Product, ProductOptionGroup } from '../models/product.model';
import { AddSaleItemRequest, Sale, SaleItem } from '../models/sale.model';

export function activeSaleItems(sale: Sale | null): SaleItem[] {
  return sale?.items.filter((item) => item.cancelledAt == null) ?? [];
}

export function saleCanChangeItems(sale: Sale | null): boolean {
  return sale?.status === 'OPEN' && sale.payments.length === 0;
}

export function saleCanClose(sale: Sale | null): boolean {
  return Boolean(sale?.status === 'OPEN' && activeSaleItems(sale).length > 0 && sale.remainingAmount === 0);
}

export function activeOptionGroups(product: Product): ProductOptionGroup[] {
  return product.optionGroups
    .filter((group) => group.active)
    .map((group) => ({ ...group, options: group.options.filter((option) => option.active) }))
    .filter((group) => group.options.length > 0)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'pt-BR'));
}

export function productRequiresChoice(product: Product): boolean {
  return activeOptionGroups(product).some((group) => group.minimumSelections > 0);
}

export function optionSelectionIsValid(groups: ProductOptionGroup[], selectedIds: number[]): boolean {
  return groups.every((group) => {
    const groupIds = new Set(group.options.map((option) => option.id));
    const count = selectedIds.filter((id) => groupIds.has(id)).length;
    return count >= group.minimumSelections && count <= group.maximumSelections;
  });
}

export function itemMatchesRequest(item: SaleItem, request: AddSaleItemRequest): boolean {
  const itemIds = item.options.map((option) => option.productOptionId).sort((a, b) => a - b);
  const requestIds = [...request.optionIds].sort((a, b) => a - b);
  return item.productId === request.productId
    && (item.notes ?? '') === (request.notes ?? '')
    && itemIds.length === requestIds.length
    && itemIds.every((id, index) => id === requestIds[index]);
}
