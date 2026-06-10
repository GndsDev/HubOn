import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard-page.component').then(
        (module) => module.DashboardPageComponent,
      ),
    data: { label: 'Dashboard' },
  },
  {
    path: 'mesas',
    loadComponent: () =>
      import('./features/tables/tables-page.component').then(
        (module) => module.TablesPageComponent,
      ),
    data: { label: 'Mesas' },
  },
  {
    path: 'comandas',
    loadComponent: () =>
      import('./features/tabs/tabs-page.component').then(
        (module) => module.TabsPageComponent,
      ),
    data: { label: 'Comandas' },
  },
  {
    path: 'pedidos',
    loadComponent: () =>
      import('./features/orders/orders-page.component').then(
        (module) => module.OrdersPageComponent,
      ),
    data: { label: 'Pedidos' },
  },
  {
    path: 'cozinha',
    loadComponent: () =>
      import('./features/kitchen/kitchen-page.component').then(
        (module) => module.KitchenPageComponent,
      ),
    data: { label: 'Cozinha' },
  },
  {
    path: 'caixa',
    loadComponent: () =>
      import('./features/cashier/cashier-page.component').then(
        (module) => module.CashierPageComponent,
      ),
    data: { label: 'Caixa' },
  },
  {
    path: 'categorias',
    loadComponent: () =>
      import('./features/categories/categories-page.component').then(
        (module) => module.CategoriesPageComponent,
      ),
    data: { label: 'Categorias' },
  },
  {
    path: 'produtos',
    loadComponent: () =>
      import('./features/products/products-page.component').then(
        (module) => module.ProductsPageComponent,
      ),
    data: { label: 'Produtos' },
  },
  {
    path: 'relatorios',
    loadComponent: () =>
      import('./features/reports/reports-page.component').then(
        (module) => module.ReportsPageComponent,
      ),
    data: { label: 'Relatórios' },
  },
  {
    path: 'usuarios',
    loadComponent: () =>
      import('./features/users/users-page.component').then(
        (module) => module.UsersPageComponent,
      ),
    data: { label: 'Usuários' },
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
