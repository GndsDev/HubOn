import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { CashierPageComponent } from './features/cashier/cashier-page.component';
import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';
import { KitchenPageComponent } from './features/kitchen/kitchen-page.component';
import { ProductsPageComponent } from './features/products/products-page.component';
import { TablesPageComponent } from './features/tables/tables-page.component';
import { CollectionItem, CollectionPageComponent } from './shared/components/collection-page/collection-page.component';
import {
  cashier,
  categories,
  dashboardSnapshot,
  kitchenOrders,
  orders,
  products,
  reports,
  restaurantTables,
  tabs,
  users,
} from './shared/data/mock-data';

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

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    DashboardPageComponent,
    TablesPageComponent,
    KitchenPageComponent,
    ProductsPageComponent,
    CashierPageComponent,
    CollectionPageComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly activeView = signal<ViewKey>('dashboard');
  readonly navOpen = signal(false);

  readonly dashboard = dashboardSnapshot;
  readonly tables = restaurantTables;
  readonly kitchenOrders = kitchenOrders;
  readonly products = products;
  readonly cashier = cashier;

  readonly navItems: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'pi pi-chart-line' },
    { key: 'tables', label: 'Mesas', icon: 'pi pi-table' },
    { key: 'tabs', label: 'Comandas', icon: 'pi pi-receipt' },
    { key: 'orders', label: 'Pedidos', icon: 'pi pi-shopping-cart' },
    { key: 'kitchen', label: 'Cozinha', icon: 'pi pi-send' },
    { key: 'products', label: 'Produtos', icon: 'pi pi-box' },
    { key: 'categories', label: 'Categorias', icon: 'pi pi-tags' },
    { key: 'cashier', label: 'Caixa', icon: 'pi pi-wallet' },
    { key: 'reports', label: 'Relatórios', icon: 'pi pi-chart-bar' },
    { key: 'users', label: 'Usuários', icon: 'pi pi-users' },
  ];

  readonly currentLabel = computed(
    () => this.navItems.find((item) => item.key === this.activeView())?.label ?? 'Dashboard',
  );

  readonly tabsCollection: CollectionItem[] = tabs.map((tab) => ({
    title: tab.id,
    subtitle: `${tab.table} · ${tab.waiter}`,
    meta: `Aberta há ${tab.openedAt}`,
    value: tab.total,
    status: tab.status,
    tone: tab.status.includes('parcial') ? 'warning' : 'info',
    icon: 'pi pi-receipt',
  }));

  readonly ordersCollection: CollectionItem[] = orders.map((order) => ({
    title: order.id,
    subtitle: `${order.table} · ${order.items}`,
    meta: order.createdAt,
    value: order.total,
    status: order.status,
    tone: order.status === 'Pronto' ? 'success' : order.status === 'Preparando' ? 'warning' : 'info',
    icon: 'pi pi-shopping-cart',
  }));

  readonly categoriesCollection: CollectionItem[] = categories.map((category) => ({
    title: category.name,
    subtitle: category.description,
    meta: `${category.products} produtos vinculados`,
    value: category.status === 'active' ? 'Ativa' : 'Inativa',
    status: category.status === 'active' ? 'Ativa' : 'Inativa',
    tone: category.status === 'active' ? 'success' : 'neutral',
    icon: 'pi pi-tags',
  }));

  readonly reportsCollection: CollectionItem[] = reports.map((report) => ({
    title: report.label,
    subtitle: report.detail,
    meta: 'Indicador gerencial',
    value: report.value,
    status: 'Atualizado',
    tone: 'info',
    icon: report.icon,
  }));

  readonly usersCollection: CollectionItem[] = users.map((user) => ({
    title: user.name,
    subtitle: user.role,
    meta: `Último acesso: ${user.lastAccess}`,
    value: user.status,
    status: user.status,
    tone: user.status === 'Online' ? 'success' : 'info',
    icon: 'pi pi-user',
  }));

  setActiveView(view: ViewKey): void {
    this.activeView.set(view);
    this.navOpen.set(false);
  }

  toggleNav(): void {
    this.navOpen.update((isOpen) => !isOpen);
  }
}
