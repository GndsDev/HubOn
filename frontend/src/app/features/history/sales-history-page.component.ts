import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { SalesApiService } from '../../core/services/sales-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaymentMethod, Sale, SaleStatus, SaleType } from '../../shared/models/sale.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { saleChoiceSummary } from '../../shared/util/sale-workflow';

@Component({
  selector: 'app-sales-history-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-page-header
      kicker="Vendas"
      title="Histórico"
      description="Consulte comandas e vendas de balcão concluídas ou canceladas."
    >
      <div page-actions class="page-header-actions">
        <button type="button" class="secondary-button" (click)="load()" [disabled]="loading()">
          <i class="pi pi-refresh"></i>
          Atualizar
        </button>
      </div>
    </app-page-header>

    <section class="report-filters history-filters" aria-label="Filtros do histórico">
      <div class="field report-reference-filter">
        <span>Período</span>
        <div class="report-reference-controls">
          <input type="date" aria-label="Data inicial" [(ngModel)]="from" />
          <span>até</span>
          <input type="date" aria-label="Data final" [(ngModel)]="to" />
        </div>
      </div>

      <label class="field report-channel-filter">
        <span>Origem</span>
        <select [(ngModel)]="type">
          <option value="ALL">Todas</option>
          <option value="TABLE">Comandas</option>
          <option value="COUNTER">Balcão</option>
        </select>
      </label>

      <label class="field">
        <span>Situação</span>
        <select [(ngModel)]="status">
          <option value="ALL">Todas</option>
          <option value="CLOSED">Fechada</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
      </label>
    </section>

    @if (loading()) {
      <div class="loading-grid history-state-panel">
        <div class="loading-row"></div>
        <div class="loading-row"></div>
        <div class="loading-row"></div>
      </div>
    } @else if (error()) {
      <div class="error-panel history-state-panel" role="alert">
        <i class="pi pi-exclamation-triangle"></i>
        <div>
          <strong>Não foi possível carregar o histórico</strong>
          <p>{{ error() }}</p>
        </div>
        <button type="button" class="ghost-button" (click)="load()">
          <i class="pi pi-refresh"></i>
          Tentar novamente
        </button>
      </div>
    } @else if (!visibleSales().length) {
      <app-empty-state
        class="history-state-panel"
        icon="pi pi-history"
        title="Nenhuma venda encontrada"
        description="Ajuste os filtros ou aguarde o fechamento das primeiras vendas."
      />
    } @else {
      <app-section-card class="history-results" eyebrow="Resultados" title="Vendas encontradas">
        <app-status-badge card-action [label]="resultCountLabel()" tone="neutral" />

        <div class="report-sales-table history-table" role="region" aria-label="Histórico de vendas" tabindex="0">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Origem</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Pagamento</th>
                <th>Situação</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              @for (sale of visibleSales(); track sale.id) {
                <tr class="history-sale-row" [class.expanded]="expandedId() === sale.id">
                  <td class="history-date-cell">
                    <time>{{ dateTime(sale.closedAt || sale.cancelledAt || sale.openedAt) }}</time>
                  </td>
                  <td class="history-origin-cell">
                    <strong>{{ origin(sale) }}</strong>
                    <small>Venda #{{ sale.id }} · {{ sale.openedByUserName }}</small>
                  </td>
                  <td>{{ activeItemCount(sale) }} un.</td>
                  <td class="history-money-cell">
                    <strong>{{ currency(sale.finalAmount) }}</strong>
                  </td>
                  <td>{{ paymentSummary(sale) }}</td>
                  <td>
                    <app-status-badge
                      [label]="statusLabel(sale.status)"
                      [tone]="sale.status === 'CLOSED' ? 'success' : 'danger'"
                    />
                  </td>
                  <td class="history-actions-cell">
                    <button
                      type="button"
                      class="icon-button"
                      [title]="expandedId() === sale.id ? 'Ocultar detalhes' : 'Ver detalhes'"
                      [attr.aria-label]="'Ver detalhes da venda ' + sale.id"
                      [attr.aria-expanded]="expandedId() === sale.id"
                      (click)="toggleDetails(sale.id)"
                    >
                      <i [class]="expandedId() === sale.id ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"></i>
                    </button>
                  </td>
                </tr>

                @if (expandedId() === sale.id) {
                  <tr class="history-detail-row">
                    <td colspan="7">
                      <div class="history-expanded-detail">
                        <header class="history-detail-heading">
                          <div>
                            <span>Resumo da venda</span>
                            <strong>{{ origin(sale) }}</strong>
                          </div>
                          <small>Aberta em {{ dateTime(sale.openedAt) }}</small>
                        </header>

                        <div class="detail-grid history-summary-grid">
                          <div>
                            <span>Responsável</span>
                            <strong>{{ sale.openedByUserName }}</strong>
                          </div>
                          <div>
                            <span>Subtotal</span>
                            <strong>{{ currency(sale.subtotal) }}</strong>
                          </div>
                          <div>
                            <span>Taxa</span>
                            <strong>{{ currency(sale.serviceFee) }}</strong>
                          </div>
                          <div>
                            <span>Desconto</span>
                            <strong>{{ currency(sale.discountAmount) }}</strong>
                          </div>
                          <div>
                            <span>Recebido</span>
                            <strong>{{ currency(sale.paidAmount) }}</strong>
                          </div>
                          <div class="financial-detail total">
                            <span>Total</span>
                            <strong>{{ currency(sale.finalAmount) }}</strong>
                          </div>
                        </div>

                        <div class="history-detail-columns">
                          <section class="history-detail-section history-items">
                            <header>
                              <div>
                                <h3>Itens</h3>
                                <small>{{ activeItemCount(sale) }} unidade{{ activeItemCount(sale) === 1 ? '' : 's' }}</small>
                              </div>
                            </header>

                            <div class="detailed-order-items">
                              @for (item of sale.items; track item.id) {
                                <div class="detailed-order-item" [class.cancelled]="item.cancelledAt">
                                  <div>
                                    <strong>{{ item.quantity }}x {{ item.productName }}</strong>
                                    @if (item.categoryName || item.options.length) {
                                      <small>
                                        {{ item.categoryName || 'Sem categoria' }}
                                        @if (item.options.length) {
                                          · {{ optionSummary(item.options) }}
                                        }
                                      </small>
                                    }
                                    @if (item.notes) {
                                      <small class="auxiliary-note">
                                        <i class="pi pi-comment"></i>
                                        {{ item.notes }}
                                      </small>
                                    }
                                    @if (item.cancelledAt) {
                                      <small class="history-cancelled-item">Cancelado: {{ item.cancellationReason }}</small>
                                    }
                                  </div>
                                  <div class="order-item-side">
                                    <strong>{{ currency(item.subtotal) }}</strong>
                                  </div>
                                </div>
                              }
                            </div>
                          </section>

                          <section class="history-detail-section payment-history detail-payments">
                            <header>
                              <div>
                                <h3>Pagamentos</h3>
                                <small>{{ sale.payments.length }} registro{{ sale.payments.length === 1 ? '' : 's' }}</small>
                              </div>
                            </header>

                            @for (payment of sale.payments; track payment.id) {
                              <div>
                                <p>
                                  <strong>{{ methodLabel(payment.method) }}</strong><br />
                                  {{ dateTime(payment.paidAt) }} · {{ payment.receivedByUserName }}
                                </p>
                                <strong>{{ currency(payment.amount) }}</strong>
                              </div>
                            } @empty {
                              <p class="history-muted-message">Nenhum pagamento registrado.</p>
                            }
                          </section>
                        </div>

                        @if (sale.cancellationReason) {
                          <p class="history-cancellation-note">
                            <i class="pi pi-info-circle"></i>
                            <span>
                              <strong>Motivo do cancelamento</strong>
                              {{ sale.cancellationReason }}
                            </span>
                          </p>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </app-section-card>
    }
  `,
  styles: `
    .history-filters,
    .history-results,
    .history-state-panel {
      width: min(100%, 92rem);
    }

    .history-filters {
      grid-template-columns: minmax(22rem, 1.35fr) repeat(2, minmax(11rem, .65fr));
    }

    .history-table table {
      min-width: 54rem;
    }

    .history-table th:first-child {
      width: 9rem;
    }

    .history-table th:nth-child(2) {
      width: 13rem;
    }

    .history-table th:nth-child(3),
    .history-table th:last-child {
      width: 4rem;
    }

    .history-table th:nth-child(4),
    .history-table th:nth-child(6) {
      width: 7rem;
    }

    .history-table th:nth-child(5) {
      width: 9rem;
    }

    .history-sale-row.expanded > td {
      background: var(--surface-row-hover-bg);
    }

    .history-date-cell,
    .history-money-cell,
    .history-actions-cell {
      white-space: nowrap;
    }

    .history-date-cell time {
      color: var(--color-text-muted);
    }

    .history-origin-cell strong,
    .history-money-cell strong {
      color: var(--color-text-strong);
    }

    .history-money-cell strong {
      font-size: .9rem;
      font-variant-numeric: tabular-nums;
    }

    .history-actions-cell {
      text-align: right;
    }

    .history-detail-row > td,
    .history-detail-row:hover > td {
      background: var(--surface-subtle-bg);
      padding: 0 var(--space-lg) var(--space-xl);
    }

    .history-expanded-detail {
      display: grid;
      gap: var(--space-xl);
      border-top: 1px solid var(--color-border);
      padding-top: var(--space-lg);
    }

    .history-detail-heading,
    .history-detail-section > header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-md);
    }

    .history-detail-heading > div,
    .history-detail-section > header > div {
      display: grid;
      gap: var(--space-2xs);
    }

    .history-detail-heading span,
    .history-detail-heading small,
    .history-detail-section header small,
    .history-muted-message {
      color: var(--color-text-muted);
    }

    .history-detail-heading strong {
      color: var(--color-text-strong);
      font-size: 1rem;
    }

    .history-summary-grid {
      margin: 0;
    }

    .history-detail-columns {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(17rem, .8fr);
      gap: var(--space-xl);
      border-top: 1px solid var(--color-border-soft);
      padding-top: var(--space-lg);
    }

    .history-detail-section {
      display: grid;
      min-width: 0;
      align-content: start;
      gap: var(--space-sm);
    }

    .history-detail-section + .history-detail-section {
      border-left: 1px solid var(--color-border-soft);
      padding-left: var(--space-xl);
    }

    .history-detail-section h3,
    .history-detail-section p,
    .history-cancellation-note {
      margin: 0;
    }

    .history-detail-section h3 {
      color: var(--color-text-strong);
      font-size: .95rem;
    }

    .history-detail-section.payment-history {
      border-top: 0;
      padding-top: 0;
    }

    .history-cancelled-item {
      color: var(--color-danger-strong);
    }

    .history-cancellation-note {
      display: flex;
      align-items: flex-start;
      gap: var(--space-sm);
      border: 1px solid var(--border-danger);
      border-radius: var(--radius-sm);
      background: var(--status-danger-bg);
      color: var(--color-danger-text);
      padding: var(--space-md);
    }

    .history-cancellation-note span {
      display: grid;
      gap: var(--space-2xs);
    }

    @media (max-width: 60rem) {
      .history-filters {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .history-filters .report-reference-filter {
        grid-column: 1 / -1;
      }

      .history-filters .report-channel-filter {
        grid-column: auto;
      }

      .history-detail-columns {
        grid-template-columns: 1fr;
      }

      .history-detail-section + .history-detail-section {
        border-top: 1px solid var(--color-border-soft);
        border-left: 0;
        padding-top: var(--space-lg);
        padding-left: 0;
      }
    }

    @media (max-width: 38rem) {
      .history-filters {
        grid-template-columns: 1fr;
      }

      .history-filters .report-reference-filter {
        grid-column: auto;
      }

      .history-filters .report-reference-controls {
        align-items: stretch;
        flex-direction: column;
      }

      .history-filters .report-reference-controls > span {
        display: none;
      }

      .history-detail-heading,
      .history-detail-section > header {
        align-items: flex-start;
        flex-direction: column;
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
        (b.closedAt || b.cancelledAt || b.openedAt).localeCompare(
          a.closedAt || a.cancelledAt || a.openedAt,
        ),
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

  resultCountLabel(): string {
    const count = this.visibleSales().length;
    return `${count} venda${count === 1 ? '' : 's'}`;
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
    return saleChoiceSummary(options);
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
