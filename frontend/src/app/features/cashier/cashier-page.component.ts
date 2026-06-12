import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { OperatorContextService } from '../../core/services/operator-context.service';
import { PaymentApiService } from '../../core/services/payment-api.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { PaymentMethod, PaymentSummary } from '../../shared/models/payment.model';
import { Tab } from '../../shared/models/tab.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';

@Component({
  selector: 'app-cashier-page',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, PageHeaderComponent, SectionCardComponent],
  template: `
    <app-page-header kicker="Financeiro" title="Caixa" description="Registre pagamentos reais e feche comandas quando o saldo estiver quitado.">
      <button type="button" class="ghost-button" (click)="feedback.info()"><i class="pi pi-print"></i>Imprimir parcial</button>
    </app-page-header>

    @if (loading()) {
      <div class="cashier-layout"><div class="premium-card loading-card"></div><div class="premium-card loading-card"></div></div>
    } @else if (error()) {
      <div class="error-panel"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar</strong><p>{{ error() }}</p></div>
        <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button>
      </div>
    } @else if (tabs().length === 0) {
      <app-empty-state icon="pi pi-wallet" title="Nenhuma comanda no caixa" description="Abra uma comanda e registre pedidos antes de receber pagamentos." />
    } @else {
      <div class="cashier-selector">
        <label class="field"><span>Comanda aberta</span>
          <select [(ngModel)]="selectedTabId" (ngModelChange)="selectTab($event)">
            @for (tab of tabs(); track tab.id) { <option [ngValue]="tab.id">#{{ tab.id }} · Mesa {{ tab.tableNumber }} · {{ currency(tab.finalAmount) }}</option> }
          </select>
        </label>
      </div>

      @if (selectedTab(); as tab) {
        <section class="cashier-layout">
          <app-section-card eyebrow="Comanda selecionada" [title]="'#' + tab.id + ' · Mesa ' + tab.tableNumber">
            <div class="cashier-summary">
              <div><span>Responsável</span><strong>{{ tab.openedByUserName }}</strong></div>
              <div><span>Itens</span><strong>{{ currency(tab.totalAmount) }}</strong></div>
              <div><span>Serviço</span><strong>{{ currency(tab.serviceFee) }}</strong></div>
              <div><span>Desconto</span><strong>{{ currency(tab.discountAmount) }}</strong></div>
            </div>
            <div class="payment-history">
              <h3>Pagamentos registrados</h3>
              @for (payment of summary()?.payments || []; track payment.id) {
                <div><span>{{ methodLabel(payment.method) }} · {{ payment.receivedByUserName }}</span><strong>{{ currency(payment.amount) }}</strong></div>
              } @empty { <p>Nenhum pagamento registrado.</p> }
            </div>
          </app-section-card>

          <app-section-card eyebrow="Pagamento" title="Resumo financeiro">
            <div class="payment-total-card">
              <div><span>Total</span><strong>{{ currency(summary()?.totalAmount ?? tab.finalAmount) }}</strong></div>
              <div><span>Pago</span><strong>{{ currency(summary()?.paidAmount ?? 0) }}</strong></div>
              <div class="remaining"><span>Restante</span><strong>{{ currency(summary()?.remainingAmount ?? tab.remainingAmount) }}</strong></div>
            </div>
            <form class="payment-form" (ngSubmit)="pay()">
              <label class="field"><span>Forma de pagamento</span>
                <select name="method" [(ngModel)]="paymentForm.method">
                  @for (method of methods; track method.value) { <option [value]="method.value">{{ method.label }}</option> }
                </select>
              </label>
              <label class="field"><span>Valor</span><input name="amount" type="number" min="0.01" step="0.01" [(ngModel)]="paymentForm.amount" /></label>
              <button
                type="submit"
                class="primary-button finish-payment"
                [disabled]="saving() || paymentForm.amount <= 0 || paymentForm.amount > remainingAmount(tab)"
              >
                <i class="pi pi-wallet"></i>{{ saving() ? 'Registrando...' : 'Registrar pagamento' }}
              </button>
            </form>
            <button type="button" class="ghost-button finish-payment" [disabled]="remainingAmount(tab) > 0" (click)="closeTab(tab)">
              <i class="pi pi-check-circle"></i>Fechar comanda
            </button>
          </app-section-card>
        </section>
      }
    }
  `,
})
export class CashierPageComponent implements OnInit {
  private readonly tabApi = inject(TabApiService);
  private readonly paymentApi = inject(PaymentApiService);
  private readonly operatorContext = inject(OperatorContextService);
  readonly feedback = inject(FeedbackService);

  readonly tabs = signal<Tab[]>([]);
  readonly selectedTab = signal<Tab | null>(null);
  readonly summary = signal<PaymentSummary | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly methods: Array<{ value: PaymentMethod; label: string }> = [
    { value: 'PIX', label: 'Pix' }, { value: 'CREDIT_CARD', label: 'Cartão de crédito' },
    { value: 'DEBIT_CARD', label: 'Cartão de débito' }, { value: 'CASH', label: 'Dinheiro' },
    { value: 'VOUCHER', label: 'Vale' },
  ];
  selectedTabId = 0;
  paymentForm: { method: PaymentMethod; amount: number } = { method: 'PIX', amount: 0 };

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tabApi.getOpen().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (tabs) => {
        this.tabs.set(tabs);
        if (tabs.length) this.selectTab(tabs.some((tab) => tab.id === this.selectedTabId) ? this.selectedTabId : tabs[0].id);
      },
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }
  selectTab(id: number): void {
    this.selectedTabId = id;
    const tab = this.tabs().find((item) => item.id === id) || null;
    this.selectedTab.set(tab);
    if (tab) this.loadSummary(tab.id);
  }
  loadSummary(tabId: number): void {
    this.paymentApi.getByTab(tabId).subscribe({
      next: (summary) => { this.summary.set(summary); this.paymentForm.amount = summary.remainingAmount; },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }
  pay(): void {
    const tab = this.selectedTab();
    const operator = this.operatorContext.selectedOperator();
    if (!operator) {
      this.feedback.error('Selecione um operador ativo na barra superior antes de registrar o pagamento.');
      return;
    }
    if (!tab || this.paymentForm.amount <= 0) { this.feedback.error('Informe um valor de pagamento maior que zero.'); return; }
    if (this.paymentForm.amount > this.remainingAmount(tab)) {
      this.feedback.error('O pagamento não pode ultrapassar o saldo restante.');
      return;
    }
    this.saving.set(true);
    this.paymentApi.create({ tabId: tab.id, receivedByUserId: operator.id, ...this.paymentForm })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => { this.feedback.success('Pagamento registrado com sucesso.'); this.loadSummary(tab.id); this.tabApi.getById(tab.id).subscribe((updated) => this.selectedTab.set(updated)); },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }
  closeTab(tab: Tab): void {
    this.tabApi.close(tab.id).subscribe({
      next: () => { this.feedback.success('Comanda fechada com sucesso.'); this.summary.set(null); this.selectedTab.set(null); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }
  remainingAmount(tab: Tab): number { return this.summary()?.remainingAmount ?? tab.remainingAmount; }
  methodLabel(method: PaymentMethod): string { return this.methods.find((item) => item.value === method)?.label || method; }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
}
