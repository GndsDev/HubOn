import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CashApiService } from '../../core/services/cash-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { SalesApiService } from '../../core/services/sales-api.service';
import { CashShift } from '../../shared/models/cash.model';
import { Sale } from '../../shared/models/sale.model';
import { CashierPageComponent } from './cashier-page.component';

const openShift: CashShift = {
  id: 7,
  status: 'OPEN',
  openedByUserId: 1,
  openedByUserName: 'Operadora',
  openedAt: '2026-08-07T09:00:00',
  openingBalance: 100,
  closedByUserId: null,
  closedByUserName: null,
  closedAt: null,
  receivedTotal: 75,
  receivedByMethod: { CASH: 25, PIX: 20, DEBIT_CARD: 10, CREDIT_CARD: 15, VOUCHER: 5 },
  cancellationAmount: 0,
  supplyAmount: 20,
  withdrawalAmount: 5,
  expectedCash: 140,
  countedCash: null,
  differenceAmount: null,
  closingNote: null,
  movements: [{
    id: 'movement-1',
    type: 'PAYMENT',
    origin: 'Balcao #104',
    amount: 25,
    method: 'CASH',
    responsible: 'Operadora',
    reference: 'Pagamento #35',
    observation: null,
    occurredAt: '2026-08-07T10:30:00',
  }],
};

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 104,
    type: 'COUNTER',
    status: 'OPEN',
    tableNumber: null,
    customerName: 'Ana',
    customerPhone: null,
    subtotal: 50,
    serviceFee: 0,
    discountAmount: 0,
    finalAmount: 50,
    paidAmount: 20,
    remainingAmount: 30,
    items: [],
    payments: [],
    openedByUserId: 1,
    openedByUserName: 'Operadora',
    openedAt: '2026-08-07T10:00:00',
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

describe('CashierPageComponent', () => {
  const cashApi = {
    getCurrent: vi.fn(() => of<CashShift | null>(openShift)),
    getHistory: vi.fn(() => of<CashShift[]>([])),
    open: vi.fn(() => of(openShift)),
    addMovement: vi.fn(() => of(openShift)),
    close: vi.fn(() => of({ ...openShift, status: 'CLOSED' as const })),
  };
  const salesApi = { list: vi.fn(() => of([sale()])) };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    cashApi.getCurrent.mockReturnValue(of(openShift));
    cashApi.getHistory.mockReturnValue(of([]));
    cashApi.open.mockReturnValue(of(openShift));
    cashApi.addMovement.mockReturnValue(of(openShift));
    cashApi.close.mockReturnValue(of({ ...openShift, status: 'CLOSED' }));
    salesApi.list.mockReturnValue(of([sale()]));

    await TestBed.configureTestingModule({
      imports: [CashierPageComponent],
      providers: [
        provideRouter([]),
        { provide: CashApiService, useValue: cashApi },
        { provide: SalesApiService, useValue: salesApi },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
  });

  function component(): CashierPageComponent {
    return TestBed.createComponent(CashierPageComponent).componentInstance;
  }

  it('loads the current shift, closed history and pending Sales', () => {
    const closed = { ...openShift, id: 6, status: 'CLOSED' as const, closedAt: '2026-08-06T18:00:00' };
    cashApi.getHistory.mockReturnValueOnce(of([openShift, closed]));
    const instance = component();

    instance.load();

    expect(salesApi.list).toHaveBeenCalledWith('OPEN');
    expect(instance.currentShift()).toEqual(openShift);
    expect(instance.history()).toEqual([closed]);
    expect(instance.pendingSales()).toEqual([sale()]);
    expect(instance.saleLabel(sale({ type: 'TABLE', tableNumber: 4 }))).toBe('Mesa 4');
  });

  it('opens the cash shift with its initial balance', () => {
    const instance = component();
    instance.openingBalance = 80;

    instance.openShift();

    expect(cashApi.open).toHaveBeenCalledWith({ openingBalance: 80 });
    expect(feedback.success).toHaveBeenCalled();
  });

  it('records supply and withdrawal movements on the current shift', () => {
    const instance = component();
    instance.currentShift.set(openShift);

    instance.movementForm = { type: 'SUPPLY', amount: 40, note: '  Troco adicional  ' };
    instance.saveMovement();
    expect(cashApi.addMovement).toHaveBeenCalledWith(7, { type: 'SUPPLY', amount: 40, note: 'Troco adicional' });

    instance.movementForm = { type: 'WITHDRAWAL', amount: 15, note: 'Pagamento local' };
    instance.saveMovement();
    expect(cashApi.addMovement).toHaveBeenCalledWith(7, { type: 'WITHDRAWAL', amount: 15, note: 'Pagamento local' });
  });

  it('prepares reconciliation using expected cash and closes without a note when balanced', () => {
    const instance = component();
    instance.currentShift.set(openShift);

    instance.openClose(openShift);
    expect(instance.closeForm.countedCash).toBe(140);
    expect(instance.closeDifference(openShift)).toBe(0);
    instance.closeShift(openShift);

    expect(cashApi.close).toHaveBeenCalledWith(7, { countedCash: 140, note: null });
  });

  it('requires an explanation for a cash difference before closing', () => {
    const instance = component();
    instance.currentShift.set(openShift);
    instance.closeForm = { countedCash: 130, note: '' };

    instance.closeShift(openShift);
    expect(cashApi.close).not.toHaveBeenCalled();

    instance.closeForm.note = 'Diferenca conferida';
    instance.closeShift(openShift);
    expect(cashApi.close).toHaveBeenCalledWith(7, { countedCash: 130, note: 'Diferenca conferida' });
  });

  it('keeps the current shift visible when a movement fails', () => {
    cashApi.addMovement.mockReturnValueOnce(throwError(() => ({ error: { message: 'Falha controlada' } })));
    const instance = component();
    instance.currentShift.set(openShift);
    instance.movementOpen.set(true);
    instance.movementForm = { type: 'SUPPLY', amount: 20, note: 'Troco' };

    instance.saveMovement();

    expect(instance.currentShift()).toBe(openShift);
    expect(instance.movementOpen()).toBe(true);
    expect(feedback.error).toHaveBeenCalled();
  });

  it('reports load errors without inventing Tab or Order state', () => {
    cashApi.getCurrent.mockReturnValueOnce(throwError(() => ({ error: { message: 'Caixa indisponivel' } })));
    const instance = component();

    instance.load();

    expect(instance.error()).toBeTruthy();
    expect(instance.loading()).toBe(false);
  });
});
