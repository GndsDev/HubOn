import { TestBed } from '@angular/core/testing';
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
  description: 'Compra de Coca-Cola',
  category: 'BEVERAGE',
  supplier: 'Distribuidora local',
  valueMode: 'DETAILED',
  quantity: 2,
  unit: 'CX',
  unitPrice: 60,
  totalAmount: 120,
  paymentMethod: 'PIX',
  status: 'PENDING',
  stockItemId: 7,
  stockItemName: 'Coca-Cola 350ml',
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
    totalAmount: 120,
    paidAmount: 0,
    pendingAmount: 120,
    stockPurchaseAmount: 120,
    expenseCount: 1,
  },
  items: [expense],
};

const stockItem: StockItem = {
  id: 7,
  name: 'Coca-Cola 350ml',
  description: null,
  unit: 'UN',
  currentStock: 24,
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
    expect(instance.summary().pendingAmount).toBe(120);
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
      search: ' coca ',
    };

    instance.load();

    expect(api.list).toHaveBeenCalledWith({
      from: '2026-08-01',
      to: '2026-08-31',
      category: 'BEVERAGE',
      status: 'PENDING',
      paymentMethod: 'PIX',
      search: 'coca',
    });
  });

  it('calculates detailed totals in real time without sending a trusted total', () => {
    const instance = component();
    instance.openCreate();
    instance.setValueMode('DETAILED');
    instance.form.quantity = 2.5;
    instance.form.unitPrice = 12.34;

    expect(instance.calculatedTotal()).toBeCloseTo(30.85);
    expect(instance.detailedCalculation()).toContain('2,5');
  });

  it('creates an expense with optional stock integration', () => {
    const instance = component();
    instance.stockItems.set([stockItem]);
    instance.openCreate();
    instance.form = {
      ...instance.form,
      expenseDate: '2026-08-12',
      description: ' Compra de Coca-Cola ',
      category: 'BEVERAGE',
      valueMode: 'DETAILED',
      quantity: 2,
      unit: 'CX',
      unitPrice: 60,
      paymentMethod: 'PIX',
      status: 'PENDING',
      generateStockEntry: true,
      stockItemId: 7,
      stockQuantity: 24,
    };

    instance.save();

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Compra de Coca-Cola',
      totalAmount: null,
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

  it('keeps linked stock history locked while allowing status updates', () => {
    const instance = component();
    instance.openEdit(expense);

    expect(instance.stockHistoryLocked()).toBe(true);
    instance.form.status = 'PAID';
    instance.save();

    expect(api.update).toHaveBeenCalledWith(42, expect.objectContaining({
      status: 'PAID',
      stockItemId: 7,
      stockQuantity: 24,
    }));
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
