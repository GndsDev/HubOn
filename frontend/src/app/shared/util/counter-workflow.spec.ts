import { describe, expect, it } from 'vitest';
import { RestaurantOrder } from '../models/order.model';
import { Tab } from '../models/tab.model';
import { counterOrderKind, counterPrimaryAction } from './counter-workflow';

const tab = (remainingAmount: number): Tab => ({
  id: 104, type: 'COUNTER', tableId: null, tableNumber: null, tableName: null,
  customerName: null, customerPhone: null, identificationNote: null, displayLabel: 'Balcão #104',
  status: 'OPEN', openedByUserId: 1, openedByUserName: 'Operador', openedAt: '', closedAt: null,
  totalAmount: 20, serviceFee: 0, discountAmount: 0, finalAmount: 20,
  paidAmount: 20 - remainingAmount, remainingAmount,
});

const order = (status: RestaurantOrder['status']): RestaurantOrder => ({
  id: 1, tabId: 104, tabStatus: 'OPEN', tabType: 'COUNTER', tabDisplayLabel: 'Balcão #104',
  tableId: null, tableNumber: null, status, type: 'COUNTER', createdByUserId: 1,
  createdByUserName: 'Operador', notes: null, confirmedAt: '', cancellationReason: null,
  createdAt: '', updatedAt: '', items: [],
});

describe('counter workflow', () => {
  it('shows only payment while there is a remaining balance', () => {
    expect(counterPrimaryAction(tab(10), order('READY'))).toBe('PAY');
  });

  it('keeps a paid preparation order waiting for kitchen updates', () => {
    expect(counterPrimaryAction(tab(0), order('PREPARING'))).toBe('WAIT');
  });

  it('moves from delivery to finalization in order', () => {
    expect(counterPrimaryAction(tab(0), order('READY'))).toBe('DELIVER');
    expect(counterPrimaryAction(tab(0), order('DELIVERED'))).toBe('FINALIZE');
  });

  it('distinguishes direct, preparation and mixed sales', () => {
    expect(counterOrderKind([{ preparationFlow: 'DIRECT_SERVICE' }])).toBe('DIRECT');
    expect(counterOrderKind([{ preparationFlow: 'REQUIRES_PREPARATION' }])).toBe('PREPARATION');
    expect(counterOrderKind([{ preparationFlow: 'DIRECT_SERVICE' }, { preparationFlow: 'REQUIRES_PREPARATION' }])).toBe('MIXED');
  });
});
