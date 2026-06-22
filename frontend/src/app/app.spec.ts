import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
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
  const authenticated = signal(false);
  const currentUser = computed(() => authenticated()
    ? { id: 1, name: 'Owner', email: 'owner@hubon.local', active: true, roles: ['OWNER'] }
    : null);
  const authMock = {
    currentUser,
    isAuthenticated: computed(() => authenticated()),
    login: () => of({
      token: 'token',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: currentUser(),
    }),
    logout: () => authenticated.set(false),
    hasAnyRole: (roles: string[]) => roles.length === 0 || roles.some((role) => currentUser()?.roles.includes(role)),
    token: () => authenticated() ? 'token' : null,
    me: () => of(currentUser()),
    changePassword: () => of({ message: 'Senha alterada com sucesso.' }),
  };

  beforeEach(async () => {
    authenticated.set(false);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: authMock,
        },
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

  it('should render login when unauthenticated', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/login');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Entrar no painel');
  });

  it('should redirect protected routes to login with returnUrl when unauthenticated', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/mesas');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.url).toBe('/login?returnUrl=%2Fmesas');
  });

  it('should redirect unknown routes to dashboard', async () => {
    authenticated.set(true);
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/rota-inexistente');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.url).toBe('/dashboard');
  });

  it('should allow authenticated users to access account page', async () => {
    authenticated.set(true);
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/minha-conta');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.url).toBe('/minha-conta');
    expect(fixture.nativeElement.textContent).toContain('Minha Conta');
  });
});
