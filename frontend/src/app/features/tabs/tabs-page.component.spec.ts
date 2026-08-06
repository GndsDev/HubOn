import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { PaymentApiService } from '../../core/services/payment-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { RestaurantOrder } from '../../shared/models/order.model';
import { Product } from '../../shared/models/product.model';
import { Tab } from '../../shared/models/tab.model';
import { TabsPageComponent } from './tabs-page.component';

describe('TabsPageComponent', () => {
  const tableTab: Tab = {
    id: 18,
    type: 'TABLE',
    tableId: null,
    tableNumber: 8,
    tableName: null,
    customerName: null,
    customerPhone: null,
    identificationNote: null,
    displayLabel: 'Mesa 8',
    status: 'OPEN',
    openedByUserId: 1,
    openedByUserName: 'Operadora',
    openedAt: '2026-07-31T10:00:00',
    closedAt: null,
    totalAmount: 60,
    serviceFee: 0,
    discountAmount: 0,
    finalAmount: 60,
    paidAmount: 20,
    remainingAmount: 40,
  };
  const counterTab: Tab = {
    ...tableTab,
    id: 104,
    type: 'COUNTER',
    tableNumber: null,
    displayLabel: 'Balcão #104',
  };
  const deliveredOrder: RestaurantOrder = {
    id: 210,
    tabId: 18,
    tabStatus: 'OPEN',
    tabType: 'TABLE',
    tabDisplayLabel: 'Mesa 8',
    tableId: null,
    tableNumber: 8,
    status: 'DELIVERED',
    type: 'TABLE',
    createdByUserId: 1,
    createdByUserName: 'Operadora',
    notes: null,
    confirmedAt: '2026-07-31T10:05:00',
    cancellationReason: null,
    createdAt: '2026-07-31T10:00:00',
    updatedAt: '2026-07-31T10:10:00',
    items: [{
      id: 301,
      productId: 11,
      variantId: 21,
      productNameSnapshot: 'Jantinha',
      variantNameSnapshot: 'Padrão',
      displayNameSnapshot: 'Jantinha',
      categoryNameSnapshot: 'Pratos',
      preparationFlow: 'DIRECT_SERVICE',
      unitPriceSnapshot: 60,
      quantity: 1,
      notes: null,
      status: 'DELIVERED',
      subtotal: 60,
      options: [],
      cancellationReason: null,
    }],
  };
  const product = {
    id: 11,
    name: 'Jantinha',
    active: true,
    available: true,
    complete: true,
    sellableVariantCount: 1,
    minimumVariantPrice: 60,
    maximumVariantPrice: 60,
    variants: [{
      id: 21,
      productId: 11,
      productName: 'Jantinha',
      name: 'Padrão',
      price: 60,
      active: true,
      available: true,
      displayOrder: 0,
    }],
    optionGroups: [],
  } as Product;

  const tabApi = {
    getOpen: vi.fn(() => of([tableTab, counterTab])),
    getById: vi.fn(() => of(tableTab)),
    open: vi.fn(() => of(tableTab)),
    close: vi.fn(() => of({ ...tableTab, status: 'CLOSED' as const })),
    cancel: vi.fn(() => of({ ...tableTab, status: 'CANCELLED' as const })),
  };
  const orderApi = {
    getByTab: vi.fn(() => of([deliveredOrder])),
    create: vi.fn(() => of(deliveredOrder)),
    updateDraft: vi.fn(() => of(deliveredOrder)),
    confirm: vi.fn(() => of(deliveredOrder)),
    cancel: vi.fn(() => of(deliveredOrder)),
    cancelItem: vi.fn(() => of(deliveredOrder)),
  };
  const productApi = { getAll: vi.fn(() => of([product])) };
  const paymentApi = { create: vi.fn(() => of({})) };
  const auth = { currentUser: vi.fn(() => ({ id: 1 })), hasAnyRole: vi.fn(() => true) };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  let fixture: ComponentFixture<TabsPageComponent>;
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    tabApi.getOpen.mockReturnValue(of([tableTab, counterTab]));
    tabApi.getById.mockReturnValue(of(tableTab));
    orderApi.getByTab.mockReturnValue(of([deliveredOrder]));
    productApi.getAll.mockReturnValue(of([product]));
    await TestBed.configureTestingModule({
      imports: [TabsPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: TabApiService, useValue: tabApi },
        { provide: OrderApiService, useValue: orderApi },
        { provide: ProductApiService, useValue: productApi },
        { provide: PaymentApiService, useValue: paymentApi },
        { provide: FeedbackService, useValue: feedback },
      ],
    })
      .compileComponents();
    navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TabsPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    document.getElementById('hubon-overlay-root')?.remove();
    document.body.classList.remove('hubon-overlay-open');
  });

  it('lists only table tabs and opens a new tab by table number', () => {
    const component = fixture.componentInstance;

    expect(component.tabs()).toEqual([tableTab]);
    component.form = { tableNumber: 8 };
    component.create();

    expect(tabApi.open).toHaveBeenCalledWith({ tableNumber: 8, tableId: null, serviceFee: 0, discountAmount: 0 });
    expect(navigateSpy).toHaveBeenCalledWith(['/comandas', 18]);
  });

  it('loads the detail route data and keeps payment in Comandas', () => {
    const component = fixture.componentInstance;
    component.activeTabId.set(18);
    component.refreshDetail();
    fixture.detectChanges();

    expect(tabApi.getById).toHaveBeenCalledWith(18);
    expect(orderApi.getByTab).toHaveBeenCalledWith(18);
    expect(fixture.nativeElement.textContent).toContain('Jantinha');
    expect(fixture.nativeElement.textContent).toContain('Registrar pagamento');

    component.paymentOpen.set(true);
    fixture.detectChanges();
    expect(document.querySelector('.payment-dialog')?.textContent).toContain('Mesa 8');
  });

  it('explains why closing is unavailable and allows eligible closing after full payment and delivery', () => {
    const component = fixture.componentInstance;
    component.activeTabId.set(18);
    component.refreshDetail();

    expect(component.closureIssues(tableTab)).toContain('Saldo pendente');
    expect(component.canClose(tableTab)).toBe(false);

    const paidTab = { ...tableTab, paidAmount: 60, remainingAmount: 0 };
    component.selected.set(paidTab);
    expect(component.closureIssues(paidTab)).toEqual([]);
    expect(component.canClose(paidTab)).toBe(true);
  });
});
