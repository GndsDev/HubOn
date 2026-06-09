import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { DashboardApiService } from './core/services/dashboard-api.service';

const dashboardSummary = {
  todaySales: 0,
  openTabs: 0,
  ordersInPreparation: 0,
  averageTicket: 0,
  bestSellingProducts: [],
  tableSummary: { available: 0, occupied: 0, reserved: 0, disabled: 0, total: 0 },
  cashSummary: { received: 0, openAmount: 0, cancelledAmount: 0 },
  recentOrders: [],
};

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: DashboardApiService,
          useValue: { getSummary: () => of(dashboardSummary) },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Operação em tempo real');
  });
});
