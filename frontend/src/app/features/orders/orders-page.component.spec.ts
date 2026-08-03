import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { RestaurantOrder } from '../../shared/models/order.model';
import { CounterSaleSummary } from '../../shared/models/tab.model';
import { User } from '../../shared/models/user.model';
import { OrdersPageComponent } from './orders-page.component';

describe('OrdersPageComponent', () => {
  const mixedOrder: RestaurantOrder = {
    id: 210,
    tabId: 104,
    tabStatus: 'OPEN',
    tabType: 'COUNTER',
    tabDisplayLabel: 'Balcão #104 - Ana',
    tableId: null,
    tableNumber: null,
    status: 'PREPARING',
    type: 'COUNTER',
    createdByUserId: 1,
    createdByUserName: 'Operadora',
    notes: null,
    confirmedAt: '2026-07-31T10:05:00',
    cancellationReason: null,
    createdAt: '2026-07-31T10:00:00',
    updatedAt: '2026-07-31T10:10:00',
    items: [
      {
        id: 301,
        productId: 11,
        variantId: 21,
        productNameSnapshot: 'Jantinha',
        variantNameSnapshot: 'Padrão',
        displayNameSnapshot: 'Jantinha',
        categoryNameSnapshot: 'Pratos',
        preparationFlow: 'REQUIRES_PREPARATION',
        unitPriceSnapshot: 25,
        quantity: 1,
        notes: null,
        status: 'IN_PREPARATION',
        subtotal: 25,
        options: [],
        cancellationReason: null,
      },
      {
        id: 302,
        productId: 12,
        variantId: 22,
        productNameSnapshot: 'Refrigerante',
        variantNameSnapshot: 'Lata',
        displayNameSnapshot: 'Refrigerante - Lata',
        categoryNameSnapshot: 'Bebidas',
        preparationFlow: 'DIRECT_SERVICE',
        unitPriceSnapshot: 7,
        quantity: 1,
        notes: null,
        status: 'READY',
        subtotal: 7,
        options: [],
        cancellationReason: null,
      },
    ],
  };

  const sale: CounterSaleSummary = {
    id: 104,
    number: 104,
    displayLabel: 'Balcão #104 - Ana',
    customerName: 'Ana',
    openedAt: '2026-07-31T10:00:00',
    closedAt: null,
    openedByUserName: 'Operadora',
    tabStatus: 'OPEN',
    totalAmount: 32,
    paidAmount: 32,
    remainingAmount: 0,
    itemCount: 2,
    draftItemCount: 0,
    waitingItemCount: 0,
    inPreparationItemCount: 1,
    readyItemCount: 1,
    deliveredItemCount: 0,
    attendanceState: 'IN_PROGRESS',
    preparationState: 'PARTIALLY_READY',
    financialState: 'PAID',
    nextAction: 'FOLLOW_PREPARATION',
    cancellationAllowed: false,
  };

  let currentUser: User;
  const auth = { currentUser: vi.fn(() => currentUser) };
  const orderApi = {
    getAll: vi.fn(() => of([mixedOrder])),
    getPreparationQueue: vi.fn(() => of([mixedOrder])),
    updateItemStatus: vi.fn(() => of(mixedOrder)),
    create: vi.fn(() => of(mixedOrder)),
    updateDraft: vi.fn(() => of(mixedOrder)),
    confirm: vi.fn(() => of(mixedOrder)),
    cancel: vi.fn(() => of(mixedOrder)),
    cancelItem: vi.fn(() => of(mixedOrder)),
  };
  const tabApi = {
    getOpen: vi.fn(() => of([])),
    getActiveCounterSales: vi.fn(() => of([sale])),
  };
  const productApi = { getAll: vi.fn(() => of([])) };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  let fixture: ComponentFixture<OrdersPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    currentUser = { id: 1, name: 'Dona', email: 'dona@hubon.local', active: true, roles: ['OWNER'] };
    orderApi.getAll.mockReturnValue(of([mixedOrder]));
    orderApi.getPreparationQueue.mockReturnValue(of([mixedOrder]));
    orderApi.updateItemStatus.mockReturnValue(of(mixedOrder));
    tabApi.getOpen.mockReturnValue(of([]));
    tabApi.getActiveCounterSales.mockReturnValue(of([sale]));
    productApi.getAll.mockReturnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [OrdersPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: OrderApiService, useValue: orderApi },
        { provide: TabApiService, useValue: tabApi },
        { provide: ProductApiService, useValue: productApi },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    document.getElementById('hubon-overlay-root')?.remove();
  });

  function createFixture(): ComponentFixture<OrdersPageComponent> {
    fixture = TestBed.createComponent(OrdersPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('separates prepared and direct items and exposes only operational actions', () => {
    const current = createFixture();
    const text = current.nativeElement.textContent as string;

    expect(text).toContain('Itens de preparo');
    expect(text).toContain('Entrega direta');
    expect(text).toContain('Marcar como pronto');
    expect(text).toContain('Marcar como entregue');
    expect(text).not.toContain('Registrar pagamento');
    expect(text).not.toContain('Iniciar preparo');

    current.componentInstance.markReady(mixedOrder, mixedOrder.items[0]);
    expect(orderApi.updateItemStatus).toHaveBeenCalledWith(210, 301, 'READY');
  });

  it('uses the filtered preparation queue for KITCHEN and hides financial and direct-service data', () => {
    currentUser = { id: 2, name: 'Preparo', email: 'preparo@hubon.local', active: true, roles: ['KITCHEN'] };
    const current = createFixture();
    const text = current.nativeElement.textContent as string;

    expect(orderApi.getPreparationQueue).toHaveBeenCalled();
    expect(orderApi.getAll).not.toHaveBeenCalled();
    expect(tabApi.getOpen).not.toHaveBeenCalled();
    expect(productApi.getAll).not.toHaveBeenCalled();
    expect(text).toContain('Jantinha');
    expect(text).toContain('Marcar como pronto');
    expect(text).not.toContain('Refrigerante');
    expect(text).not.toContain('R$');
    expect(text).not.toContain('Marcar como entregue');
    expect(text).not.toContain('Novo pedido de mesa');
  });
});
