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
      kicker="Consulta"
      title="Histórico de vendas"
      description="Vendas concluídas e canceladas de mesas e balcão."
    >
      <div page-actions class="page-header-actions">
        <button type="button" class="secondary-button" (click)="load()" [disabled]="loading()">
          <i class="pi pi-refresh"></i>
          Atualizar
        </button>
      </div>
    </app-page-header>

    <div class="counter-history-filters">
      <label class="field">
        <span>De</span>
        <input type="date" [(ngModel)]="from" />
      </label>

      <label class="field">
        <span>Até</span>
        <input type="date" [(ngModel)]="to" />
      </label>

      <label class="field">
        <span>Origem</span>
        <select [(ngModel)]="type">
          <option value="ALL">Todas</option>
          <option value="TABLE">Mesa</option>
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
      <app-section-card eyebrow="Operação" title="Vendas concluídas">
        <span card-action class="report-sales-count">
          {{ visibleSales().length }} venda{{ visibleSales().length === 1 ? '' : 's' }}
        </span>

        <div class="report-sales-table" role="region" aria-label="Histórico de vendas" tabindex="0">
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
                <tr>
                  <td>{{ dateTime(sale.closedAt || sale.cancelledAt || sale.openedAt) }}</td>
                  <td>
                    <strong>{{ origin(sale) }}</strong>
                    <small>#{{ sale.id }} · {{ sale.openedByUserName }}</small>
                  </td>
                  <td>{{ activeItemCount(sale) }}</td>
                  <td><strong>{{ currency(sale.finalAmount) }}</strong></td>
                  <td>{{ paymentSummary(sale) }}</td>
                  <td>
                    <app-status-badge
                      [label]="statusLabel(sale.status)"
                      [tone]="sale.status === 'CLOSED' ? 'success' : 'danger'"
                    />
                  </td>
                  <td>
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
                        <div class="detail-grid tab-detail-summary">
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
                          <div>
                            <span>Total</span>
                            <strong>{{ currency(sale.finalAmount) }}</strong>
                          </div>
                        </div>

                        <div class="history-detail-columns">
                          <section class="history-detail-section detail-items">
                            <h3>Itens</h3>
                            <div class="detailed-order-items">
                              @for (item of sale.items; track item.id) {
                                <div class="detailed-order-item" [class.cancelled]="item.cancelledAt">
                                  <div>
                                    <strong>{{ item.quantity }}x {{ item.productName }}</strong>
                                    @if (item.options.length) {
                                      <small>{{ optionSummary(item.options) }}</small>
                                    }
                                    @if (item.cancelledAt) {
                                      <small>Cancelado: {{ item.cancellationReason }}</small>
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
                            <h3>Pagamentos</h3>
                            @for (payment of sale.payments; track payment.id) {
                              <div>
                                <p>
                                  <strong>{{ methodLabel(payment.method) }}</strong><br />
                                  {{ dateTime(payment.paidAt) }} · {{ payment.receivedByUserName }}
                                </p>
                                <strong>{{ currency(payment.amount) }}</strong>
                              </div>
                            } @empty {
                              <p>Nenhum pagamento registrado.</p>
                            }
                          </section>
                        </div>

                        @if (sale.cancellationReason) {
                          <p class="cancellation-note">
                            <strong>Motivo do cancelamento:</strong>
                            {{ sale.cancellationReason }}
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
    .history-detail-row > td {
      padding: 0 var(--space-sm) var(--space-lg);
    }

    .history-expanded-detail {
      display: grid;
      gap: var(--space-lg);
      border-top: 1px solid var(--color-border-soft);
      padding-top: var(--space-lg);
    }

    .history-detail-columns {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(16rem, .8fr);
      gap: var(--space-xl);
    }

    .history-detail-section {
      display: grid;
      min-width: 0;
      align-content: start;
      gap: var(--space-sm);
    }

    .history-detail-section h3,
    .history-detail-section p,
    .cancellation-note {
      margin: 0;
    }

    .cancellation-note {
      border-top: 1px solid var(--border-danger);
      color: var(--color-danger-text);
      padding-top: var(--space-md);
    }

    @media (max-width: 980px) {
      .history-detail-columns {
        grid-template-columns: 1fr;
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
