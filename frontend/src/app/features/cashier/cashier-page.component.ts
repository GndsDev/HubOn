import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { PaymentApiService } from '../../core/services/payment-api.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { PaymentMethod, PaymentSummary } from '../../shared/models/payment.model';
import { RestaurantOrder } from '../../shared/models/order.model';
import { CounterSaleSummary, Tab } from '../../shared/models/tab.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';

@Component({
  selector: 'app-cashier-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, EmptyStateComponent, PageHeaderComponent, SectionCardComponent],
  template: `
    <app-page-header kicker="Financeiro" title="Caixa" description="Separe o pagamento do preparo, da entrega e do fechamento da venda." />

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
            @for (tab of tabs(); track tab.id) { <option [ngValue]="tab.id">#{{ tab.id }} · {{ tab.displayLabel }} · {{ cashierStateLabel(tab) }} · {{ currency(tab.finalAmount) }}</option> }
          </select>
        </label>
      </div>

      @if (selectedTab(); as tab) {
        <section class="cashier-layout">
          <app-section-card eyebrow="Comanda selecionada" [title]="'#' + tab.id + ' · ' + tab.displayLabel">
            @if (counterSummary(tab); as sale) {
              <div class="cashier-operational-state">
                <span><small>Preparo</small><strong>{{ preparationLabel(sale) }}</strong></span>
                <span><small>Atendimento</small><strong>{{ attendanceLabel(sale) }}</strong></span>
                <a class="ghost-button" [routerLink]="['/balcao', tab.id]"><i class="pi pi-arrow-right"></i>Abrir atendimento no Balcão</a>
              </div>
            }
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
            @if (remainingAmount(tab) > 0) {
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
            } @else if (canClose(tab)) {
              <button type="button" class="primary-button finish-payment" (click)="closeTab(tab)" [disabled]="saving()">
                <i class="pi pi-check-circle"></i>{{ tab.type === 'COUNTER' ? 'Finalizar venda' : 'Fechar comanda' }}
              </button>
            } @else {
              <div class="info-panel compact-info"><i class="pi pi-clock"></i><div><strong>Pagamento concluído</strong><p>{{ closeBlockReason(tab) }}</p></div></div>
              <div class="cashier-context-links">
                @if (tab.type === 'COUNTER') { <a class="primary-button" [routerLink]="['/balcao', tab.id]"><i class="pi pi-arrow-right"></i>Continuar no Balcão</a> }
                <a class="ghost-button" routerLink="/pedidos"><i class="pi pi-receipt"></i>Ver pedido</a>
              </div>
            }
          </app-section-card>
        </section>
      }
      @if (finishedCounterToday().length > 0) { <p class="cashier-finished-note"><i class="pi pi-check-circle"></i>{{ finishedCounterToday().length }} venda{{ finishedCounterToday().length === 1 ? '' : 's' }} de balcão finalizada{{ finishedCounterToday().length === 1 ? '' : 's' }} hoje.</p> }
    }
  `,
})
export class CashierPageComponent implements OnInit {
  private readonly tabApi = inject(TabApiService);
  private readonly paymentApi = inject(PaymentApiService);
  private readonly orderApi = inject(OrderApiService);
  private readonly auth = inject(AuthService);
  readonly feedback = inject(FeedbackService);

  readonly tabs = signal<Tab[]>([]);
  readonly orders = signal<RestaurantOrder[]>([]);
  readonly counterSales = signal<CounterSaleSummary[]>([]);
  readonly finishedCounterToday = signal<CounterSaleSummary[]>([]);
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
    forkJoin({
      tabs: this.tabApi.getOpen(),
      orders: this.orderApi.getAll(),
      counterSales: this.tabApi.getActiveCounterSales(),
      finishedCounterToday: this.tabApi.getCounterSalesFinishedToday(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ tabs, orders, counterSales, finishedCounterToday }) => {
        this.tabs.set(tabs);
        this.orders.set(orders);
        this.counterSales.set(counterSales);
        this.finishedCounterToday.set(finishedCounterToday);
        if (tabs.length) this.selectTab(tabs.some((tab) => tab.id === this.selectedTabId) ? this.selectedTabId : tabs[0].id);
      },
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }
  selectTab(id: number): void {
    this.selectedTabId = id;
    this.summary.set(null);
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
    if (!this.auth.currentUser()) {
      this.feedback.error('Faça login antes de registrar o pagamento.');
      return;
    }
    if (!tab || this.paymentForm.amount <= 0) { this.feedback.error('Informe um valor de pagamento maior que zero.'); return; }
    if (this.paymentForm.amount > this.remainingAmount(tab)) {
      this.feedback.error('O pagamento não pode ultrapassar o saldo restante.');
      return;
    }
    this.saving.set(true);
    this.paymentApi.create({ tabId: tab.id, ...this.paymentForm })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => { this.feedback.success('Pagamento registrado com sucesso.'); this.loadSummary(tab.id); this.tabApi.getById(tab.id).subscribe((updated) => this.selectedTab.set(updated)); },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }
  closeTab(tab: Tab): void {
    if (!this.canClose(tab) || this.saving()) return;
    this.saving.set(true);
    const operation: Observable<unknown> = tab.type === 'COUNTER'
      ? this.tabApi.finishCounterSale(tab.id)
      : this.tabApi.close(tab.id);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.feedback.success('Comanda fechada com sucesso.'); this.summary.set(null); this.selectedTab.set(null); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }
  remainingAmount(tab: Tab): number { const current = this.summary(); return current?.tabId === tab.id ? current.remainingAmount : tab.remainingAmount; }
  counterSummary(tab: Tab): CounterSaleSummary | null { return tab.type === 'COUNTER' ? this.counterSales().find((sale) => sale.id === tab.id) ?? null : null; }
  tabOrders(tab: Tab): RestaurantOrder[] { return this.orders().filter((order) => order.tabId === tab.id && order.status !== 'CANCELLED'); }
  canClose(tab: Tab): boolean {
    if (this.remainingAmount(tab) > 0) return false;
    const sale = this.counterSummary(tab);
    if (sale) return sale.nextAction === 'FINALIZE';
    return this.tabOrders(tab).every((order) => order.status === 'DELIVERED');
  }
  cashierStateLabel(tab: Tab): string {
    if (tab.paidAmount === 0) return 'Pagamento pendente';
    if (tab.remainingAmount > 0) return 'Pagamento parcial';
    if (this.canClose(tab)) return 'Pronta para fechamento';
    const sale = this.counterSummary(tab);
    if (sale?.preparationState === 'WAITING') return 'Paga, aguardando preparo';
    if (sale && ['IN_PREPARATION', 'PARTIALLY_READY'].includes(sale.preparationState)) return 'Paga, em preparo';
    return 'Paga, aguardando entrega';
  }
  closeBlockReason(tab: Tab): string {
    const sale = this.counterSummary(tab);
    if (sale?.nextAction === 'FOLLOW_PREPARATION') return 'O preparo continua. A venda permanece ativa no Balcão.';
    if (sale?.nextAction === 'DELIVER') return 'Marque o pedido como entregue no atendimento antes de finalizar.';
    return 'Existem pedidos que ainda precisam ser entregues.';
  }
  preparationLabel(sale: CounterSaleSummary): string { return ({ NOT_APPLICABLE: 'Sem preparo', WAITING: 'Aguardando preparo', IN_PREPARATION: 'Em preparo', PARTIALLY_READY: 'Parcialmente pronto', READY: 'Pronto', DELIVERED: 'Entregue' })[sale.preparationState]; }
  attendanceLabel(sale: CounterSaleSummary): string { return ({ ASSEMBLING: 'Em montagem', CONFIRMED: 'Confirmado', IN_PROGRESS: 'Em andamento', READY_TO_FINISH: 'Pronto para finalizar', FINISHED: 'Finalizado', CANCELLED: 'Cancelado' })[sale.attendanceState]; }
  methodLabel(method: PaymentMethod): string { return this.methods.find((item) => item.value === method)?.label || method; }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
}
