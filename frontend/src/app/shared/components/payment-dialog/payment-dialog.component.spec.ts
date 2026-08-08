import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackService } from '../../../core/services/feedback.service';
import { SalesApiService } from '../../../core/services/sales-api.service';
import { Sale } from '../../models/sale.model';
import { PaymentDialogComponent } from './payment-dialog.component';

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 50,
    type: 'COUNTER',
    status: 'OPEN',
    restaurantTableId: null,
    tableNumber: null,
    tableLabel: null,
    customerName: null,
    customerPhone: null,
    subtotal: 30,
    serviceFee: 0,
    discountAmount: 0,
    finalAmount: 30,
    paidAmount: 25,
    remainingAmount: 5,
    items: [],
    payments: [],
    openedByUserId: 1,
    openedByUserName: 'Operadora',
    openedAt: '',
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

describe('PaymentDialogComponent', () => {
  const partialSale = sale();
  const api = { pay: vi.fn(() => of(partialSale)) };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  let fixture: ComponentFixture<PaymentDialogComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    api.pay.mockReturnValue(of(partialSale));
    await TestBed.configureTestingModule({
      imports: [PaymentDialogComponent],
      providers: [
        { provide: SalesApiService, useValue: api },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentDialogComponent);
    fixture.componentRef.setInput('saleId', 50);
    fixture.componentRef.setInput('originLabel', 'Balcao #50');
    fixture.componentRef.setInput('totalAmount', 30);
    fixture.componentRef.setInput('paidAmount', 10);
    fixture.componentRef.setInput('remainingAmount', 20);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    document.getElementById('hubon-overlay-root')?.remove();
    document.body.classList.remove('hubon-overlay-open');
  });

  it('starts with the exact remaining amount and exposes an accessible dialog', () => {
    const dialog = document.querySelector('.payment-dialog') as HTMLElement;

    expect(fixture.componentInstance.amount).toBe(20);
    expect(dialog.textContent).toContain('Balcao #50');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.querySelector('[aria-label="Fechar pagamento"]')).not.toBeNull();
  });

  it('registers a partial Payment through the Sale endpoint and emits the updated Sale', () => {
    const completed = vi.fn();
    fixture.componentInstance.completed.subscribe(completed);
    fixture.componentInstance.method = 'PIX';
    fixture.componentInstance.amount = 15;

    fixture.componentInstance.submit();

    expect(api.pay).toHaveBeenCalledWith(50, { method: 'PIX', amount: 15 });
    expect(completed).toHaveBeenCalledWith(partialSale);
    expect(feedback.success).toHaveBeenCalledWith('Pagamento parcial registrado.');
  });

  it('reports a fully paid Sale without creating a separate payment operation model', () => {
    const closed = sale({ status: 'CLOSED', paidAmount: 30, remainingAmount: 0 });
    api.pay.mockReturnValueOnce(of(closed));
    const completed = vi.fn();
    fixture.componentInstance.completed.subscribe(completed);
    fixture.componentInstance.amount = 20;

    fixture.componentInstance.submit();

    expect(completed).toHaveBeenCalledWith(closed);
    expect(feedback.success).toHaveBeenCalledWith('Pagamento registrado.');
  });

  it('blocks zero and amounts above the remaining balance', () => {
    fixture.componentInstance.amount = 0;
    fixture.componentInstance.submit();
    fixture.componentInstance.amount = 21;
    fixture.componentInstance.submit();

    expect(api.pay).not.toHaveBeenCalled();
    expect(feedback.info).toHaveBeenCalledTimes(2);
  });

  it('keeps the dialog open and releases its loading state on API errors', () => {
    api.pay.mockReturnValueOnce(throwError(() => ({ error: { message: 'Falha controlada' } })));
    const completed = vi.fn();
    fixture.componentInstance.completed.subscribe(completed);
    fixture.componentInstance.amount = 10;

    fixture.componentInstance.submit();

    expect(completed).not.toHaveBeenCalled();
    expect(fixture.componentInstance.saving()).toBe(false);
    expect(feedback.error).toHaveBeenCalled();
  });
});
