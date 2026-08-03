import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { PaymentApiService } from '../../core/services/payment-api.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { TableApiService } from '../../core/services/table-api.service';
import { Tab } from '../../shared/models/tab.model';
import { TabsPageComponent } from './tabs-page.component';

describe('TabsPageComponent', () => {
  const tableTab: Tab = {
    id: 18,
    type: 'TABLE',
    tableId: 8,
    tableNumber: 8,
    tableName: 'Varanda',
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
    serviceFee: 6,
    discountAmount: 0,
    finalAmount: 66,
    paidAmount: 20,
    remainingAmount: 46,
  };
  const counterTab: Tab = {
    ...tableTab,
    id: 104,
    type: 'COUNTER',
    tableId: null,
    tableNumber: null,
    tableName: null,
    displayLabel: 'Balcão #104',
  };

  const tabApi = {
    getOpen: vi.fn(() => of([tableTab, counterTab])),
    getById: vi.fn(() => of(tableTab)),
    open: vi.fn(() => of(tableTab)),
    close: vi.fn(() => of({ ...tableTab, status: 'CLOSED' as const })),
    cancel: vi.fn(() => of({ ...tableTab, status: 'CANCELLED' as const })),
  };
  const tableApi = { getAll: vi.fn(() => of([])) };
  const paymentApi = { create: vi.fn(() => of({})) };
  const auth = { currentUser: vi.fn(() => ({ id: 1 })), hasAnyRole: vi.fn(() => true) };
  const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  let fixture: ComponentFixture<TabsPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    tabApi.getOpen.mockReturnValue(of([tableTab, counterTab]));
    tabApi.getById.mockReturnValue(of(tableTab));
    tableApi.getAll.mockReturnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [TabsPageComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: AuthService, useValue: auth },
        { provide: TabApiService, useValue: tabApi },
        { provide: TableApiService, useValue: tableApi },
        { provide: PaymentApiService, useValue: paymentApi },
        { provide: FeedbackService, useValue: feedback },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TabsPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    document.getElementById('hubon-overlay-root')?.remove();
    document.body.classList.remove('hubon-overlay-open');
  });

  it('keeps counter sales out of Comandas and opens the shared payment dialog inside a table tab', () => {
    const component = fixture.componentInstance;

    expect(component.tabs()).toEqual([tableTab]);
    component.showDetails(tableTab);
    fixture.detectChanges();
    expect(document.body.textContent).toContain('Completar pagamento');

    component.paymentOpen.set(true);
    fixture.detectChanges();

    const paymentDialog = document.querySelector('.payment-dialog');
    expect(paymentDialog).not.toBeNull();
    expect(paymentDialog?.textContent).toContain('Mesa 8');
    expect(paymentDialog?.textContent).toContain('Restante');
  });

  it('uses semantic modal regions and clear financial emphasis in tab details', () => {
    const unpaidTab = { ...tableTab, paidAmount: 0, remainingAmount: tableTab.finalAmount };
    tabApi.getById.mockReturnValueOnce(of(unpaidTab));
    fixture.componentInstance.showDetails(unpaidTab);
    fixture.detectChanges();

    const dialog = document.querySelector('[aria-labelledby="tab-details-dialog-title"]') as HTMLElement;
    expect(dialog.querySelector(':scope > .modal-header')).not.toBeNull();
    expect(dialog.querySelector(':scope > .modal-body')).not.toBeNull();
    expect(dialog.querySelector(':scope > .modal-footer')).not.toBeNull();
    expect(dialog.querySelectorAll('.financial-detail')).toHaveLength(6);
    expect(dialog.querySelector('.financial-detail.total')?.textContent).toContain('Total final');
    expect(dialog.querySelector('.financial-detail.paid')?.textContent).toContain('Pago');
    expect(dialog.querySelector('.financial-detail.remaining')?.textContent).toContain('Restante');
    expect(dialog.querySelector('.secondary-danger')?.textContent).toContain('Cancelar comanda');
    expect(dialog.querySelector('.primary-button')?.textContent).toContain('Registrar pagamento');
  });
});
