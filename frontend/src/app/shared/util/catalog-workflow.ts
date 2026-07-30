import { OrderItemStatus } from '../models/order.model';
import {
  PreparationFlow,
  Product,
  ProductOptionGroup,
  ProductOptionGroupRequest,
  ProductRequest,
  ProductVariant,
  ProductVariantRegistrationRequest,
} from '../models/product.model';

export function isCatalogProductSellable(product: Product): boolean {
  return product.active
    && product.available
    && product.categoryActive
    && product.complete
    && product.sellableVariantCount > 0;
}

export function sellableVariants(product: Product | undefined): ProductVariant[] {
  return product?.variants.filter((variant) => variant.active && variant.available) ?? [];
}

export function automaticVariantId(product: Product | undefined): number {
  const variants = sellableVariants(product);
  return variants.length === 1 ? variants[0].id : 0;
}

export function isDefaultVariant(name: string | null | undefined): boolean {
  return (name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'padrao';
}

export function operationalVariantLabel(name: string): string {
  return isDefaultVariant(name) ? 'Produto simples' : name;
}

export function priceRangeSummary(
  minimum: number | null,
  maximum: number | null,
  currency: (value: number) => string,
  withPrefix = false,
): string {
  if (minimum == null) return withPrefix ? 'sem preço' : 'Sem preço';
  if (maximum == null || minimum === maximum) return currency(minimum);
  const range = `${currency(minimum)} a ${currency(maximum)}`;
  return withPrefix ? `de ${range}` : range;
}

export function optionSelectionsAreValid(groups: ProductOptionGroup[], selectedIds: number[]): boolean {
  return groups.filter((group) => group.active).every((group) => {
    const ids = new Set(group.options.filter((option) => option.active).map((option) => option.id));
    const count = selectedIds.filter((id) => ids.has(id)).length;
    return count <= group.maximumSelections
      && (!group.required || count >= group.minimumSelections)
      && (count === 0 || count >= group.minimumSelections);
  });
}

export function preparationFlowLabel(flow: PreparationFlow): string {
  return flow === 'REQUIRES_PREPARATION' ? 'Requer preparo' : 'Entrega direta';
}

export function statusAfterConfirmation(flow: PreparationFlow): OrderItemStatus {
  return flow === 'DIRECT_SERVICE' ? 'READY' : 'WAITING_PREPARATION';
}

export function registrationStepIsValid(
  step: number,
  product: ProductRequest,
  variants: ProductVariantRegistrationRequest[],
  groups: ProductOptionGroupRequest[],
): boolean {
  if (step === 1) return Boolean(product.name.trim() && product.categoryId && product.preparationFlow);
  if (step === 2) {
    return variants.length > 0
      && variants.every((entry) => Boolean(entry.variant.name.trim()) && Number(entry.variant.price) >= 0);
  }
  if (step === 3) {
    const validLinks = variants.every((entry) => !entry.stockItemId || Boolean(entry.quantityPerSale && entry.quantityPerSale > 0));
    const validGroups = groups.every((group) => Boolean(group.name.trim())
      && group.maximumSelections >= group.minimumSelections
      && (!group.required || group.minimumSelections >= 1)
      && group.options.every((option) => Boolean(option.name.trim()) && option.additionalPrice >= 0));
    return validLinks && validGroups;
  }
  return false;
}
