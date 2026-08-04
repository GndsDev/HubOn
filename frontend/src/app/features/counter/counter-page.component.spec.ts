import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CounterActivityService } from '../../core/services/counter-activity.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { PaymentApiService } from '../../core/services/payment-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { RestaurantOrder } from '../../shared/models/order.model';
import { Product } from '../../shared/models/product.model';
import { CounterSaleDetail, CounterSaleSummary, Tab } from '../../shared/models/tab.model';
import { CounterPageComponent } from './counter-page.component';

describe('CounterPageComponent', () => {
  const product: Product = {
    id: 10,
    categoryId: 1,
    categoryName: 'Bebidas',
    categoryActive: true,
    name: 'Suco',
    description: null,
    preparationFlow: 'DIRECT_SERVICE',
    active: true,
    available: true,
    displayOrder: 1,
    imageUrl: null,
    variantCount: 1,
    activeVariantCount: 1,
    sellableVariantCount: 1,
    minimumVariantPrice: 8,
    maximumVariantPrice: 8,
    hasAutomaticStockLink: false,
    complete: true,
    variants: [{
      id: 20, productId: 10, productName: 'Suco', name: 'Copo', sku: null, price: 8,
      active: true, available: true, displayOrder: 1, stockLinkActive: false, stockLinkId: null,
      stockItemId: null, stockItemName: null, quantityPerSale: null, createdAt: '', updatedAt: '',
    }],
    optionGroups: [{
      id: 30, productId: 10, name: 'Açúcar', required: true, minimumSelections: 1,
      maximumSelections: 1, displayOrder: 1, active: true,
      options: [{
        id: 40, groupId: 30, name: 'Sem açúcar', additionalPrice: 0,
        displayOrder: 1, active: true, createdAt: '', updatedAt: '',
      }],
      createdAt: '', updatedAt: '',
    }],
    createdAt: '', updatedAt: '',
  };

  const summary: CounterSaleSummary = {
    id: 50,
    number: 50,
    displayLabel: 'Balcão #50 - Ana',
    customerName: 'Ana',
    openedAt: '2026-07-30T10:00:00',
    closedAt: null,
    openedByUserName: 'Operadora',
    tabStatus: 'OPEN',
    totalAmount: 0,
    paidAmount: 0,
    remainingAmount: 0,
    itemCount: 2,
    draftItemCount: 2,
    waitingItemCount: 0,
    inPreparationItemCount: 0,
    readyItemCount: 0,
    deliveredItemCount: 0,
    attendanceState: 'ASSEMBLING',
    preparationState: 'NOT_APPLICABLE',
    financialState: 'UNPAID',
    nextAction: 'CONFIRM_ORDER',
    cancellationAllowed: true,
  };

  const draftOrder: RestaurantOrder = {
    id: 60,
    tabId: 50,
    tabStatus: 'OPEN',
    tabType: 'COUNTER',
    tabDisplayLabel: 'Balcão #50 - Ana',
    tableId: null,
    tableNumber: null,
    status: 'CREATED',
    type: 'COUNTER',
    createdByUserId: 1,
    createdByUserName: 'Operadora',
    notes: null,
    confirmedAt: null,
    cancellationReason: null,
    createdAt: '2026-07-30T10:00:00',
    updatedAt: '2026-07-30T10:00:00',
    items: [{
      id: 70,
      productId: 10,
      variantId: 20,
      productNameSnapshot: 'Suco',
      variantNameSnapshot: 'Copo',
      displayNameSnapshot: 'Suco - Copo',
      categoryNameSnapshot: 'Bebidas',
      preparationFlow: 'DIRECT_SERVICE',
      unitPriceSnapshot: 8,
      quantity: 2,
      notes: 'Sem gelo',
      status: 'DRAFT',
      subtotal: 16,
      options: [{ id: 80, optionId: 40, groupName: 'Açúcar', optionName: 'Sem açúcar', additionalPrice: 0 }],
      cancellationReason: null,
    }],
  };

  const detail: CounterSaleDetail = {
    summary,
    customerPhone: '11999999999',
    identificationNote: 'Retirada no balcão',
    orders: [draftOrder],
  };

  const openTab: Tab = {
    id: 50, type: 'COUNTER', tableId: null, tableNumber: null, tableName: null,
    customerName: null, customerPhone: null, identificationNote: null, displayLabel: 'Balcão #50',
    status: 'OPEN', openedByUserId: 1, openedByUserName: 'Operadora', openedAt: '', closedAt: null,
    totalAmount: 0, serviceFee: 0, discountAmount: 0, finalAmount: 0, paidAmount: 0, remainingAmount: 0,
  };

  let routeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const productApi = { getAll: vi.fn(() => of([product])) };
  const tabApi = {
    getActiveCounterSales: vi.fn(() => of([summary])),
    getCounterSalesFinishedToday: vi.fn(() => of([])),
    getCounterHistory: vi.fn(() => of([])),
    getCounterSale: vi.fn(() => of(detail)),
    openCounter: vi.fn(() => of(openTab)),
    updateCounterSale: vi.fn(() => of(detail)),
    finishCounterSale: vi.fn(() => of(detail)),
    cancel: vi.fn(() => of({ ...openTab, status: 'CANCELLED' as const })),
  };
  const orderApi = {
    create: vi.fn(() => of(draftOrder)),
    updateDraft: vi.fn(() => of(draftOrder)),
    confirm: vi.fn(() => of({ ...draftOrder, status: 'READY' as const })),
    updateStatus: vi.fn(() => of({ ...draftOrder, status: 'DELIVERED' as const })),
    updateItemStatus: vi.fn(() => of({ ...draftOrder, status: 'DELIVERED' as const })),
    cancel: vi.fn(() => of({ ...draftOrder, status: 'CANCELLED' as const })),
  };
  const paymentApi = { create: vi.fn(() => of({})) };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const activity = { refresh: vi.fn() };
  const router = { navigate: vi.fn(), navigateByUrl: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    productApi.getAll.mockReturnValue(of([product]));
    tabApi.getActiveCounterSales.mockReturnValue(of([summary]));
    tabApi.getCounterSalesFinishedToday.mockReturnValue(of([]));
    tabApi.getCounterHistory.mockReturnValue(of([]));
    tabApi.getCounterSale.mockReturnValue(of(detail));
    tabApi.openCounter.mockReturnValue(of(openTab));
    tabApi.updateCounterSale.mockReturnValue(of(detail));
    tabApi.finishCounterSale.mockReturnValue(of(detail));
    orderApi.create.mockReturnValue(of(draftOrder));
    orderApi.updateDraft.mockReturnValue(of(draftOrder));
    orderApi.confirm.mockReturnValue(of({ ...draftOrder, status: 'READY' as const }));
    orderApi.updateStatus.mockReturnValue(of({ ...draftOrder, status: 'DELIVERED' as const }));
    orderApi.updateItemStatus.mockReturnValue(of({ ...draftOrder, status: 'DELIVERED' as const }));
    paymentApi.create.mockReturnValue(of({}));
    routeParams = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [CounterPageComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: routeParams.asObservable() } },
        { provide: Router, useValue: router },
        { provide: ProductApiService, useValue: productApi },
        { provide: TabApiService, useValue: tabApi },
        { provide: OrderApiService, useValue: orderApi },
        { provide: PaymentApiService, useValue: paymentApi },
        { provide: CounterActivityService, useValue: activity },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
  });

  function createComponent(counterTabId?: number): CounterPageComponent {
    return createFixture(counterTabId).componentInstance;
  }

  function createFixture(counterTabId?: number): ComponentFixture<CounterPageComponent> {
    if (counterTabId) routeParams.next(convertToParamMap({ counterTabId }));
    const fixture = TestBed.createComponent(CounterPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows active sales in the counter center and creates a persistent tab before navigating', () => {
    const component = createComponent();

    expect(component.activeSales()).toEqual([summary]);
    component.startSale();

    expect(tabApi.openCounter).toHaveBeenCalledWith({
      customerName: null,
      customerPhone: null,
      identificationNote: null,
      serviceFee: 0,
      discountAmount: 0,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/balcao', 50]);
  });

  it('restores a saved draft from the backend when opening the sale URL', () => {
    const component = createComponent(50);

    expect(tabApi.getCounterSale).toHaveBeenCalledWith(50);
    expect(component.saleId()).toBe(50);
    expect(component.cart()).toHaveLength(1);
    expect(component.cart()[0]).toMatchObject({ productId: 10, variantId: 20, quantity: 2, notes: 'Sem gelo' });
    expect(component.customer.name).toBe('Ana');
  });

  it('keeps long category buttons whole inside an accessible horizontal strip', () => {
    productApi.getAll.mockReturnValue(of([
      product,
      { ...product, id: 11, name: 'Carreteiro', categoryName: 'Carreteiro Completo' },
      { ...product, id: 12, name: 'Espetinho', categoryName: 'Espetinhos - Diversos' },
    ]));
    const fixture = createFixture(50);
    const component = fixture.componentInstance;
    const nativeElement = fixture.nativeElement as HTMLElement;
    const shell = nativeElement.querySelector('.counter-category-filter-shell') as HTMLElement;
    const buttons = Array.from(
      nativeElement.querySelectorAll<HTMLButtonElement>('.counter-category-filter button'),
    );

    expect(shell.getAttribute('aria-label')).toBe('Filtrar produtos por categoria');
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Todos',
      'Bebidas',
      'Carreteiro Completo',
      'Espetinhos - Diversos',
    ]);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');

    buttons[2].click();
    fixture.detectChanges();
    expect(component.categoryFilter).toBe('Carreteiro Completo');
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
  });

  it('persists quantity changes and confirms the existing draft without recreating the sale', () => {
    const component = createComponent(50);
    const key = component.cart()[0].key;

    component.changeQuantity(key, 1);
    expect(orderApi.updateDraft).toHaveBeenCalledWith(60, expect.objectContaining({
      tabId: 50,
      items: [expect.objectContaining({ productId: 10, quantity: 3 })],
    }));
    expect(orderApi.create).not.toHaveBeenCalled();

    component.confirmOrder();
    expect(orderApi.confirm).toHaveBeenCalledWith(60);
  });

  it('keeps a paid sale in preparation active with one clear primary action', () => {
    const preparationOrder: RestaurantOrder = {
      ...draftOrder,
      status: 'PREPARING',
      items: [{ ...draftOrder.items[0], status: 'IN_PREPARATION', preparationFlow: 'REQUIRES_PREPARATION' }],
    };
    tabApi.getCounterSale.mockReturnValue(of({
      ...detail,
      summary: {
        ...summary,
        totalAmount: 16,
        paidAmount: 16,
        remainingAmount: 0,
        draftItemCount: 0,
        inPreparationItemCount: 2,
        attendanceState: 'IN_PROGRESS',
        preparationState: 'IN_PREPARATION',
        financialState: 'PAID',
        nextAction: 'FOLLOW_PREPARATION',
        cancellationAllowed: false,
      },
      orders: [preparationOrder],
    }));

    const fixture = createFixture(50);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Acompanhar preparo');
    expect(text).toContain('Marque cada item como pronto');
    expect(text).toContain('Marcar como pronto');
    expect(text).not.toContain('Iniciar preparo');
    expect(text).not.toContain('Finalizar venda');
    expect(fixture.nativeElement.querySelectorAll('.counter-primary-action')).toHaveLength(0);
  });

  it('registers a partial payment without closing or leaving the active sale', () => {
    const payableDetail: CounterSaleDetail = {
      ...detail,
      summary: {
        ...summary,
        totalAmount: 16,
        paidAmount: 6,
        remainingAmount: 10,
        draftItemCount: 0,
        readyItemCount: 2,
        attendanceState: 'CONFIRMED',
        preparationState: 'NOT_APPLICABLE',
        financialState: 'PARTIALLY_PAID',
        nextAction: 'COMPLETE_PAYMENT',
      },
      orders: [{ ...draftOrder, status: 'READY' }],
    };
    tabApi.getCounterSale.mockReturnValue(of(payableDetail));
    const component = createComponent(50);

    component.paymentOpen.set(true);
    component.onPaymentCompleted();

    expect(component.paymentOpen()).toBe(false);
    expect(tabApi.getCounterSale).toHaveBeenCalledWith(50);
    expect(activity.refresh).toHaveBeenCalled();
    expect(tabApi.finishCounterSale).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('delivers ready orders and finalizes the sale in separate operations', () => {
    const readyOrder: RestaurantOrder = {
      ...draftOrder,
      status: 'READY',
      items: [{ ...draftOrder.items[0], status: 'READY' }],
    };
    const readyDetail: CounterSaleDetail = {
      ...detail,
      summary: {
        ...summary,
        totalAmount: 16,
        paidAmount: 16,
        remainingAmount: 0,
        draftItemCount: 0,
        readyItemCount: 2,
        attendanceState: 'IN_PROGRESS',
        preparationState: 'READY',
        financialState: 'PAID',
        nextAction: 'DELIVER',
        cancellationAllowed: false,
      },
      orders: [readyOrder],
    };
    tabApi.getCounterSale.mockReturnValue(of(readyDetail));
    const component = createComponent(50);

    component.deliverItem(60, 70);

    expect(orderApi.updateItemStatus).toHaveBeenCalledWith(60, 70, 'DELIVERED');
    expect(tabApi.finishCounterSale).not.toHaveBeenCalled();

    component.detail.set({
      ...readyDetail,
      summary: {
        ...readyDetail.summary,
        readyItemCount: 0,
        deliveredItemCount: 2,
        attendanceState: 'READY_TO_FINISH',
        preparationState: 'DELIVERED',
        nextAction: 'FINALIZE',
      },
      orders: [{ ...readyOrder, status: 'DELIVERED' }],
    });
    component.finalizeSale();

    expect(tabApi.finishCounterSale).toHaveBeenCalledWith(50);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/balcao');
  });

  it('loads filtered history separately from active and finished-today sales', () => {
    const component = createComponent();
    component.historyFilters = { from: '2026-07-01', to: '2026-07-30', number: 104, customer: 'Ana', status: 'CLOSED', operator: 'Operadora' };

    component.selectCenterView('HISTORY');

    expect(tabApi.getCounterHistory).toHaveBeenCalledWith(component.historyFilters);
    expect(component.centerView()).toBe('HISTORY');
    expect(component.emptyCenterTitle()).toBe('Nenhum atendimento encontrado');
  });
});
