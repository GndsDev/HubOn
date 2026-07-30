import { RestaurantOrder } from '../models/order.model';
import { Tab } from '../models/tab.model';

export type CounterPrimaryAction = 'PAY' | 'WAIT' | 'DELIVER' | 'FINALIZE';

export function counterPrimaryAction(tab: Tab, order: RestaurantOrder): CounterPrimaryAction {
  if (tab.remainingAmount > 0) return 'PAY';
  if (order.status === 'READY') return 'DELIVER';
  if (order.status === 'DELIVERED') return 'FINALIZE';
  return 'WAIT';
}

export function counterOrderKind(items: Pick<RestaurantOrder['items'][number], 'preparationFlow'>[]): 'DIRECT' | 'PREPARATION' | 'MIXED' {
  const hasDirect = items.some((item) => item.preparationFlow === 'DIRECT_SERVICE');
  const hasPreparation = items.some((item) => item.preparationFlow === 'REQUIRES_PREPARATION');
  return hasDirect && hasPreparation ? 'MIXED' : hasPreparation ? 'PREPARATION' : 'DIRECT';
}
