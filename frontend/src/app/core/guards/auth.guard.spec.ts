import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../../shared/models/user.model';
import { AuthService } from '../services/auth.service';
import { authGuard, loginGuard } from './auth.guard';

describe('authentication guards', () => {
  const auth = {
    isAuthenticated: vi.fn(() => false),
    hasAnyRole: vi.fn(() => false),
    currentUser: vi.fn<() => User | null>(() => null),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    auth.isAuthenticated.mockReturnValue(false);
    auth.hasAnyRole.mockReturnValue(false);
    auth.currentUser.mockReturnValue(null);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  function route(roles: string[]): ActivatedRouteSnapshot {
    return { data: { roles } } as unknown as ActivatedRouteSnapshot;
  }

  function state(url: string): RouterStateSnapshot {
    return { url } as unknown as RouterStateSnapshot;
  }

  it('redirects unauthenticated users to login with a return URL', () => {
    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() => authGuard(route(['OWNER', 'ADMIN']), state('/dashboard')));

    expect(result).toBeInstanceOf(UrlTree);
    if (result instanceof UrlTree) {
      expect(router.serializeUrl(result)).toBe('/login?returnUrl=%2Fdashboard');
    }
  });

  it('allows authenticated users with one of the route roles', () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.hasAnyRole.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() => authGuard(route(['OWNER', 'ADMIN']), state('/comandas')));

    expect(result).toBe(true);
    expect(auth.hasAnyRole).toHaveBeenCalledWith(['OWNER', 'ADMIN']);
  });

  it('redirects authenticated users without permission to their first accessible page', () => {
    const router = TestBed.inject(Router);
    auth.isAuthenticated.mockReturnValue(true);
    auth.currentUser.mockReturnValue({ id: 2, name: 'Operador', email: 'operador@hubon.test', active: true, roles: ['CASHIER'] });

    const result = TestBed.runInInjectionContext(() => authGuard(route(['OWNER']), state('/dashboard')));

    expect(result).toBeInstanceOf(UrlTree);
    if (result instanceof UrlTree) {
      expect(router.serializeUrl(result)).toBe('/balcao');
    }
  });

  it('keeps login public and redirects authenticated managers to dashboard', () => {
    expect(TestBed.runInInjectionContext(() => loginGuard(route([]), state('/login')))).toBe(true);

    const router = TestBed.inject(Router);
    auth.isAuthenticated.mockReturnValue(true);
    auth.currentUser.mockReturnValue({ id: 1, name: 'Gerente', email: 'gerente@hubon.test', active: true, roles: ['ADMIN'] });
    const result = TestBed.runInInjectionContext(() => loginGuard(route([]), state('/login')));

    expect(result).toBeInstanceOf(UrlTree);
    if (result instanceof UrlTree) {
      expect(router.serializeUrl(result)).toBe('/dashboard');
    }
  });
});
