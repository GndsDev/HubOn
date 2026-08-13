import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseApiService } from '../../core/services/expense-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { StockApiService } from '../../core/services/stock-api.service';
import { Expense, ExpenseListResponse } from '../../shared/models/expense.model';
import { StockItem } from '../../shared/models/stock.model';
import { ExpensesPageComponent } from './expenses-page.component';

const expense: Expense = {
  id: 42,
  expenseDate: '2026-08-12',
  description: 'Compra de Cerveja Lata',
  category: 'BEVERAGE',
  supplier: 'Distribuidora Central',
  valueMode: 'DETAILED',
  quantity: 2,
  unit: 'CX',
  unitPrice: 42,
  totalAmount: 84,
  paymentMethod: 'PIX',
  status: 'PAID',
  stockItemId: 7,
  stockItemName: 'Cerveja Lata',
  stockItemUnit: 'UN',
  stockQuantity: 24,
  stockMovementId: 91,
  createdByUserId: 1,
  createdByUserName: 'Gerente',
  createdAt: '2026-08-12T10:00:00',
  updatedAt: '2026-08-12T10:00:00',
};

const response: ExpenseListResponse = {
  summary: {
    totalAmount: 1264,
    paidAmount: 1084,
    pendingAmount: 180,
    stockPurchaseAmount: 234,
    expenseCount: 4,
  },
  items: [expense],
};

const energyExpense: Expense = {
  ...expense,
  id: 43,
  description: 'Conta de energia',
  category: 'UTILITIES',
  supplier: null,
  valueMode: 'DIRECT',
  quantity: null,
  unit: null,
  unitPrice: null,
  totalAmount: 850,
  status: 'PAID',
  stockItemId: null,
  stockItemName: null,
  stockItemUnit: null,
  stockQuantity: null,
  stockMovementId: null,
};

const stockItem: StockItem = {
  id: 7,
  name: 'Cerveja Lata',
  description: null,
  unit: 'UN',
  currentStock: 34,
  minimumStock: 10,
  status: 'NORMAL',
  active: true,
  createdAt: '2026-08-01T10:00:00',
  updatedAt: '2026-08-01T10:00:00',
};

describe('ExpensesPageComponent', () => {
  const api = {
    list: vi.fn(() => of(response)),
    create: vi.fn(() => of(expense)),
    update: vi.fn(() => of(expense)),
  };
  const stockApi = { listActiveItems: vi.fn(() => of([stockItem])) };
  const feedback = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of(response));
    api.create.mockReturnValue(of(expense));
    api.update.mockReturnValue(of(expense));
    stockApi.listActiveItems.mockReturnValue(of([stockItem]));
    await TestBed.configureTestingModule({
      imports: [ExpensesPageComponent],
      providers: [
        { provide: ExpenseApiService, useValue: api },
        { provide: StockApiService, useValue: stockApi },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
  });

  function component(): ExpensesPageComponent {
    return TestBed.createComponent(ExpensesPageComponent).componentInstance;
  }

  it('loads expenses, summary and active stock items', () => {
    const instance = component();
    instance.ngOnInit();

    expect(instance.expenses()).toEqual([expense]);
    expect(instance.summary()).toEqual({
      totalAmount: 1264,
      paidAmount: 1084,
      pendingAmount: 180,
      stockPurchaseAmount: 234,
      expenseCount: 4,
    });
    expect(instance.stockItems()).toEqual([stockItem]);
    expect(instance.loading()).toBe(false);
  });

  it('sends period, category, status, payment and search filters to the backend', () => {
    const instance = component();
    instance.filters = {
      from: '2026-08-01',
      to: '2026-08-31',
      category: 'BEVERAGE',
      status: 'PENDING',
      paymentMethod: 'PIX',
      search: ' cerveja ',
    };

    instance.load();

    expect(api.list).toHaveBeenCalledWith({
      from: '2026-08-01',
      to: '2026-08-31',
      category: 'BEVERAGE',
      status: 'PENDING',
      paymentMethod: 'PIX',
      search: 'cerveja',
    });
  });

  it('calculates detailed totals in real time without sending a trusted total', () => {
    const instance = component();
    instance.openCreate();
    instance.setValueMode('DETAILED');
    instance.form.quantity = 5;
    instance.form.unitPrice = 36.9;

    expect(instance.calculatedTotal()).toBeCloseTo(184.5);
    expect(instance.detailedCalculation()).toContain('5');

    instance.form.quantity = 12.5;
    instance.form.unitPrice = 34.9;
    expect(instance.calculatedTotal()).toBeCloseTo(436.25);
  });

  it('creates a direct paid expense without a stock entry', () => {
    const instance = component();
    api.create.mockReturnValueOnce(of(energyExpense));
    instance.openCreate();
    instance.form = {
      ...instance.form,
      expenseDate: '2026-08-12',
      description: ' Conta de energia ',
      category: 'UTILITIES',
      supplier: null,
      valueMode: 'DIRECT',
      totalAmount: 850,
      paymentMethod: 'PIX',
      status: 'PAID',
      generateStockEntry: false,
    };

    instance.save();

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Conta de energia',
      totalAmount: 850,
      quantity: null,
      stockItemId: null,
      stockQuantity: null,
    }));
  });

  it('creates an expense with optional stock integration', () => {
    const instance = component();
    instance.stockItems.set([stockItem]);
    instance.openCreate();
    instance.form = {
      ...instance.form,
      expenseDate: '2026-08-12',
      description: ' Compra de Cerveja Lata ',
      category: 'BEVERAGE',
      supplier: ' Distribuidora Central ',
      valueMode: 'DETAILED',
      quantity: 2,
      unit: 'CX',
      unitPrice: 42,
      paymentMethod: 'PIX',
      status: 'PAID',
      generateStockEntry: true,
      stockItemId: 7,
      stockQuantity: 24,
    };

    instance.save();

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Compra de Cerveja Lata',
      supplier: 'Distribuidora Central',
      totalAmount: null,
      quantity: 2,
      unitPrice: 42,
      paymentMethod: 'PIX',
      status: 'PAID',
      generateStockEntry: true,
      stockItemId: 7,
      stockQuantity: 24,
    }));
    expect(feedback.success).toHaveBeenCalledWith('Despesa registrada.');
    expect(instance.formOpen()).toBe(false);
  });

  it('blocks invalid values and incomplete stock entries before calling the API', () => {
    const instance = component();
    instance.openCreate();
    instance.form.description = 'Compra incompleta';
    instance.form.totalAmount = 0;
    instance.form.generateStockEntry = true;
    instance.form.stockItemId = null;
    instance.form.stockQuantity = 0;

    expect(instance.formInvalid()).toBe(true);
    instance.save();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('shows an inactive stock error without reporting a successful expense', () => {
    const instance = component();
    api.create.mockReturnValueOnce(throwError(() => new HttpErrorResponse({
      status: 422,
      error: { message: 'Item de estoque esta inativo: Cerveja Lata' },
    })));
    instance.stockItems.set([stockItem]);
    instance.openCreate();
    instance.form = {
      ...instance.form,
      description: 'Compra de Cerveja Lata',
      category: 'BEVERAGE',
      valueMode: 'DETAILED',
      quantity: 2,
      unit: 'CX',
      unitPrice: 42,
      paymentMethod: 'PIX',
      status: 'PAID',
      generateStockEntry: true,
      stockItemId: 7,
      stockQuantity: 24,
    };

    instance.save();

    expect(feedback.error).toHaveBeenCalledWith('Item de estoque esta inativo: Cerveja Lata');
    expect(feedback.success).not.toHaveBeenCalled();
    expect(instance.formOpen()).toBe(true);
    expect(instance.saving()).toBe(false);
  });

  it('allows changing the amount of a simple expense', () => {
    const instance = component();
    api.update.mockReturnValueOnce(of({ ...energyExpense, totalAmount: 850 }));
    instance.openEdit({ ...energyExpense, totalAmount: 800 });
    instance.form.totalAmount = 850;

    expect(instance.stockHistoryLocked()).toBe(false);
    instance.save();

    expect(api.update).toHaveBeenCalledWith(43, expect.objectContaining({
      totalAmount: 850,
      generateStockEntry: false,
    }));
  });

  it('keeps linked stock history locked while allowing status updates', () => {
    const instance = component();
    instance.openEdit(expense);

    expect(instance.stockHistoryLocked()).toBe(true);
    instance.setValueMode('DIRECT');
    expect(instance.form.valueMode).toBe('DETAILED');
    instance.form.status = 'PENDING';
    instance.save();

    expect(api.update).toHaveBeenCalledWith(42, expect.objectContaining({
      status: 'PENDING',
      quantity: 2,
      unit: 'CX',
      unitPrice: 42,
      stockItemId: 7,
      stockQuantity: 24,
    }));
  });

  it('keeps the current linked item visible when it is no longer active', () => {
    const instance = component();
    instance.stockItems.set([]);
    instance.openEdit(expense);

    expect(instance.activeStockItems()).toEqual([
      expect.objectContaining({ id: 7, name: 'Cerveja Lata', active: false }),
    ]);
  });

  it('renders both desktop and compact layouts with the same current expense', () => {
    const fixture = TestBed.createComponent(ExpensesPageComponent);
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement;

    expect(page.querySelector('.expense-table')).not.toBeNull();
    expect(page.querySelector('.expense-mobile-list')).not.toBeNull();
    expect(page.textContent).toContain('Compra de Cerveja Lata');
    expect(page.textContent).toContain('R$\u00a01.264,00');
  });

  it('shows API errors and translates statuses', () => {
    const instance = component();
    api.list.mockReturnValueOnce(throwError(() => ({ error: { message: 'Falha controlada' } })));

    instance.load();

    expect(instance.error()).toBeTruthy();
    expect(instance.loading()).toBe(false);
    expect(instance.statusLabel('PAID')).toBe('Pago');
    expect(instance.statusLabel('PENDING')).toBe('Pendente');
  });
});
