import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, finalize, startWith } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { FeedbackToastComponent } from './shared/components/feedback-toast/feedback-toast.component';
import { apiErrorMessage } from './shared/util/api-error';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    FeedbackToastComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  readonly navOpen = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly currentLabel = signal('Dashboard');
  readonly theme = this.themeService.theme;
  readonly currentUser = this.auth.currentUser;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly loginLoading = signal(false);
  readonly loginError = signal<string | null>(null);
  loginForm = { email: 'owner@hubon.local', password: 'owner123' };
  readonly userInitials = computed(() => {
    const name = this.currentUser()?.name.trim();
    if (!name) return '--';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  });

  readonly navGroups: NavGroup[] = [
    {
      label: 'Operação',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: 'pi pi-chart-line', roles: ['OWNER', 'ADMIN'] },
        { path: '/mesas', label: 'Mesas', icon: 'pi pi-table', roles: ['OWNER', 'ADMIN', 'WAITER'] },
        { path: '/comandas', label: 'Comandas', icon: 'pi pi-receipt', roles: ['OWNER', 'ADMIN', 'WAITER', 'CASHIER'] },
        { path: '/pedidos', label: 'Pedidos', icon: 'pi pi-shopping-cart', roles: ['OWNER', 'ADMIN', 'WAITER'] },
        { path: '/cozinha', label: 'Cozinha', icon: 'pi pi-send', roles: ['OWNER', 'ADMIN', 'KITCHEN'] },
        { path: '/caixa', label: 'Caixa', icon: 'pi pi-wallet', roles: ['OWNER', 'ADMIN', 'CASHIER'] },
      ],
    },
    {
      label: 'Cardápio',
      items: [
        { path: '/categorias', label: 'Categorias', icon: 'pi pi-tags', roles: ['OWNER', 'ADMIN'] },
        { path: '/produtos', label: 'Produtos', icon: 'pi pi-box', roles: ['OWNER', 'ADMIN'] },
      ],
    },
    {
      label: 'Gestão',
      items: [
        { path: '/relatorios', label: 'Relatórios', icon: 'pi pi-chart-bar', roles: ['OWNER', 'ADMIN'] },
        { path: '/usuarios', label: 'Usuários', icon: 'pi pi-users', roles: ['OWNER', 'ADMIN'] },
      ],
    },
  ];
  readonly visibleNavGroups = computed(() =>
    this.navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => this.auth.hasAnyRole(item.roles)),
      }))
      .filter((group) => group.items.length > 0),
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const currentPath = `/${this.router.url.split('?')[0].split('#')[0].replace(/^\/+/, '')}`;
        const item = this.navGroups
          .flatMap((group) => group.items)
          .find((navItem) => navItem.path === currentPath);
        this.currentLabel.set(item?.label ?? 'Dashboard');
        this.navOpen.set(false);
      });
  }

  toggleNav(): void {
    this.navOpen.update((isOpen) => !isOpen);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((isCollapsed) => !isCollapsed);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  updateLoginEmail(event: Event): void {
    this.loginForm.email = (event.target as HTMLInputElement).value;
  }

  updateLoginPassword(event: Event): void {
    this.loginForm.password = (event.target as HTMLInputElement).value;
  }

  login(): void {
    this.loginLoading.set(true);
    this.loginError.set(null);
    this.auth.login(this.loginForm)
      .pipe(finalize(() => this.loginLoading.set(false)))
      .subscribe({
        next: () => this.router.navigateByUrl(this.firstAccessiblePath()),
        error: (error) => this.loginError.set(apiErrorMessage(error)),
      });
  }

  logout(): void {
    this.auth.logout();
    this.navOpen.set(false);
    this.router.navigateByUrl('/dashboard');
  }

  closeNav(): void {
    this.navOpen.set(false);
  }

  private firstAccessiblePath(): string {
    return this.visibleNavGroups().flatMap((group) => group.items)[0]?.path ?? '/dashboard';
  }
}
