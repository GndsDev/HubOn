import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderApiService } from '../../core/services/order-api.service';
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

  const deliveredTableOrder: RestaurantOrder = {
    id: 211,
    tabId: 105,
    tabStatus: 'CLOSED',
    tabType: 'TABLE',
    tabDisplayLabel: 'Mesa 8',
    tableId: null,
    tableNumber: 8,
    status: 'DELIVERED',
    type: 'TABLE',
    createdByUserId: 1,
    createdByUserName: 'Garçom',
    notes: 'Sem talheres',
    confirmedAt: '2026-07-31T11:05:00',
    cancellationReason: null,
    createdAt: '2026-07-31T11:00:00',
    updatedAt: '2026-07-31T11:30:00',
    items: [
      {
        id: 303,
        productId: 13,
        variantId: 23,
        productNameSnapshot: 'Hambúrguer',
        variantNameSnapshot: 'Padrão',
        displayNameSnapshot: 'Hambúrguer',
        categoryNameSnapshot: 'Lanches',
        preparationFlow: 'REQUIRES_PREPARATION',
        unitPriceSnapshot: 30,
        quantity: 1,
        notes: null,
        status: 'DELIVERED',
        subtotal: 30,
        options: [],
        cancellationReason: null,
      },
    ],
  };

  const counterSale: CounterSaleSummary = {
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
  let fixture: ComponentFixture<OrdersPageComponent>;

  const auth = {
    currentUser: vi.fn(() => currentUser),
  };

  const orderApi = {
    getAll: vi.fn(() =>
      of([
        mixedOrder,
        deliveredTableOrder,
      ]),
    ),

    getPreparationQueue: vi.fn(() =>
      of([mixedOrder]),
    ),
  };

  const tabApi = {
    getActiveCounterSales: vi.fn(() =>
      of([counterSale]),
    ),
  };

  const feedback = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    currentUser = {
      id: 1,
      name: 'Dona',
      email: 'dona@hubon.local',
      active: true,
      roles: ['OWNER'],
    };

    orderApi.getAll.mockReturnValue(
      of([
        mixedOrder,
        deliveredTableOrder,
      ]),
    );

    orderApi.getPreparationQueue.mockReturnValue(
      of([mixedOrder]),
    );

    tabApi.getActiveCounterSales.mockReturnValue(
      of([counterSale]),
    );

    await TestBed.configureTestingModule({
      imports: [OrdersPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: auth,
        },
        {
          provide: OrderApiService,
          useValue: orderApi,
        },
        {
          provide: TabApiService,
          useValue: tabApi,
        },
        {
          provide: FeedbackService,
          useValue: feedback,
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  function createFixture(): ComponentFixture<OrdersPageComponent> {
    fixture = TestBed.createComponent(
      OrdersPageComponent,
    );

    fixture.detectChanges();

    return fixture;
  }

  it('carrega o histórico completo para proprietário', () => {
    const current = createFixture();
    const text = current.nativeElement.textContent as string;

    expect(orderApi.getAll).toHaveBeenCalledTimes(1);
    expect(
      orderApi.getPreparationQueue,
    ).not.toHaveBeenCalled();

    expect(
      tabApi.getActiveCounterSales,
    ).toHaveBeenCalledTimes(1);

    expect(text).toContain('Histórico de pedidos');
    expect(text).toContain('Jantinha');
    expect(text).toContain('Refrigerante - Lata');
    expect(text).toContain('Hambúrguer');
    expect(text).toContain('Itens de preparo');
    expect(text).toContain('Entrega direta');
    expect(text).toContain('Ver atendimento');
    expect(text).toContain('Ver comanda');
    expect(text).toContain('R$');
  });

  it('não exibe ações operacionais no histórico', () => {
    const current = createFixture();
    const text = current.nativeElement.textContent as string;

    expect(text).not.toContain(
      'Novo pedido de mesa',
    );

    expect(text).not.toContain(
      'Editar rascunho',
    );

    expect(text).not.toContain(
      'Confirmar pedido',
    );

    expect(text).not.toContain(
      'Marcar como pronto',
    );

    expect(text).not.toContain(
      'Marcar como entregue',
    );

    expect(text).not.toContain(
      'Cancelar item',
    );

    expect(text).not.toContain(
      'Cancelar pedido',
    );

    expect(text).not.toContain(
      'Registrar pagamento',
    );
  });

  it('usa somente a fila de preparo para o perfil KITCHEN', () => {
    currentUser = {
      id: 2,
      name: 'Preparo',
      email: 'preparo@hubon.local',
      active: true,
      roles: ['KITCHEN'],
    };

    const current = createFixture();
    const text = current.nativeElement.textContent as string;

    expect(
      orderApi.getPreparationQueue,
    ).toHaveBeenCalledTimes(1);

    expect(
      orderApi.getAll,
    ).not.toHaveBeenCalled();

    expect(
      tabApi.getActiveCounterSales,
    ).not.toHaveBeenCalled();

    expect(text).toContain('Jantinha');

    expect(text).not.toContain(
      'Refrigerante - Lata',
    );

    expect(text).not.toContain('R$');
    expect(text).not.toContain('Financeiro:');
    expect(text).not.toContain('Ver atendimento');
    expect(text).not.toContain('Ver comanda');
    expect(text).not.toContain('Marcar como pronto');
    expect(text).not.toContain('Marcar como entregue');
  });

  it('filtra os pedidos entregues', () => {
    const current = createFixture();

    current.componentInstance.activeFilter.set(
      'DELIVERED',
    );

    current.detectChanges();

    const text = current.nativeElement.textContent as string;

    expect(text).toContain('Hambúrguer');
    expect(text).toContain('Pedido #211');

    expect(text).not.toContain('Jantinha');
    expect(text).not.toContain('Pedido #210');
  });

  it('filtra os pedidos por origem', () => {
    const current = createFixture();

    current.componentInstance.activeFilter.set(
      'TABLE',
    );

    current.detectChanges();

    let text = current.nativeElement.textContent as string;

    expect(text).toContain('Mesa 8');
    expect(text).not.toContain('Balcão #104 - Ana');

    current.componentInstance.activeFilter.set(
      'COUNTER',
    );

    current.detectChanges();

    text = current.nativeElement.textContent as string;

    expect(text).toContain('Balcão #104 - Ana');
    expect(text).not.toContain('Mesa 8');
  });

  it('atualiza os dados sem voltar ao carregamento inicial', () => {
    const current = createFixture();

    expect(
      current.componentInstance.loading(),
    ).toBe(false);

    orderApi.getAll.mockReturnValue(
      of([deliveredTableOrder]),
    );

    current.componentInstance.load();
    current.detectChanges();

    expect(orderApi.getAll).toHaveBeenCalledTimes(2);

    expect(
      current.componentInstance.loading(),
    ).toBe(false);

    expect(
      current.componentInstance.refreshing(),
    ).toBe(false);

    expect(
      current.componentInstance.orders(),
    ).toEqual([deliveredTableOrder]);
  });
});
