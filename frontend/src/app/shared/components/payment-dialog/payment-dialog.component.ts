import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { FeedbackService } from '../../../core/services/feedback.service';
import { SalesApiService } from '../../../core/services/sales-api.service';
import { AccessibleDialogDirective } from '../../directives/accessible-dialog.directive';
import { PaymentMethod, Sale } from '../../models/sale.model';
import { apiErrorMessage } from '../../util/api-error';

@Component({
  selector: 'app-payment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, AccessibleDialogDirective],
  template: `
    <div class="modal-backdrop">
      <form class="modal-panel compact payment-dialog" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title" [dialogCloseDisabled]="saving()" (dialogClose)="close()" (ngSubmit)="submit()">
        <div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">{{ originLabel }}</span><h2 id="payment-dialog-title">Receber</h2></div><button type="button" class="icon-button" aria-label="Fechar pagamento" (click)="close()"><i class="pi pi-times"></i></button></div>
        <div class="modal-body payment-dialog-body">
          <div class="payment-total-card"><div><span>Total</span><strong>{{ currency(totalAmount) }}</strong></div><div><span>Pago</span><strong>{{ currency(paidAmount) }}</strong></div><div class="remaining"><span>Restante</span><strong>{{ currency(remainingAmount) }}</strong></div></div>
          <div class="payment-dialog-fields"><label class="field"><span>Forma</span><select name="paymentMethod" [(ngModel)]="method" autofocus>@for (option of methods; track option.value) { <option [ngValue]="option.value">{{ option.label }}</option> }</select></label><label class="field"><span>Valor</span><input name="paymentAmount" type="number" min="0.01" step="0.01" [max]="remainingAmount" [(ngModel)]="amount" required /></label></div>
        </div>
        <div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="close()">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving() || amount <= 0 || amount > remainingAmount"><i class="pi pi-wallet"></i>{{ saving() ? 'Registrando...' : 'Registrar pagamento' }}</button></div>
      </form>
    </div>
  `,
})
export class PaymentDialogComponent implements OnInit {
  private readonly api = inject(SalesApiService);
  private readonly feedback = inject(FeedbackService);
  @Input({ required: true }) saleId = 0;
  @Input({ required: true }) originLabel = '';
  @Input({ required: true }) totalAmount = 0;
  @Input({ required: true }) paidAmount = 0;
  @Input({ required: true }) remainingAmount = 0;
  @Output() readonly completed = new EventEmitter<Sale>();
  @Output() readonly dismissed = new EventEmitter<void>();
  readonly saving = signal(false);
  method: PaymentMethod = 'PIX';
  amount = 0;
  readonly methods: Array<{ value: PaymentMethod; label: string }> = [
    { value: 'PIX', label: 'PIX' }, { value: 'CASH', label: 'Dinheiro' },
    { value: 'DEBIT_CARD', label: 'Cartão de débito' }, { value: 'CREDIT_CARD', label: 'Cartão de crédito' },
    { value: 'VOUCHER', label: 'Voucher' },
  ];
  ngOnInit(): void { this.amount = this.remainingAmount; }
  submit(): void {
    if (this.saving() || this.amount <= 0 || this.amount > this.remainingAmount) { this.feedback.info('Informe um valor válido, sem ultrapassar o restante.'); return; }
    this.saving.set(true);
    this.api.pay(this.saleId, { method: this.method, amount: Number(this.amount) }).pipe(finalize(() => this.saving.set(false))).subscribe({ next: (sale) => { this.feedback.success(sale.remainingAmount > 0 ? 'Pagamento parcial registrado.' : 'Pagamento registrado.'); this.completed.emit(sale); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }
  close(): void { if (!this.saving()) this.dismissed.emit(); }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
}
