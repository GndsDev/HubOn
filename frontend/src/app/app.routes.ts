import { Routes } from '@angular/router';
import {
  authGuard,
  loginGuard,
} from './core/guards/auth.guard';

const MANAGEMENT_ROLES = ['OWNER', 'ADMIN'];

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import(
        './features/login/login-page.component'
      ).then(
        (module) => module.LoginPageComponent,
      ),
    data: {
      label: 'Login',
    },
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/dashboard/dashboard-page.component'
      ).then(
        (module) => module.DashboardPageComponent,
      ),
    data: {
      label: 'Dashboard',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: 'balcao',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/counter/counter-page.component'
      ).then(
        (module) => module.CounterPageComponent,
      ),
    data: {
      label: 'Balcão',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: 'balcao/:counterTabId',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/counter/counter-page.component'
      ).then(
        (module) => module.CounterPageComponent,
      ),
    data: {
      label: 'Balcão',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: 'mesas',
    redirectTo: 'comandas',
  },
  {
    path: 'comandas',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/tabs/tabs-page.component'
      ).then(
        (module) => module.TabsPageComponent,
      ),
    data: {
      label: 'Comandas',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: 'comandas/:tabId',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/tabs/tabs-page.component'
      ).then(
        (module) => module.TabsPageComponent,
      ),
    data: {
      label: 'Comandas',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: 'pedidos',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/orders/orders-page.component'
      ).then(
        (module) => module.OrdersPageComponent,
      ),
    data: {
      label: 'Pedidos',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: 'caixa',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/cashier/cashier-page.component'
      ).then(
        (module) => module.CashierPageComponent,
      ),
    data: {
      label: 'Caixa',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: 'categorias',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/categories/categories-page.component'
      ).then(
        (module) => module.CategoriesPageComponent,
      ),
    data: {
      label: 'Categorias',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: 'produtos',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/products/products-page.component'
      ).then(
        (module) => module.ProductsPageComponent,
      ),
    data: {
      label: 'Produtos',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: 'stock',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/stock/stock-page.component'
      ).then(
        (module) => module.StockPageComponent,
      ),
    data: {
      label: 'Estoque',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: 'relatorios',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/reports/reports-page.component'
      ).then(
        (module) => module.ReportsPageComponent,
      ),
    data: {
      label: 'Relatórios',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: 'usuarios',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/users/users-page.component'
      ).then(
        (module) => module.UsersPageComponent,
      ),
    data: {
      label: 'Usuários',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: 'minha-conta',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/account/account-page.component'
      ).then(
        (module) => module.AccountPageComponent,
      ),
    data: {
      label: 'Minha Conta',
      roles: MANAGEMENT_ROLES,
    },
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'cozinha',
    redirectTo: 'pedidos',
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
