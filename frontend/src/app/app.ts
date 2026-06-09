import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FeedbackService } from './core/services/feedback.service';
import { CashierPageComponent } from './features/cashier/cashier-page.component';
import { CategoriesPageComponent } from './features/categories/categories-page.component';
import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';
import { KitchenPageComponent } from './features/kitchen/kitchen-page.component';
import { OrdersPageComponent } from './features/orders/orders-page.component';
import { ProductsPageComponent } from './features/products/products-page.component';
import { TablesPageComponent } from './features/tables/tables-page.component';
import { TabsPageComponent } from './features/tabs/tabs-page.component';
import { CollectionItem, CollectionPageComponent } from './shared/components/collection-page/collection-page.component';
import { FeedbackToastComponent } from './shared/components/feedback-toast/feedback-toast.component';
import { reports, users } from './shared/data/mock-data';

type ViewKey =
  | 'dashboard'
  | 'tables'
  | 'tabs'
  | 'orders'
  | 'kitchen'
  | 'products'
  | 'categories'
  | 'cashier'
  | 'reports'
  | 'users';

interface NavItem {
  key: ViewKey;
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
    CommonModule,
    DashboardPageComponent,
    TablesPageComponent,
    TabsPageComponent,
    OrdersPageComponent,
    KitchenPageComponent,
    ProductsPageComponent,
    CategoriesPageComponent,
    CashierPageComponent,
    CollectionPageComponent,
    FeedbackToastComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly feedback = inject(FeedbackService);
  readonly activeView = signal<ViewKey>('dashboard');
  readonly navOpen = signal(false);
  readonly sidebarCollapsed = signal(false);

  readonly navGroups: NavGroup[] = [
    {
      label: 'Operação',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: 'pi pi-chart-line' },
        { key: 'tables', label: 'Mesas', icon: 'pi pi-table' },
        { key: 'tabs', label: 'Comandas', icon: 'pi pi-receipt' },
        { key: 'orders', label: 'Pedidos', icon: 'pi pi-shopping-cart' },
        { key: 'kitchen', label: 'Cozinha', icon: 'pi pi-send' },
        { key: 'cashier', label: 'Caixa', icon: 'pi pi-wallet' },
      ],
    },
    {
      label: 'Cardápio',
      items: [
        { key: 'categories', label: 'Categorias', icon: 'pi pi-tags' },
        { key: 'products', label: 'Produtos', icon: 'pi pi-box' },
      ],
    },
    {
      label: 'Gestão',
      items: [
        { key: 'reports', label: 'Relatórios', icon: 'pi pi-chart-bar' },
        { key: 'users', label: 'Usuários', icon: 'pi pi-users' },
      ],
    },
  ];

  readonly currentLabel = computed(
    () =>
      this.navGroups
        .flatMap((group) => group.items)
        .find((item) => item.key === this.activeView())?.label ?? 'Dashboard',
  );

  readonly reportsCollection: CollectionItem[] = reports.map((report) => ({
    title: report.label,
    subtitle: report.detail,
    meta: 'Indicador ilustrativo',
    value: report.value,
    status: 'Mock',
    tone: 'info',
    icon: report.icon,
  }));

  readonly usersCollection: CollectionItem[] = users.map((user) => ({
    title: user.name,
    subtitle: user.role,
    meta: `Último acesso: ${user.lastAccess}`,
    value: user.status,
    status: 'Mock',
    tone: 'info',
    icon: 'pi pi-user',
  }));

  setActiveView(view: ViewKey): void {
    this.activeView.set(view);
    this.navOpen.set(false);
  }

  toggleNav(): void {
    this.navOpen.update((isOpen) => !isOpen);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((isCollapsed) => !isCollapsed);
  }

  developmentNotice(): void {
    this.feedback.info('Funcionalidade em desenvolvimento.');
  }
}
