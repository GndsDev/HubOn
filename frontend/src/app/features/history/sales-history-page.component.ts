import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { SalesApiService } from '../../core/services/sales-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaymentMethod, Sale, SaleStatus, SaleType } from '../../shared/models/sale.model';
import { apiErrorMessage } from '../../shared/util/api-error';

@Component({
  selector: 'app-sales-history-page',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header
      kicker="Consulta"
      title="Histórico de vendas"
      description="Vendas fechadas e canceladas de mesas e balcão."
    >
      <div page-actions class="page-header-actions">
        <button
          type="button"
          class="secondary-button"
          (click)="load()"
          [disabled]="loading()"
        >
          <i class="pi pi-refresh"></i>
          Atualizar
        </button>
      </div>
    </app-page-header>

    <section class="history-panel">
      <div class="history-toolbar">
        <label class="field compact-field">
          <span>De</span>
          <input type="date" [(ngModel)]="from" />
        </label>

        <label class="field compact-field">
          <span>Até</span>
          <input type="date" [(ngModel)]="to" />
        </label>

        <label class="field compact-field">
          <span>Origem</span>
          <select [(ngModel)]="type">
            <option value="ALL">Todas</option>
            <option value="TABLE">Mesa</option>
            <option value="COUNTER">Balcão</option>
          </select>
        </label>

        <label class="field compact-field">
          <span>Situação</span>
          <select [(ngModel)]="status">
            <option value="ALL">Todas</option>
            <option value="CLOSED">Fechada</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </label>

        <span class="history-count">
          {{ visibleSales().length }} venda{{ visibleSales().length === 1 ? '' : 's' }}
        </span>
      </div>

      @if (loading()) {
        <div class="loading-grid">
          <div class="loading-row"></div>
          <div class="loading-row"></div>
          <div class="loading-row"></div>
        </div>
      } @else if (error()) {
        <div class="error-panel" role="alert">
          <i class="pi pi-exclamation-triangle"></i>
          <div>
            <strong>Não foi possível carregar o histórico</strong>
            <p>{{ error() }}</p>
          </div>
        </div>
      } @else if (!visibleSales().length) {
        <app-empty-state
          icon="pi pi-history"
          title="Nenhuma venda encontrada"
          description="Ajuste os filtros ou aguarde o fechamento das primeiras vendas."
        />
      } @else {
        <div class="history-table">
          <div class="history-head" aria-hidden="true">
            <span>Data</span>
            <span>Origem</span>
            <span>Itens</span>
            <span>Total</span>
            <span>Pagamento</span>
            <span>Situação</span>
            <span></span>
          </div>

          @for (sale of visibleSales(); track sale.id) {
            <article class="history-row" [class.expanded]="expandedId() === sale.id">
              <time>{{ dateTime(sale.closedAt || sale.cancelledAt || sale.openedAt) }}</time>
              <strong class="history-origin">{{ origin(sale) }}</strong>
              <span>{{ activeItemCount(sale) }}</span>
              <strong class="money-cell">{{ currency(sale.finalAmount) }}</strong>
              <span class="payment-cell">{{ paymentSummary(sale) }}</span>
              <app-status-badge
                [label]="statusLabel(sale.status)"
                [tone]="sale.status === 'CLOSED' ? 'success' : 'danger'"
              />
              <button
                type="button"
                class="icon-button"
                [attr.aria-label]="'Ver detalhes da venda ' + sale.id"
                (click)="toggleDetails(sale.id)"
              >
                <i [class]="expandedId() === sale.id ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"></i>
              </button>

              @if (expandedId() === sale.id) {
                <div class="history-detail">
                  <section class="detail-block detail-summary">
                    <h3>Resumo</h3>
                    <dl>
                      <div>
                        <dt>Aberta por</dt>
                        <dd>{{ sale.openedByUserName }}</dd>
                      </div>
                      <div>
                        <dt>Subtotal</dt>
                        <dd>{{ currency(sale.subtotal) }}</dd>
                      </div>
                      <div>
                        <dt>Taxa</dt>
                        <dd>{{ currency(sale.serviceFee) }}</dd>
                      </div>
                      <div>
                        <dt>Desconto</dt>
                        <dd>{{ currency(sale.discountAmount) }}</dd>
                      </div>
                      <div class="summary-total">
                        <dt>Total</dt>
                        <dd>{{ currency(sale.finalAmount) }}</dd>
                      </div>
                    </dl>
                  </section>

                  <section class="detail-block detail-items">
                    <h3>Itens</h3>
                    @for (item of sale.items; track item.id) {
                      <div class="detail-line" [class.cancelled]="item.cancelledAt">
                        <span>{{ item.quantity }}x</span>
                        <div>
                          <strong>{{ item.productName }}</strong>
                          @if (item.options.length) {
                            <small>{{ optionSummary(item.options) }}</small>
                          }
                          @if (item.cancelledAt) {
                            <small>Cancelado: {{ item.cancellationReason }}</small>
                          }
                        </div>
                        <strong class="money-cell">{{ currency(item.subtotal) }}</strong>
                      </div>
                    }
                  </section>

                  <section class="detail-block detail-payments">
                    <h3>Pagamentos</h3>
                    @for (payment of sale.payments; track payment.id) {
                      <div class="detail-line">
                        <i class="pi pi-wallet"></i>
                        <div>
                          <strong>{{ methodLabel(payment.method) }}</strong>
                          <small>{{ dateTime(payment.paidAt) }} · {{ payment.receivedByUserName }}</small>
                        </div>
                        <strong class="money-cell">{{ currency(payment.amount) }}</strong>
                      </div>
                    } @empty {
                      <p class="muted-line">Nenhum pagamento registrado.</p>
                    }
                  </section>

                  @if (sale.cancellationReason) {
                    <p class="cancellation-note">
                      <strong>Motivo:</strong>
                      {{ sale.cancellationReason }}
                    </p>
                  }
                </div>
              }
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .history-panel {
      display: grid;
      gap: 1rem;
      max-width: 84rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--gradient-card), var(--surface-card-bg);
      box-shadow: var(--shadow-card);
      padding: 1rem;
    }

    .history-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: .65rem;
      border-bottom: 1px solid var(--color-border-soft);
      padding-bottom: .9rem;
    }

    .history-toolbar .compact-field {
      width: clamp(8.75rem, 14vw, 11rem);
    }

    .history-count {
      margin-left: auto;
      color: var(--color-text-muted);
      font-size: .82rem;
      font-weight: 800;
    }

    .history-table {
      display: grid;
      gap: .35rem;
      min-width: 0;
    }

    .history-head,
    .history-row {
      display: grid;
      grid-template-columns: 9rem minmax(10rem, 1.25fr) 4.25rem 8rem minmax(9rem, .9fr) 7.5rem 2.5rem;
      gap: .75rem;
      align-items: center;
    }

    .history-head {
      border-bottom: 1px solid var(--color-border-soft);
      color: var(--color-text-muted);
      padding: .4rem .85rem .7rem;
      font-size: .72rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .history-row {
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-sm);
      background: var(--surface-row-bg);
      padding: .72rem .85rem;
      box-shadow: var(--shadow-row);
      transition: border-color var(--duration-fast) ease, background var(--duration-fast) ease;
    }

    .history-row:hover,
    .history-row.expanded {
      border-color: var(--border-interactive);
      background: var(--surface-row-hover-bg);
    }

    .history-row time,
    .history-row > span {
      color: var(--color-text-muted);
      font-size: .86rem;
    }

    .history-origin {
      min-width: 0;
    }

    .money-cell {
      justify-self: end;
      color: var(--color-text-strong);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .payment-cell {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .history-detail {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: minmax(14rem, .75fr) minmax(18rem, 1.3fr) minmax(16rem, 1fr);
      gap: .8rem;
      border-top: 1px solid var(--color-border-soft);
      margin-top: .25rem;
      padding-top: .85rem;
    }

    .detail-block {
      display: grid;
      align-content: start;
      gap: .55rem;
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-sm);
      background: var(--surface-subtle-bg);
      padding: .75rem;
    }

    .detail-block h3 {
      margin: 0;
      color: var(--color-text-strong);
      font-size: .82rem;
    }

    .detail-summary dl {
      display: grid;
      gap: .35rem;
      margin: 0;
    }

    .detail-summary div,
    .detail-line {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: start;
      gap: .6rem;
    }

    .detail-summary div {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .detail-summary dt,
    .detail-line small,
    .muted-line {
      color: var(--color-text-muted);
      font-size: .8rem;
    }

    .detail-summary dd {
      margin: 0;
      color: var(--color-text-strong);
      font-weight: 800;
    }

    .summary-total {
      border-top: 1px solid var(--color-border-soft);
      padding-top: .45rem;
    }

    .summary-total dd {
      color: var(--color-value-accent);
      font-size: 1rem;
    }

    .detail-line {
      border-bottom: 1px solid var(--color-border-soft);
      padding-bottom: .45rem;
    }

    .detail-line:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .detail-line > div {
      display: grid;
      gap: .15rem;
      min-width: 0;
    }

    .detail-line.cancelled {
      opacity: .58;
    }

    .detail-line.cancelled strong:first-child,
    .detail-line.cancelled div > strong {
      text-decoration: line-through;
    }

    .detail-payments i {
      color: var(--color-icon);
      padding-top: .15rem;
    }

    .cancellation-note {
      grid-column: 1 / -1;
      margin: 0;
      border: 1px solid var(--border-danger);
      border-radius: var(--radius-sm);
      background: var(--status-danger-bg);
      color: var(--color-danger-text);
      padding: .7rem .8rem;
    }

    @media (max-width: 1100px) {
      .history-head,
      .history-row {
        grid-template-columns: 8.5rem minmax(9rem, 1fr) 4rem 7rem 7rem 2.5rem;
      }

      .history-head > :nth-child(5),
      .history-row > .payment-cell {
        display: none;
      }

      .history-detail {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      .history-panel {
        padding: .8rem;
      }

      .history-toolbar .compact-field {
        width: calc(50% - .35rem);
      }

      .history-count {
        width: 100%;
        margin-left: 0;
      }

      .history-head {
        display: none;
      }

      .history-row {
        grid-template-columns: 1fr auto;
      }

      .history-row > :nth-child(3),
      .history-row > .payment-cell {
        display: none;
      }

      .money-cell {
        justify-self: start;
      }
    }
  `,
})
export class SalesHistoryPageComponent implements OnInit {
  private readonly api = inject(SalesApiService);
  readonly sales = signal<Sale[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly expandedId = signal<number | null>(null);
  type: SaleType | 'ALL' = 'ALL';
  status: SaleStatus | 'ALL' = 'ALL';
  from = '';
  to = '';

  visibleSales(): Sale[] {
    return this.sales()
      .filter((sale) => sale.status !== 'OPEN')
      .filter((sale) => this.type === 'ALL' || sale.type === this.type)
      .filter((sale) => this.status === 'ALL' || sale.status === this.status)
      .filter((sale) => {
        const date = (sale.closedAt || sale.cancelledAt || sale.openedAt).slice(0, 10);
        return (!this.from || date >= this.from) && (!this.to || date <= this.to);
      })
      .sort((a, b) =>
        (b.closedAt || b.cancelledAt || b.openedAt).localeCompare(a.closedAt || a.cancelledAt || a.openedAt),
      );
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (sales) => this.sales.set(sales),
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  toggleDetails(id: number): void {
    this.expandedId.update((current) => current === id ? null : id);
  }

  origin(sale: Sale): string {
    return sale.type === 'TABLE' ? `Mesa ${sale.tableNumber}` : `Balcão #${sale.id}`;
  }

  activeItemCount(sale: Sale): number {
    return sale.items.filter((item) => !item.cancelledAt).reduce((total, item) => total + item.quantity, 0);
  }

  paymentSummary(sale: Sale): string {
    return sale.payments.length
      ? [...new Set(sale.payments.map((payment) => this.methodLabel(payment.method)))].join(', ')
      : 'Sem pagamento';
  }

  optionSummary(options: Sale['items'][number]['options']): string {
    return options.map((option) => option.optionName).join(', ');
  }

  statusLabel(status: SaleStatus): string {
    return status === 'CLOSED' ? 'Fechada' : status === 'CANCELLED' ? 'Cancelada' : 'Aberta';
  }

  methodLabel(method: PaymentMethod): string {
    return ({
      CASH: 'Dinheiro',
      CREDIT_CARD: 'Crédito',
      DEBIT_CARD: 'Débito',
      PIX: 'PIX',
      VOUCHER: 'Voucher',
    })[method];
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  dateTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }
}
