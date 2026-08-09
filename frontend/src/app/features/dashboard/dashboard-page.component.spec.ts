import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardApiService } from '../../core/services/dashboard-api.service';
import { DashboardSummary } from '../../shared/models/dashboard.model';
import { DashboardPageComponent } from './dashboard-page.component';

const summary: DashboardSummary = {
  todaySales: 320,
  openSales: 3,
  openTableSales: 2,
  openCounterSales: 1,
  pendingPayments: 2,
  averageTicket: 80,
  cashSummary: { received: 240, openAmount: 80, cancelledAmount: 0 },
  recentSales: [{ id: 9, tableNumber: 2, originLabel: 'Mesa 2', status: 'CLOSED', amount: 80, createdAt: '2026-08-07T12:00:00' }],
};

describe('DashboardPageComponent', () => {
  const api = { getSummary: vi.fn(() => of(summary)) };
  let fixture: ComponentFixture<DashboardPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getSummary.mockReturnValue(of(summary));
    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [provideRouter([]), { provide: DashboardApiService, useValue: api }],
    }).compileComponents();
  });

  function createFixture(): ComponentFixture<DashboardPageComponent> {
    fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the simplified sales summary without salao indicators', () => {
    const instance = createFixture().componentInstance;

    expect(api.getSummary).toHaveBeenCalledOnce();
    expect(instance.summary()).toEqual(summary);
    expect(fixture.nativeElement.textContent).toContain('Comandas abertas');
    expect(fixture.nativeElement.textContent).not.toContain('Salao');
    fixture.destroy();
  });

  it('uses one shared action primitive on every dashboard stat card', () => {
    createFixture();

    const actions = (fixture.nativeElement as HTMLElement).querySelectorAll('.dashboard-card-action');
    expect(actions).toHaveLength(4);
    expect([...actions].map((action) => action.textContent?.trim())).toEqual([
      'Abrir relatórios',
      'Abrir comandas',
      'Abrir balcão',
      'Abrir caixa',
    ]);
    fixture.destroy();
  });

  it('maps only Sale statuses used by the current dashboard', () => {
    const instance = createFixture().componentInstance;

    expect(instance.statusLabel('OPEN')).toBe('Aberta');
    expect(instance.statusLabel('CLOSED')).toBe('Fechada');
    expect(instance.statusLabel('CANCELLED')).toBe('Cancelada');
    fixture.destroy();
  });

  it('shows a controlled error when the summary endpoint is unavailable', () => {
    api.getSummary.mockReturnValueOnce(throwError(() => ({ error: { message: 'Falha controlada' } })));
    const instance = createFixture().componentInstance;

    expect(instance.summary()).toBeNull();
    expect(instance.error()).toBeTruthy();
    expect(instance.loading()).toBe(false);
    fixture.destroy();
  });
});
