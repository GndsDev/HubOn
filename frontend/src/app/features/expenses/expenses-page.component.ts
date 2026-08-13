import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { ExpenseApiService } from '../../core/services/expense-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { StockApiService } from '../../core/services/stock-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import {
  Expense,
  ExpenseCategory,
  ExpenseFilters,
  ExpenseListResponse,
  ExpensePaymentMethod,
  ExpenseRequest,
  ExpenseStatus,
  ExpenseSummary,
  ExpenseValueMode,
} from '../../shared/models/expense.model';
import { StockItem, UnitOfMeasure } from '../../shared/models/stock.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { formatStockValue, unitLabel } from '../../shared/util/unit-format';

const EMPTY_SUMMARY: ExpenseSummary = {
  totalAmount: 0,
  paidAmount: 0,
  pendingAmount: 0,
  stockPurchaseAmount: 0,
  expenseCount: 0,
};

@Component({
  selector: 'app-expenses-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
    AccessibleDialogDirective,
  ],
  template: `
    <app-page-header
      kicker="Gestão financeira"
      title="Despesas"
      description="Controle compras, contas e outros gastos do restaurante."
    >
      <div page-actions class="page-header-actions">
        <button type="button" class="primary-button" (click)="openCreate()">
          <i class="pi pi-plus"></i>
          Nova despesa
        </button>
      </div>
    </app-page-header>

    <section class="expense-kpis" aria-label="Resumo das despesas filtradas">
      <article class="expense-kpi tone-blue">
        <span><i class="pi pi-chart-line"></i>Total no período</span>
        <strong>{{ currency(summary().totalAmount) }}</strong>
        <small>{{ summary().expenseCount }} registro{{ summary().expenseCount === 1 ? '' : 's' }}</small>
      </article>
      <article class="expense-kpi tone-green">
        <span><i class="pi pi-check-circle"></i>Pago</span>
        <strong>{{ currency(summary().paidAmount) }}</strong>
        <small>Valores já quitados</small>
      </article>
      <article class="expense-kpi tone-amber">
        <span><i class="pi pi-clock"></i>Pendente</span>
        <strong>{{ currency(summary().pendingAmount) }}</strong>
        <small>Compromissos em aberto</small>
      </article>
      <article class="expense-kpi tone-purple">
        <span><i class="pi pi-box"></i>Compras de estoque</span>
        <strong>{{ currency(summary().stockPurchaseAmount) }}</strong>
        <small>Com entrada vinculada</small>
      </article>
    </section>

    <section class="expense-surface">
      <form class="expense-filters" aria-label="Filtros de despesas" (ngSubmit)="load()">
        <label class="field">
          <span>De</span>
          <input name="expenseFrom" type="date" [(ngModel)]="filters.from" />
        </label>
        <label class="field">
          <span>Até</span>
          <input name="expenseTo" type="date" [(ngModel)]="filters.to" />
        </label>
        <label class="field">
          <span>Categoria</span>
          <select name="expenseCategory" [(ngModel)]="filters.category">
            <option value="">Todas</option>
            @for (category of categories; track category) {
              <option [value]="category">{{ categoryLabel(category) }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span>Status</span>
          <select name="expenseStatus" [(ngModel)]="filters.status">
            <option value="">Todos</option>
            @for (status of statuses; track status) {
              <option [value]="status">{{ statusLabel(status) }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span>Pagamento</span>
          <select name="expensePayment" [(ngModel)]="filters.paymentMethod">
            <option value="">Todos</option>
            @for (method of paymentMethods; track method) {
              <option [value]="method">{{ paymentLabel(method) }}</option>
            }
          </select>
        </label>
        <label class="field expense-search">
          <span>Busca</span>
          <span class="search-box">
            <i class="pi pi-search"></i>
            <input
              name="expenseSearch"
              type="search"
              placeholder="Descrição ou fornecedor"
              [(ngModel)]="filters.search"
            />
          </span>
        </label>
        <div class="expense-filter-actions">
          <button type="button" class="ghost-button compact-button" (click)="clearFilters()">
            <i class="pi pi-times"></i>
            Limpar
          </button>
          <button type="submit" class="secondary-button compact-button" [disabled]="loading()">
            <i class="pi pi-filter"></i>
            Aplicar
          </button>
        </div>
      </form>

      @if (error()) {
        <div class="error-banner" role="alert">
          <i class="pi pi-exclamation-triangle"></i>
          <span>{{ error() }}</span>
          <button type="button" class="ghost-button compact-button" (click)="load()">Tentar novamente</button>
        </div>
      }

      @if (loading() && !expenses().length) {
        <div class="expense-loading" aria-live="polite">
          <i class="pi pi-spin pi-spinner"></i>
          Carregando despesas...
        </div>
      } @else if (expenses().length) {
        <div class="data-table expense-table" role="region" aria-label="Despesas registradas" tabindex="0">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Fornecedor</th>
                <th>Quantidade</th>
                <th>Total</th>
                <th>Pagamento</th>
                <th>Status</th>
                <th>Estoque</th>
                <th>Responsável</th>
                <th><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (expense of expenses(); track expense.id) {
                <tr>
                  <td><time [attr.datetime]="expense.expenseDate">{{ date(expense.expenseDate) }}</time></td>
                  <td><strong>{{ expense.description }}</strong></td>
                  <td>{{ categoryLabel(expense.category) }}</td>
                  <td>{{ expense.supplier || '—' }}</td>
                  <td>{{ purchaseQuantity(expense) }}</td>
                  <td><strong>{{ currency(expense.totalAmount) }}</strong></td>
                  <td>{{ paymentLabel(expense.paymentMethod) }}</td>
                  <td><app-status-badge [label]="statusLabel(expense.status)" [tone]="statusTone(expense.status)" /></td>
                  <td>
                    @if (expense.stockMovementId) {
                      <span class="stock-linked"><i class="pi pi-check-circle"></i>{{ expense.stockItemName }}</span>
                    } @else {
                      <span class="muted-value">Sem entrada</span>
                    }
                  </td>
                  <td>{{ expense.createdByUserName }}</td>
                  <td>
                    <div class="row-actions expense-row-actions">
                      <button type="button" class="icon-button" title="Ver detalhes" [attr.aria-label]="'Ver ' + expense.description" (click)="openDetails(expense)">
                        <i class="pi pi-eye"></i>
                      </button>
                      <button type="button" class="icon-button" title="Editar despesa" [attr.aria-label]="'Editar ' + expense.description" (click)="openEdit(expense)">
                        <i class="pi pi-pencil"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="expense-mobile-list" aria-label="Despesas registradas">
          @for (expense of expenses(); track expense.id) {
            <article class="expense-mobile-card">
              <button type="button" class="expense-mobile-main" (click)="openDetails(expense)">
                <span class="expense-mobile-title"><strong>{{ expense.description }}</strong><small>{{ date(expense.expenseDate) }} · {{ categoryLabel(expense.category) }}</small></span>
                <strong class="expense-mobile-total">{{ currency(expense.totalAmount) }}</strong>
                <app-status-badge [label]="statusLabel(expense.status)" [tone]="statusTone(expense.status)" />
              </button>
              <button type="button" class="icon-button" title="Editar despesa" [attr.aria-label]="'Editar ' + expense.description" (click)="openEdit(expense)">
                <i class="pi pi-pencil"></i>
              </button>
            </article>
          }
        </div>
      } @else {
        <app-empty-state
          icon="pi pi-receipt"
          title="Nenhuma despesa encontrada"
          description="Registre uma despesa ou ajuste os filtros para consultar outro período."
        />
      }
    </section>

    @if (formOpen()) {
      <div class="modal-backdrop">
        <form
          class="modal-panel expense-dialog"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-dialog-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="closeForm()"
          (ngSubmit)="save()"
        >
          <div class="modal-header">
            <div class="modal-heading">
              <span class="modal-eyebrow">Gestão financeira</span>
              <h2 id="expense-dialog-title">{{ editing() ? 'Editar despesa' : 'Nova despesa' }}</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar despesa" (click)="closeForm()">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="modal-body expense-form-body">
            <section class="expense-form-section" aria-labelledby="expense-information-title">
              <h3 id="expense-information-title">Informações</h3>
              <div class="form-grid expense-form-grid">
                <label class="field">
                  <span>Data</span>
                  <input name="expenseDate" type="date" [(ngModel)]="form.expenseDate" required autofocus />
                </label>
                <label class="field expense-description-field">
                  <span>Descrição</span>
                  <input name="expenseDescription" maxlength="200" [(ngModel)]="form.description" required />
                </label>
                <label class="field">
                  <span>Categoria</span>
                  <select name="expenseFormCategory" [(ngModel)]="form.category" required>
                    @for (category of categories; track category) {
                      <option [value]="category">{{ categoryLabel(category) }}</option>
                    }
                  </select>
                </label>
                <label class="field">
                  <span>Fornecedor <small>opcional</small></span>
                  <input name="expenseSupplier" maxlength="160" [(ngModel)]="form.supplier" />
                </label>
              </div>
            </section>

            <section class="expense-form-section" aria-labelledby="expense-value-title">
              <div class="expense-section-heading">
                <h3 id="expense-value-title">Valor</h3>
                @if (stockHistoryLocked()) {
                  <span class="history-lock"><i class="pi pi-lock"></i>Histórico preservado</span>
                }
              </div>
              <div class="segmented-control expense-value-modes" aria-label="Forma de informar o valor">
                <button type="button" [class.active]="form.valueMode === 'DIRECT'" [disabled]="stockHistoryLocked()" (click)="setValueMode('DIRECT')">Valor direto</button>
                <button type="button" [class.active]="form.valueMode === 'DETAILED'" [disabled]="stockHistoryLocked()" (click)="setValueMode('DETAILED')">Compra detalhada</button>
              </div>
              @if (form.valueMode === 'DIRECT') {
                <label class="field expense-amount-field">
                  <span>Valor total</span>
                  <input name="expenseTotal" type="number" min="0.01" step="0.01" [(ngModel)]="form.totalAmount" [disabled]="stockHistoryLocked()" required />
                </label>
              } @else {
                <div class="form-grid expense-value-grid">
                  <label class="field">
                    <span>Quantidade</span>
                    <input name="expenseQuantity" type="number" min="0.001" step="0.001" [(ngModel)]="form.quantity" [disabled]="stockHistoryLocked()" required />
                  </label>
                  <label class="field">
                    <span>Unidade</span>
                    <select name="expenseUnit" [(ngModel)]="form.unit" [disabled]="stockHistoryLocked()" required>
                      @for (unit of units; track unit) {
                        <option [value]="unit">{{ unitLabel(unit) }}</option>
                      }
                    </select>
                  </label>
                  <label class="field">
                    <span>Preço unitário</span>
                    <input name="expenseUnitPrice" type="number" min="0.01" step="0.01" [(ngModel)]="form.unitPrice" [disabled]="stockHistoryLocked()" required />
                  </label>
                  <div class="expense-total-preview" aria-live="polite">
                    <span>Total calculado</span>
                    <strong>{{ currency(calculatedTotal()) }}</strong>
                    <small>{{ detailedCalculation() }}</small>
                  </div>
                </div>
              }
            </section>

            <section class="expense-form-section" aria-labelledby="expense-payment-title">
              <h3 id="expense-payment-title">Pagamento</h3>
              <div class="form-grid">
                <label class="field">
                  <span>Forma</span>
                  <select name="expenseFormPayment" [(ngModel)]="form.paymentMethod" required>
                    @for (method of paymentMethods; track method) {
                      <option [value]="method">{{ paymentLabel(method) }}</option>
                    }
                  </select>
                </label>
                <label class="field">
                  <span>Status</span>
                  <select name="expenseFormStatus" [(ngModel)]="form.status" required>
                    @for (status of statuses; track status) {
                      <option [value]="status">{{ statusLabel(status) }}</option>
                    }
                  </select>
                </label>
              </div>
            </section>

            <section class="expense-form-section" aria-labelledby="expense-stock-title">
              <h3 id="expense-stock-title">Estoque</h3>
              <label class="toggle-field expense-stock-toggle">
                <input name="expenseStockEntry" type="checkbox" [(ngModel)]="form.generateStockEntry" [disabled]="stockHistoryLocked()" />
                <span>Gerar entrada no estoque</span>
              </label>
              @if (form.generateStockEntry) {
                @if (activeStockItems().length) {
                  <div class="form-grid expense-stock-grid">
                    <label class="field">
                      <span>Item de estoque</span>
                      <select name="expenseStockItem" [(ngModel)]="form.stockItemId" [disabled]="stockHistoryLocked()" required>
                        <option [ngValue]="null" disabled>Selecione</option>
                        @for (item of activeStockItems(); track item.id) {
                          <option [ngValue]="item.id">{{ item.name }} · {{ stockValue(item) }}</option>
                        }
                      </select>
                    </label>
                    <label class="field">
                      <span>Quantidade de entrada</span>
                      <input name="expenseStockQuantity" type="number" min="0.001" step="0.001" [(ngModel)]="form.stockQuantity" [disabled]="stockHistoryLocked()" required />
                    </label>
                  </div>
                } @else {
                  <div class="expense-guidance" role="note">
                    <i class="pi pi-info-circle"></i>
                    Cadastre e ative o item na tela de Estoque antes de registrar esta entrada.
                  </div>
                }
              }
            </section>
          </div>

          <div class="modal-footer modal-actions">
            <button type="button" class="ghost-button" (click)="closeForm()">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving() || formInvalid()">
              <i class="pi pi-save"></i>
              {{ saving() ? 'Salvando...' : 'Salvar despesa' }}
            </button>
          </div>
        </form>
      </div>
    }

    @if (details(); as expense) {
      <div class="modal-backdrop">
        <section class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="expense-details-title" (dialogClose)="details.set(null)">
          <div class="modal-header">
            <div class="modal-heading">
              <span class="modal-eyebrow">Despesa #{{ expense.id }}</span>
              <h2 id="expense-details-title">{{ expense.description }}</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar detalhes" (click)="details.set(null)"><i class="pi pi-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="detail-grid expense-detail-grid">
              <div><span>Data</span><strong>{{ date(expense.expenseDate) }}</strong></div>
              <div><span>Categoria</span><strong>{{ categoryLabel(expense.category) }}</strong></div>
              <div><span>Fornecedor</span><strong>{{ expense.supplier || 'Não informado' }}</strong></div>
              <div><span>Total</span><strong>{{ currency(expense.totalAmount) }}</strong></div>
              <div><span>Pagamento</span><strong>{{ paymentLabel(expense.paymentMethod) }}</strong></div>
              <div><span>Status</span><app-status-badge [label]="statusLabel(expense.status)" [tone]="statusTone(expense.status)" /></div>
              <div><span>Quantidade</span><strong>{{ purchaseQuantity(expense) }}</strong></div>
              <div><span>Responsável</span><strong>{{ expense.createdByUserName }}</strong></div>
              <div><span>Criado em</span><strong>{{ dateTime(expense.createdAt) }}</strong></div>
            </div>
            @if (expense.stockMovementId) {
              <div class="expense-stock-detail">
                <span class="expense-stock-detail-icon"><i class="pi pi-box"></i></span>
                <div><small>Entrada no estoque</small><strong>{{ expense.stockItemName }}</strong><span>{{ stockQuantity(expense) }} · Movimento #{{ expense.stockMovementId }}</span></div>
              </div>
            }
          </div>
          <div class="modal-footer modal-actions">
            <button type="button" class="secondary-button" (click)="details.set(null); openEdit(expense)"><i class="pi pi-pencil"></i>Editar</button>
            <button type="button" class="primary-button" (click)="details.set(null)">Fechar</button>
          </div>
        </section>
      </div>
    }
  `,
})
export class ExpensesPageComponent implements OnInit {
  private readonly api = inject(ExpenseApiService);
  private readonly stockApi = inject(StockApiService);
  private readonly feedback = inject(FeedbackService);

  readonly expenses = signal<Expense[]>([]);
  readonly summary = signal<ExpenseSummary>(EMPTY_SUMMARY);
  readonly stockItems = signal<StockItem[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<Expense | null>(null);
  readonly details = signal<Expense | null>(null);

  filters = this.defaultFilters();
  form: ExpenseRequest = this.emptyForm();

  readonly categories: ExpenseCategory[] = [
    'STOCK_PURCHASE', 'FOOD', 'BEVERAGE', 'PACKAGING', 'CLEANING', 'MAINTENANCE',
    'UTILITIES', 'TRANSPORT', 'SERVICES', 'TAX', 'OTHER',
  ];
  readonly paymentMethods: ExpensePaymentMethod[] = [
    'CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'BOLETO', 'OTHER',
  ];
  readonly statuses: ExpenseStatus[] = ['PAID', 'PENDING'];
  readonly units: UnitOfMeasure[] = ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PACKAGE', 'TRAY'];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ expenses: this.api.list(this.apiFilters()), stockItems: this.stockApi.listActiveItems() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ expenses, stockItems }) => {
          this.applyResponse(expenses);
          this.stockItems.set(stockItems);
        },
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  clearFilters(): void {
    this.filters = this.defaultFilters();
    this.load();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.formOpen.set(true);
  }

  openEdit(expense: Expense): void {
    this.details.set(null);
    this.editing.set(expense);
    this.form = {
      expenseDate: expense.expenseDate,
      description: expense.description,
      category: expense.category,
      supplier: expense.supplier,
      valueMode: expense.valueMode,
      quantity: expense.quantity,
      unit: expense.unit,
      unitPrice: expense.unitPrice,
      totalAmount: expense.valueMode === 'DIRECT' ? expense.totalAmount : null,
      paymentMethod: expense.paymentMethod,
      status: expense.status,
      generateStockEntry: expense.stockMovementId != null,
      stockItemId: expense.stockItemId,
      stockQuantity: expense.stockQuantity,
    };
    this.formOpen.set(true);
  }

  openDetails(expense: Expense): void {
    this.details.set(expense);
  }

  closeForm(): void {
    if (this.saving()) return;
    this.formOpen.set(false);
    this.editing.set(null);
  }

  setValueMode(mode: ExpenseValueMode): void {
    if (this.stockHistoryLocked()) return;
    this.form.valueMode = mode;
    if (mode === 'DIRECT') {
      this.form.quantity = null;
      this.form.unit = null;
      this.form.unitPrice = null;
    } else {
      this.form.totalAmount = null;
      this.form.quantity = 1;
      this.form.unit = 'UN';
      this.form.unitPrice = null;
    }
  }

  calculatedTotal(): number {
    if (this.form.valueMode === 'DIRECT') return Number(this.form.totalAmount || 0);
    return Number(this.form.quantity || 0) * Number(this.form.unitPrice || 0);
  }

  detailedCalculation(): string {
    if (!this.form.quantity || !this.form.unitPrice) return 'Informe quantidade e preço';
    return `${this.number(this.form.quantity)} × ${this.currency(this.form.unitPrice)}`;
  }

  stockHistoryLocked(): boolean {
    return this.editing()?.stockMovementId != null;
  }

  activeStockItems(): StockItem[] {
    const selected = this.editing();
    if (selected?.stockItemId && !this.stockItems().some((item) => item.id === selected.stockItemId)) {
      return [...this.stockItems(), {
        id: selected.stockItemId,
        name: selected.stockItemName || 'Item de estoque',
        description: null,
        unit: selected.stockItemUnit || 'UN',
        currentStock: 0,
        minimumStock: 0,
        status: 'NORMAL',
        active: false,
        createdAt: selected.createdAt,
        updatedAt: selected.updatedAt,
      }];
    }
    return this.stockItems();
  }

  formInvalid(): boolean {
    const basicInvalid = !this.form.expenseDate || !this.form.description.trim();
    const valueInvalid = this.form.valueMode === 'DIRECT'
      ? Number(this.form.totalAmount) <= 0
      : Number(this.form.quantity) <= 0 || !this.form.unit || Number(this.form.unitPrice) <= 0;
    const stockInvalid = this.form.generateStockEntry
      && (!this.form.stockItemId || Number(this.form.stockQuantity) <= 0 || this.activeStockItems().length === 0);
    return basicInvalid || valueInvalid || stockInvalid;
  }

  save(): void {
    if (this.formInvalid() || this.saving()) return;
    const current = this.editing();
    const request = this.normalizedRequest();
    this.saving.set(true);
    const operation = current ? this.api.update(current.id, request) : this.api.create(request);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.feedback.success(current ? 'Despesa atualizada.' : 'Despesa registrada.');
        this.formOpen.set(false);
        this.editing.set(null);
        this.load();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  categoryLabel(category: ExpenseCategory): string {
    return ({
      STOCK_PURCHASE: 'Compra de estoque', FOOD: 'Alimentos', BEVERAGE: 'Bebidas', PACKAGING: 'Embalagens',
      CLEANING: 'Limpeza', MAINTENANCE: 'Manutenção', UTILITIES: 'Contas', TRANSPORT: 'Transporte',
      SERVICES: 'Serviços', TAX: 'Impostos/Taxas', OTHER: 'Outros',
    } satisfies Record<ExpenseCategory, string>)[category];
  }

  paymentLabel(method: ExpensePaymentMethod): string {
    return ({
      CASH: 'Dinheiro', PIX: 'PIX', DEBIT_CARD: 'Débito', CREDIT_CARD: 'Crédito',
      BANK_TRANSFER: 'Transferência', BOLETO: 'Boleto', OTHER: 'Outro',
    } satisfies Record<ExpensePaymentMethod, string>)[method];
  }

  statusLabel(status: ExpenseStatus): string {
    return status === 'PAID' ? 'Pago' : 'Pendente';
  }

  statusTone(status: ExpenseStatus): string {
    return status === 'PAID' ? 'success' : 'warning';
  }

  purchaseQuantity(expense: Expense): string {
    if (expense.quantity == null || !expense.unit) return '—';
    return `${this.number(expense.quantity)} ${unitLabel(expense.unit)}`;
  }

  stockQuantity(expense: Expense): string {
    if (expense.stockQuantity == null || !expense.stockItemUnit) return '—';
    return formatStockValue(expense.stockQuantity, expense.stockItemUnit);
  }

  stockValue(item: StockItem): string {
    return formatStockValue(item.currentStock, item.unit);
  }

  unitLabel(unit: UnitOfMeasure): string {
    return unitLabel(unit);
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  number(value: number): string {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value);
  }

  date(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  }

  dateTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }

  private applyResponse(response: ExpenseListResponse): void {
    this.expenses.set(response.items);
    this.summary.set(response.summary);
  }

  private apiFilters(): ExpenseFilters {
    return {
      from: this.filters.from || undefined,
      to: this.filters.to || undefined,
      category: this.filters.category || undefined,
      status: this.filters.status || undefined,
      paymentMethod: this.filters.paymentMethod || undefined,
      search: this.filters.search.trim() || undefined,
    };
  }

  private normalizedRequest(): ExpenseRequest {
    return {
      ...this.form,
      description: this.form.description.trim(),
      supplier: this.form.supplier?.trim() || null,
      quantity: this.form.valueMode === 'DETAILED' ? Number(this.form.quantity) : null,
      unit: this.form.valueMode === 'DETAILED' ? this.form.unit : null,
      unitPrice: this.form.valueMode === 'DETAILED' ? Number(this.form.unitPrice) : null,
      totalAmount: this.form.valueMode === 'DIRECT' ? Number(this.form.totalAmount) : null,
      stockItemId: this.form.generateStockEntry ? this.form.stockItemId : null,
      stockQuantity: this.form.generateStockEntry ? Number(this.form.stockQuantity) : null,
    };
  }

  private defaultFilters() {
    const today = new Date();
    const localDate = (date: Date) => [date.getFullYear(), `${date.getMonth() + 1}`.padStart(2, '0'), `${date.getDate()}`.padStart(2, '0')].join('-');
    return {
      from: localDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: localDate(today),
      category: '' as ExpenseCategory | '',
      status: '' as ExpenseStatus | '',
      paymentMethod: '' as ExpensePaymentMethod | '',
      search: '',
    };
  }

  private emptyForm(): ExpenseRequest {
    const today = new Date();
    const date = [today.getFullYear(), `${today.getMonth() + 1}`.padStart(2, '0'), `${today.getDate()}`.padStart(2, '0')].join('-');
    return {
      expenseDate: date,
      description: '',
      category: 'OTHER',
      supplier: null,
      valueMode: 'DIRECT',
      quantity: null,
      unit: null,
      unitPrice: null,
      totalAmount: null,
      paymentMethod: 'PIX',
      status: 'PAID',
      generateStockEntry: false,
      stockItemId: null,
      stockQuantity: null,
    };
  }
}
