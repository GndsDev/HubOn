import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackService } from '../../../core/services/feedback.service';
import { PaymentApiService } from '../../../core/services/payment-api.service';
import { PaymentOperation } from '../../models/payment.model';
import { PaymentDialogComponent } from './payment-dialog.component';

describe('PaymentDialogComponent', () => {
  const operation: PaymentOperation = {
    payment: {
      id: 1,
      tabId: 50,
      method: 'PIX',
      amount: 15,
      paidAt: '2026-07-31T10:00:00',
      receivedByUserId: 1,
      receivedByUserName: 'Operadora',
    },
    totalAmount: 30,
    paidAmount: 25,
    remainingAmount: 5,
    financialState: 'PARTIALLY_PAID',
    orders: [],
    nextAction: 'COMPLETE_PAYMENT',
  };
  const paymentApi = { create: vi.fn(() => of(operation)) };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  let fixture: ComponentFixture<PaymentDialogComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    paymentApi.create.mockReturnValue(of(operation));
    await TestBed.configureTestingModule({
      imports: [PaymentDialogComponent],
      providers: [
        { provide: PaymentApiService, useValue: paymentApi },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentDialogComponent);
    fixture.componentRef.setInput('tabId', 50);
    fixture.componentRef.setInput('originLabel', 'Balcão #50');
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

  it('starts with the remaining amount and describes a partial payment clearly', () => {
    const dialog = document.querySelector('.payment-dialog') as HTMLElement;

    expect(fixture.componentInstance.amount).toBe(20);
    expect(dialog.textContent).toContain('Completar pagamento');
    expect(dialog.textContent).toContain('Balcão #50');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.querySelector('[aria-label="Fechar pagamento"]')).not.toBeNull();
  });

  it('uses the centralized API and emits the complete operation result', () => {
    const completed = vi.fn();
    fixture.componentInstance.completed.subscribe(completed);
    fixture.componentInstance.method = 'PIX';
    fixture.componentInstance.amount = 15;

    fixture.componentInstance.submit();

    expect(paymentApi.create).toHaveBeenCalledWith({ tabId: 50, method: 'PIX', amount: 15 });
    expect(completed).toHaveBeenCalledWith(operation);
    expect(feedback.success).toHaveBeenCalledWith('Pagamento parcial registrado.');
  });

  it('blocks an amount above the remaining balance', () => {
    fixture.componentInstance.amount = 21;

    fixture.componentInstance.submit();

    expect(paymentApi.create).not.toHaveBeenCalled();
    expect(feedback.info).toHaveBeenCalledWith(expect.stringContaining('saldo restante'));
  });
});
