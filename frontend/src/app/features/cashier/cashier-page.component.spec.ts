import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CashApiService } from '../../core/services/cash-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { CashShift } from '../../shared/models/cash.model';
import { Tab } from '../../shared/models/tab.model';
import { CashierPageComponent } from './cashier-page.component';

describe('CashierPageComponent', () => {
  const openShift: CashShift = {
    id: 7,
    status: 'OPEN',
    openedByUserId: 1,
    openedByUserName: 'Operadora',
    openedAt: '2026-07-31T09:00:00',
    openingBalance: 100,
    closedByUserId: null,
    closedByUserName: null,
    closedAt: null,
    receivedTotal: 75,
    receivedByMethod: { CASH: 25, PIX: 20, DEBIT_CARD: 10, CREDIT_CARD: 15, VOUCHER: 5 },
    cancellationAmount: 0,
    refundAmount: 0,
    supplyAmount: 20,
    withdrawalAmount: 5,
    expectedCash: 140,
    countedCash: null,
    differenceAmount: null,
    closingNote: null,
    movements: [{
      id: 'movement-1',
      type: 'PAYMENT',
      origin: 'Balcão #104',
      amount: 25,
      method: 'CASH',
      responsible: 'Operadora',
      reference: 'Pagamento #35',
      observation: null,
      occurredAt: '2026-07-31T10:30:00',
    }],
  };

  const pendingCounter: Tab = {
    id: 104,
    type: 'COUNTER',
    tableId: null,
    tableNumber: null,
    tableName: null,
    customerName: 'Ana',
    customerPhone: null,
    identificationNote: null,
    displayLabel: 'Balcão #104 - Ana',
    status: 'OPEN',
    openedByUserId: 1,
    openedByUserName: 'Operadora',
    openedAt: '2026-07-31T10:00:00',
    closedAt: null,
    totalAmount: 50,
    serviceFee: 0,
    discountAmount: 0,
    finalAmount: 50,
    paidAmount: 20,
    remainingAmount: 30,
  };

  const cashApi = {
    getCurrent: vi.fn(() => of<CashShift | null>(openShift)),
    getHistory: vi.fn(() => of<CashShift[]>([])),
    open: vi.fn(() => of(openShift)),
    addMovement: vi.fn(() => of(openShift)),
    close: vi.fn(() => of({ ...openShift, status: 'CLOSED' as const })),
  };
  const tabApi = { getOpen: vi.fn(() => of([pendingCounter])) };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  let fixture: ComponentFixture<CashierPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    cashApi.getCurrent.mockReturnValue(of(openShift));
    cashApi.getHistory.mockReturnValue(of([]));
    cashApi.open.mockReturnValue(of(openShift));
    cashApi.addMovement.mockReturnValue(of(openShift));
    tabApi.getOpen.mockReturnValue(of([pendingCounter]));
    await TestBed.configureTestingModule({
      imports: [CashierPageComponent],
      providers: [
        provideRouter([]),
        { provide: CashApiService, useValue: cashApi },
        { provide: TabApiService, useValue: tabApi },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    document.body.classList.remove('hubon-overlay-open');
  });

  function createFixture(): ComponentFixture<CashierPageComponent> {
    fixture = TestBed.createComponent(CashierPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows shift totals, movements and links to pending operations without a payment form', () => {
    const current = createFixture();
    const text = current.nativeElement.textContent as string;

    expect(text).toContain('Turno aberto');
    expect(text).toContain('Movimentações do turno');
    expect(text).toContain('Balcão #104');
    expect(text).toContain('Abrir atendimento');
    expect(text).not.toContain('Registrar pagamento');
    expect(current.nativeElement.querySelector('app-payment-dialog')).toBeNull();
  });

  it('records supplies and withdrawals as financial movements of the current shift', () => {
    const component = createFixture().componentInstance;
    component.openMovement('SUPPLY');
    component.movementForm = { type: 'SUPPLY', amount: 40, note: 'Troco adicional' };

    component.saveMovement();

    expect(cashApi.addMovement).toHaveBeenCalledWith(7, {
      type: 'SUPPLY',
      amount: 40,
      note: 'Troco adicional',
    });
    expect(component.movementOpen()).toBe(false);
    expect(feedback.success).toHaveBeenCalledWith('Movimentação registrada.');
  });

  it('offers shift opening when there is no current shift', () => {
    cashApi.getCurrent.mockReturnValue(of(null));
    const current = createFixture();

    expect(current.nativeElement.textContent).toContain('Caixa fechado');
    current.componentInstance.openingBalance = 80;
    current.componentInstance.openShift();

    expect(cashApi.open).toHaveBeenCalledWith({ openingBalance: 80 });
  });
});
