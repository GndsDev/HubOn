import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./features/login/login-page.component').then(
        (module) => module.LoginPageComponent,
      ),
    data: { label: 'Login' },
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard-page.component').then(
        (module) => module.DashboardPageComponent,
      ),
    data: { label: 'Dashboard', roles: ['OWNER', 'ADMIN'] },
  },
  {
    path: 'mesas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tables/tables-page.component').then(
        (module) => module.TablesPageComponent,
      ),
    data: { label: 'Mesas', roles: ['OWNER', 'ADMIN', 'WAITER'] },
  },
  {
    path: 'comandas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tabs/tabs-page.component').then(
        (module) => module.TabsPageComponent,
      ),
    data: { label: 'Comandas', roles: ['OWNER', 'ADMIN', 'WAITER', 'CASHIER'] },
  },
  {
    path: 'pedidos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/orders/orders-page.component').then(
        (module) => module.OrdersPageComponent,
      ),
    data: { label: 'Pedidos', roles: ['OWNER', 'ADMIN', 'WAITER'] },
  },
  {
    path: 'cozinha',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/kitchen/kitchen-page.component').then(
        (module) => module.KitchenPageComponent,
      ),
    data: { label: 'Cozinha', roles: ['OWNER', 'ADMIN', 'KITCHEN'] },
  },
  {
    path: 'caixa',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/cashier/cashier-page.component').then(
        (module) => module.CashierPageComponent,
      ),
    data: { label: 'Caixa', roles: ['OWNER', 'ADMIN', 'CASHIER'] },
  },
  {
    path: 'categorias',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/categories/categories-page.component').then(
        (module) => module.CategoriesPageComponent,
      ),
    data: { label: 'Categorias', roles: ['OWNER', 'ADMIN'] },
  },
  {
    path: 'produtos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/products/products-page.component').then(
        (module) => module.ProductsPageComponent,
      ),
    data: { label: 'Produtos', roles: ['OWNER', 'ADMIN'] },
  },
  {
    path: 'relatorios',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/reports-page.component').then(
        (module) => module.ReportsPageComponent,
      ),
    data: { label: 'Relatórios', roles: ['OWNER', 'ADMIN'] },
  },
  {
    path: 'usuarios',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/users/users-page.component').then(
        (module) => module.UsersPageComponent,
    ),
    data: { label: 'Usuários', roles: ['OWNER', 'ADMIN'] },
  },
  {
    path: 'minha-conta',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/account-page.component').then(
        (module) => module.AccountPageComponent,
      ),
    data: { label: 'Minha Conta', roles: [] },
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
