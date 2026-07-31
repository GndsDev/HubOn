import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { CashApiService } from '../../core/services/cash-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { CashMovement, CashMovementRequest, CashShift } from '../../shared/models/cash.model';
import { PaymentMethod } from '../../shared/models/payment.model';
import { Tab } from '../../shared/models/tab.model';
import { apiErrorMessage } from '../../shared/util/api-error';

@Component({
  selector: 'app-cashier-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    EmptyStateComponent,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
    AccessibleDialogDirective,
  ],
  template: `
    <app-page-header kicker="Gestão financeira" title="Caixa" description="Controle o turno, o dinheiro e a conferência financeira.">
      @if (currentShift(); as shift) {
        <app-status-badge label="Turno aberto" tone="success" />
        <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Atualizar</button>
      }
    </app-page-header>

    @if (loading()) {
      <section class="stats-grid cash-shift-stats">@for (item of [1,2,3,4]; track item) { <div class="premium-card loading-card"></div> }</section>
    } @else if (error()) {
      <div class="error-panel" role="alert"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar o Caixa</strong><p>{{ error() }}</p></div><button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button></div>
    } @else if (currentShift(); as shift) {
      <section class="stats-grid cash-shift-stats" aria-label="Resumo do turno atual">
        <article class="premium-card stat-card"><div class="stat-icon"><i class="pi pi-sign-in"></i></div><div class="stat-copy"><span>Saldo inicial</span><strong>{{ currency(shift.openingBalance) }}</strong><p>{{ dateTime(shift.openedAt) }}</p></div></article>
        <article class="premium-card stat-card"><div class="stat-icon"><i class="pi pi-wallet"></i></div><div class="stat-copy"><span>Total recebido</span><strong>{{ currency(shift.receivedTotal) }}</strong><p>Pagamentos do turno</p></div></article>
        <article class="premium-card stat-card"><div class="stat-icon"><i class="pi pi-arrow-right-arrow-left"></i></div><div class="stat-copy"><span>Movimentações</span><strong>{{ signedMovementSummary(shift) }}</strong><p>Suprimentos menos sangrias</p></div></article>
        <article class="premium-card stat-card"><div class="stat-icon"><i class="pi pi-calculator"></i></div><div class="stat-copy"><span>Saldo esperado</span><strong>{{ currency(shift.expectedCash) }}</strong><p>Dinheiro em caixa</p></div></article>
      </section>

      <section class="cash-control-layout">
        <app-section-card eyebrow="Turno atual" [title]="'Caixa #' + shift.id">
          <div class="cash-shift-headline">
            <div><span>Operador</span><strong>{{ shift.openedByUserName }}</strong></div>
            <div><span>Abertura</span><strong>{{ dateTime(shift.openedAt) }}</strong></div>
            <app-status-badge label="Aberto" tone="success" />
          </div>
          <div class="payment-method-grid">
            @for (method of methods; track method.value) {
              <div><span>{{ method.label }}</span><strong>{{ currency(methodAmount(shift, method.value)) }}</strong></div>
            }
          </div>
          <div class="cash-audit-summary">
            <span><small>Cancelamentos</small><strong>{{ currency(shift.cancellationAmount) }}</strong></span>
            <span><small>Estornos financeiros</small><strong>{{ currency(shift.refundAmount) }}</strong></span>
            <span><small>Suprimentos</small><strong>{{ currency(shift.supplyAmount) }}</strong></span>
            <span><small>Sangrias</small><strong>{{ currency(shift.withdrawalAmount) }}</strong></span>
          </div>
          <div class="cash-shift-actions">
            <button type="button" class="ghost-button" (click)="openMovement('WITHDRAWAL')"><i class="pi pi-arrow-up-right"></i>Registrar sangria</button>
            <button type="button" class="ghost-button" (click)="openMovement('SUPPLY')"><i class="pi pi-arrow-down-left"></i>Registrar suprimento</button>
            <button type="button" class="primary-button" (click)="openClose(shift)"><i class="pi pi-lock"></i>Fechar caixa</button>
          </div>
        </app-section-card>

        <app-section-card eyebrow="Operação" title="Pagamentos pendentes">
          <div class="pending-payment-list">
            @for (tab of pendingTabs(); track tab.id) {
              <article>
                <div><strong>{{ tab.displayLabel }}</strong><small>Restante {{ currency(tab.remainingAmount) }}</small></div>
                <a class="ghost-button compact-button" [routerLink]="tab.type === 'COUNTER' ? ['/balcao', tab.id] : ['/comandas']" [queryParams]="tab.type === 'TABLE' ? { tab: tab.id } : null">
                  <i class="pi pi-arrow-right"></i>{{ tab.type === 'COUNTER' ? 'Abrir atendimento' : 'Abrir comanda' }}
                </a>
              </article>
            } @empty {
              <app-empty-state icon="pi pi-check-circle" title="Nenhum pagamento pendente" description="As vendas abertas estão financeiramente em dia." />
            }
          </div>
        </app-section-card>
      </section>

      <app-section-card eyebrow="Auditoria" title="Movimentações do turno">
        @if (shift.movements.length) {
          <div class="cash-movement-table">
            <div class="cash-movement-head"><span>Horário</span><span>Tipo e origem</span><span>Método</span><span>Responsável</span><span>Referência</span><span>Valor</span></div>
            @for (movement of reversedMovements(shift.movements); track movement.id) {
              <article class="cash-movement-row">
                <time>{{ time(movement.occurredAt) }}</time>
                <div><strong>{{ movementTypeLabel(movement) }}</strong><small>{{ movement.origin }}</small>@if (movement.observation) { <small>{{ movement.observation }}</small> }</div>
                <span>{{ movement.method ? methodLabel(movement.method) : '—' }}</span>
                <span>{{ movement.responsible }}</span>
                <span>{{ movement.reference }}</span>
                <strong [class.negative]="movement.type === 'WITHDRAWAL'">{{ movement.type === 'WITHDRAWAL' ? '− ' : '' }}{{ currency(movement.amount) }}</strong>
              </article>
            }
          </div>
        } @else {
          <app-empty-state icon="pi pi-list" title="Nenhuma movimentação" description="Pagamentos, sangrias e suprimentos aparecerão aqui." />
        }
      </app-section-card>
    } @else {
      <section class="cash-closed-layout">
        <app-section-card eyebrow="Turno atual" title="Caixa fechado">
          <div class="cash-closed-state"><i class="pi pi-lock"></i><div><strong>Abra o turno antes de movimentar dinheiro</strong><p>Informe o saldo inicial disponível no caixa.</p></div></div>
          <form class="cash-open-form" (ngSubmit)="openShift()">
            <label class="field"><span>Saldo inicial</span><input name="openingBalance" type="number" min="0" step="0.01" [(ngModel)]="openingBalance" required /></label>
            <button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-lock-open"></i>{{ saving() ? 'Abrindo...' : 'Abrir caixa' }}</button>
          </form>
        </app-section-card>
        <app-section-card eyebrow="Consulta" title="Último fechamento">
          @if (history()[0]; as last) {
            <div class="cash-last-closing"><span>Fechado em</span><strong>{{ dateTime(last.closedAt!) }}</strong><span>Valor contado</span><strong>{{ currency(last.countedCash ?? 0) }}</strong><span>Diferença</span><strong [class.negative]="(last.differenceAmount ?? 0) < 0">{{ currency(last.differenceAmount ?? 0) }}</strong></div>
          } @else {
            <app-empty-state icon="pi pi-history" title="Sem histórico" description="O primeiro fechamento aparecerá aqui." />
          }
        </app-section-card>
      </section>
    }

    @if (history().length) {
      <app-section-card eyebrow="Histórico financeiro" title="Turnos anteriores">
        <div class="cash-history-list">
          @for (shift of history(); track shift.id) {
            <article><div><strong>Caixa #{{ shift.id }}</strong><small>{{ shift.openedByUserName }} · {{ dateTime(shift.openedAt) }}</small></div><app-status-badge [label]="shift.status === 'OPEN' ? 'Aberto' : 'Fechado'" [tone]="shift.status === 'OPEN' ? 'success' : 'neutral'" /><span><small>Recebido</small><strong>{{ currency(shift.receivedTotal) }}</strong></span><span><small>Diferença</small><strong [class.negative]="(shift.differenceAmount ?? 0) < 0">{{ shift.differenceAmount == null ? '—' : currency(shift.differenceAmount) }}</strong></span></article>
          }
        </div>
      </app-section-card>
    }

    @if (movementOpen()) {
      <div class="modal-backdrop" (click)="movementOpen.set(false)">
        <form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="cash-movement-title" [dialogCloseDisabled]="saving()" (dialogClose)="movementOpen.set(false)" (click)="$event.stopPropagation()" (ngSubmit)="saveMovement()">
          <div class="modal-header"><div><span>Movimentação do turno</span><h2 id="cash-movement-title">{{ movementForm.type === 'SUPPLY' ? 'Registrar suprimento' : 'Registrar sangria' }}</h2></div><button type="button" class="icon-button" aria-label="Fechar movimentação" (click)="movementOpen.set(false)"><i class="pi pi-times"></i></button></div>
          <label class="field"><span>Valor</span><input name="movementAmount" type="number" min="0.01" step="0.01" [(ngModel)]="movementForm.amount" required autofocus /></label>
          <label class="field"><span>Observação</span><textarea name="movementNote" maxlength="500" [(ngModel)]="movementForm.note" required></textarea></label>
          <div class="modal-actions"><button type="button" class="ghost-button" (click)="movementOpen.set(false)">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-save"></i>Registrar movimentação</button></div>
        </form>
      </div>
    }

    @if (closeOpen() && currentShift(); as shift) {
      <div class="modal-backdrop" (click)="closeOpen.set(false)">
        <form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="cash-close-title" [dialogCloseDisabled]="saving()" (dialogClose)="closeOpen.set(false)" (click)="$event.stopPropagation()" (ngSubmit)="closeShift(shift)">
          <div class="modal-header"><div><span>Conferência</span><h2 id="cash-close-title">Fechar caixa</h2></div><button type="button" class="icon-button" aria-label="Fechar conferência" (click)="closeOpen.set(false)"><i class="pi pi-times"></i></button></div>
          <div class="payment-total-card"><div><span>Esperado em dinheiro</span><strong>{{ currency(shift.expectedCash) }}</strong></div><div><span>Eletrônicos</span><strong>{{ currency(electronicTotal(shift)) }}</strong></div><div><span>Total do turno</span><strong>{{ currency(shift.receivedTotal) }}</strong></div></div>
          <label class="field"><span>Valor contado</span><input name="countedCash" type="number" min="0" step="0.01" [(ngModel)]="closeForm.countedCash" required autofocus /></label>
          <div class="cash-difference-preview"><span>Diferença</span><strong [class.negative]="closeDifference(shift) < 0">{{ currency(closeDifference(shift)) }}</strong></div>
          <label class="field"><span>Observação {{ closeDifference(shift) !== 0 ? 'obrigatória' : 'opcional' }}</span><textarea name="closingNote" maxlength="500" [(ngModel)]="closeForm.note" [required]="closeDifference(shift) !== 0"></textarea></label>
          <div class="modal-actions"><button type="button" class="ghost-button" (click)="closeOpen.set(false)">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving() || (closeDifference(shift) !== 0 && !closeForm.note.trim())"><i class="pi pi-lock"></i>Confirmar fechamento</button></div>
        </form>
      </div>
    }
  `,
})
export class CashierPageComponent implements OnInit {
  private readonly api = inject(CashApiService);
  private readonly tabApi = inject(TabApiService);
  private readonly feedback = inject(FeedbackService);

  readonly currentShift = signal<CashShift | null>(null);
  readonly history = signal<CashShift[]>([]);
  readonly openTabs = signal<Tab[]>([]);
  readonly pendingTabs = computed(() => this.openTabs().filter((tab) => tab.remainingAmount > 0));
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly movementOpen = signal(false);
  readonly closeOpen = signal(false);
  openingBalance = 0;
  movementForm: CashMovementRequest = { type: 'WITHDRAWAL', amount: 0, note: '' };
  closeForm = { countedCash: 0, note: '' };
  readonly methods: Array<{ value: PaymentMethod; label: string }> = [
    { value: 'CASH', label: 'Dinheiro' },
    { value: 'PIX', label: 'PIX' },
    { value: 'DEBIT_CARD', label: 'Débito' },
    { value: 'CREDIT_CARD', label: 'Crédito' },
    { value: 'VOUCHER', label: 'Outros' },
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ current: this.api.getCurrent(), history: this.api.getHistory(), tabs: this.tabApi.getOpen() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ current, history, tabs }) => {
          this.currentShift.set(current);
          this.history.set(history.filter((shift) => shift.status === 'CLOSED'));
          this.openTabs.set(tabs);
        },
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  openShift(): void {
    if (this.openingBalance < 0 || this.saving()) return;
    this.saving.set(true);
    this.api.open({ openingBalance: Number(this.openingBalance) }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (shift) => { this.currentShift.set(shift); this.feedback.success('Caixa aberto com sucesso.'); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  openMovement(type: CashMovementRequest['type']): void {
    this.movementForm = { type, amount: 0, note: '' };
    this.movementOpen.set(true);
  }

  saveMovement(): void {
    const shift = this.currentShift();
    if (!shift || this.movementForm.amount <= 0 || !this.movementForm.note.trim() || this.saving()) return;
    this.saving.set(true);
    this.api.addMovement(shift.id, { ...this.movementForm, amount: Number(this.movementForm.amount), note: this.movementForm.note.trim() })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => { this.currentShift.set(updated); this.movementOpen.set(false); this.feedback.success('Movimentação registrada.'); },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  openClose(shift: CashShift): void {
    this.closeForm = { countedCash: shift.expectedCash, note: '' };
    this.closeOpen.set(true);
  }

  closeShift(shift: CashShift): void {
    if (this.saving() || (this.closeDifference(shift) !== 0 && !this.closeForm.note.trim())) return;
    this.saving.set(true);
    this.api.close(shift.id, { countedCash: Number(this.closeForm.countedCash), note: this.closeForm.note.trim() || null })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => { this.closeOpen.set(false); this.feedback.success('Caixa fechado e conferido.'); this.load(); },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  methodAmount(shift: CashShift, method: PaymentMethod): number { return shift.receivedByMethod[method] ?? 0; }
  electronicTotal(shift: CashShift): number { return shift.receivedTotal - this.methodAmount(shift, 'CASH'); }
  closeDifference(shift: CashShift): number { return Number(this.closeForm.countedCash || 0) - shift.expectedCash; }
  signedMovementSummary(shift: CashShift): string { return this.currency(shift.supplyAmount - shift.withdrawalAmount); }
  reversedMovements(movements: CashMovement[]): CashMovement[] { return [...movements].reverse(); }
  movementTypeLabel(movement: CashMovement): string { return ({ PAYMENT: 'Recebimento', SUPPLY: 'Suprimento', WITHDRAWAL: 'Sangria', CANCELLATION: 'Cancelamento', REFUND: 'Estorno' })[movement.type]; }
  methodLabel(method: PaymentMethod): string { return this.methods.find((item) => item.value === method)?.label ?? method; }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  dateTime(value: string): string { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
  time(value: string): string { return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
}
