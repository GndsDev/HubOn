import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, startWith } from 'rxjs';
import { FeedbackToastComponent } from './shared/components/feedback-toast/feedback-toast.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
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
  readonly navOpen = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly currentLabel = signal('Dashboard');

  readonly navGroups: NavGroup[] = [
    {
      label: 'Operação',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: 'pi pi-chart-line' },
        { path: '/mesas', label: 'Mesas', icon: 'pi pi-table' },
        { path: '/comandas', label: 'Comandas', icon: 'pi pi-receipt' },
        { path: '/pedidos', label: 'Pedidos', icon: 'pi pi-shopping-cart' },
        { path: '/cozinha', label: 'Cozinha', icon: 'pi pi-send' },
        { path: '/caixa', label: 'Caixa', icon: 'pi pi-wallet' },
      ],
    },
    {
      label: 'Cardápio',
      items: [
        { path: '/categorias', label: 'Categorias', icon: 'pi pi-tags' },
        { path: '/produtos', label: 'Produtos', icon: 'pi pi-box' },
      ],
    },
    {
      label: 'Gestão',
      items: [
        { path: '/relatorios', label: 'Relatórios', icon: 'pi pi-chart-bar' },
        { path: '/usuarios', label: 'Usuários', icon: 'pi pi-users' },
      ],
    },
  ];

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

  closeNav(): void {
    this.navOpen.set(false);
  }
}
