import { CashierView, ReportView, UserView } from '../models/cashier.model';
import { DashboardSnapshot } from '../models/dashboard.model';
import { KitchenOrder, OrderListItem, TabListItem } from '../models/order.model';
import { CategoryView, ProductView } from '../models/product.model';
import { RestaurantTableView } from '../models/table.model';

export const dashboardSnapshot: DashboardSnapshot = {
  stats: [
    {
      label: 'Vendas hoje',
      value: 'R$ 2.847,90',
      detail: '18 comandas finalizadas',
      icon: 'pi pi-wallet',
      tone: 'blue',
      trend: '+12,4%',
    },
    {
      label: 'Mesas ocupadas',
      value: '8/20',
      detail: '40% da operação ativa',
      icon: 'pi pi-table',
      tone: 'purple',
      trend: 'tempo médio 42min',
    },
    {
      label: 'Pedidos em preparo',
      value: '12',
      detail: '3 pedidos prioritários',
      icon: 'pi pi-send',
      tone: 'amber',
      trend: 'fila controlada',
    },
    {
      label: 'Ticket médio',
      value: 'R$ 86,30',
      detail: 'alta de R$ 7,10 vs. ontem',
      icon: 'pi pi-chart-line',
      tone: 'emerald',
      trend: '+8,9%',
    },
  ],
  recentOrders: [
    { id: '#1048', table: 'Mesa 12', status: 'Preparando', amount: 'R$ 142,80', time: 'há 6 min', tone: 'warning' },
    { id: '#1047', table: 'Mesa 04', status: 'Pronto', amount: 'R$ 88,40', time: 'há 9 min', tone: 'success' },
    { id: '#1046', table: 'Mesa 18', status: 'Recebido', amount: 'R$ 214,90', time: 'há 14 min', tone: 'info' },
    { id: '#1045', table: 'Balcão', status: 'Preparando', amount: 'R$ 46,00', time: 'há 18 min', tone: 'warning' },
  ],
  bestSellers: [
    { name: 'Executivo da casa', category: 'Pratos principais', quantity: 24, revenue: 'R$ 789,60' },
    { name: 'Suco natural', category: 'Bebidas', quantity: 31, revenue: 'R$ 306,90' },
    { name: 'Burger artesanal', category: 'Lanches', quantity: 18, revenue: 'R$ 628,20' },
    { name: 'Brownie com sorvete', category: 'Sobremesas', quantity: 14, revenue: 'R$ 278,60' },
  ],
  tableStatus: [
    { label: 'Livres', value: 9, total: 20, tone: 'free' },
    { label: 'Ocupadas', value: 8, total: 20, tone: 'occupied' },
    { label: 'Reservadas', value: 2, total: 20, tone: 'reserved' },
    { label: 'Desativadas', value: 1, total: 20, tone: 'disabled' },
  ],
  cashier: [
    { label: 'Recebido', value: 'R$ 2.847,90', detail: 'Pix lidera com 44%' },
    { label: 'Em aberto', value: 'R$ 1.183,40', detail: '8 comandas ativas' },
    { label: 'Cancelamentos', value: 'R$ 86,00', detail: '2 itens cancelados' },
  ],
};

export const restaurantTables: RestaurantTableView[] = [
  { id: 1, number: 1, seats: 2, status: 'free', amount: 'R$ 0,00', openedFor: '-', waiter: 'Livre' },
  { id: 2, number: 2, seats: 4, status: 'occupied', amount: 'R$ 148,90', openedFor: '38 min', waiter: 'Marina' },
  { id: 3, number: 3, seats: 4, status: 'reserved', amount: 'R$ 0,00', openedFor: '20:30', waiter: 'Reserva' },
  { id: 4, number: 4, seats: 6, status: 'occupied', amount: 'R$ 284,40', openedFor: '1h 12min', waiter: 'Lucas' },
  { id: 5, number: 5, seats: 2, status: 'occupied', amount: 'R$ 72,00', openedFor: '24 min', waiter: 'Ana' },
  { id: 6, number: 6, seats: 4, status: 'free', amount: 'R$ 0,00', openedFor: '-', waiter: 'Livre' },
  { id: 7, number: 7, seats: 8, status: 'occupied', amount: 'R$ 391,20', openedFor: '56 min', waiter: 'Marina' },
  { id: 8, number: 8, seats: 4, status: 'free', amount: 'R$ 0,00', openedFor: '-', waiter: 'Livre' },
  { id: 9, number: 9, seats: 2, status: 'occupied', amount: 'R$ 91,50', openedFor: '17 min', waiter: 'Lucas' },
  { id: 10, number: 10, seats: 4, status: 'disabled', amount: 'R$ 0,00', openedFor: 'manutenção', waiter: 'Indisponível' },
  { id: 11, number: 11, seats: 4, status: 'reserved', amount: 'R$ 0,00', openedFor: '21:00', waiter: 'Reserva' },
  { id: 12, number: 12, seats: 6, status: 'occupied', amount: 'R$ 142,80', openedFor: '44 min', waiter: 'Ana' },
];

export const kitchenOrders: KitchenOrder[] = [
  {
    id: '#1048',
    table: 'Mesa 12',
    elapsed: '06 min',
    priority: 'high',
    status: 'received',
    notes: 'Sem cebola no burger.',
    items: [
      { quantity: 2, name: 'Burger artesanal' },
      { quantity: 1, name: 'Batata rústica' },
    ],
  },
  {
    id: '#1046',
    table: 'Mesa 18',
    elapsed: '14 min',
    priority: 'normal',
    status: 'received',
    notes: 'Molho separado.',
    items: [
      { quantity: 1, name: 'Executivo da casa' },
      { quantity: 2, name: 'Suco natural' },
    ],
  },
  {
    id: '#1045',
    table: 'Balcão',
    elapsed: '18 min',
    priority: 'urgent',
    status: 'preparing',
    notes: 'Pedido para viagem.',
    items: [
      { quantity: 3, name: 'Combo almoço' },
      { quantity: 1, name: 'Brownie' },
    ],
  },
  {
    id: '#1042',
    table: 'Mesa 07',
    elapsed: '27 min',
    priority: 'high',
    status: 'preparing',
    notes: 'Ponto da carne ao ponto.',
    items: [
      { quantity: 2, name: 'Filé premium' },
      { quantity: 2, name: 'Risoto de parmesão' },
    ],
  },
  {
    id: '#1047',
    table: 'Mesa 04',
    elapsed: '09 min',
    priority: 'normal',
    status: 'ready',
    notes: 'Avisar garçom Lucas.',
    items: [
      { quantity: 1, name: 'Executivo da casa' },
      { quantity: 1, name: 'Refrigerante lata' },
    ],
  },
];

export const products: ProductView[] = [
  { id: 1, name: 'Executivo da casa', category: 'Pratos principais', price: 'R$ 32,90', margin: '68%', status: 'active' },
  { id: 2, name: 'Burger artesanal', category: 'Lanches', price: 'R$ 34,90', margin: '61%', status: 'active' },
  { id: 3, name: 'Suco natural', category: 'Bebidas', price: 'R$ 9,90', margin: '74%', status: 'active' },
  { id: 4, name: 'Brownie com sorvete', category: 'Sobremesas', price: 'R$ 19,90', margin: '58%', status: 'active' },
  { id: 5, name: 'Prato sazonal', category: 'Especiais', price: 'R$ 46,00', margin: '49%', status: 'inactive' },
];

export const categories: CategoryView[] = [
  { id: 1, name: 'Pratos principais', description: 'Itens com maior ticket médio.', products: 12, status: 'active' },
  { id: 2, name: 'Bebidas', description: 'Bebidas frias, quentes e naturais.', products: 18, status: 'active' },
  { id: 3, name: 'Sobremesas', description: 'Finalização da experiência.', products: 7, status: 'active' },
  { id: 4, name: 'Especiais', description: 'Menu sazonal em revisão.', products: 3, status: 'inactive' },
];

export const cashier: CashierView = {
  tab: '#8921',
  table: 'Mesa 04',
  waiter: 'Lucas',
  itemsTotal: 'R$ 214,40',
  serviceFee: 'R$ 21,44',
  discount: 'R$ 10,00',
  total: 'R$ 225,84',
  paid: 'R$ 140,00',
  remaining: 'R$ 85,84',
  payments: [
    { label: 'Pix', value: 'R$ 100,00', icon: 'pi pi-qrcode', selected: true },
    { label: 'Crédito', value: 'R$ 40,00', icon: 'pi pi-credit-card' },
    { label: 'Dinheiro', value: 'R$ 0,00', icon: 'pi pi-money-bill' },
  ],
};

export const tabs: TabListItem[] = [
  { id: '#8921', table: 'Mesa 04', waiter: 'Lucas', openedAt: '1h 12min', total: 'R$ 225,84', status: 'Pagamento parcial' },
  { id: '#8922', table: 'Mesa 12', waiter: 'Ana', openedAt: '44 min', total: 'R$ 142,80', status: 'Aberta' },
  { id: '#8923', table: 'Mesa 07', waiter: 'Marina', openedAt: '56 min', total: 'R$ 391,20', status: 'Aberta' },
];

export const orders: OrderListItem[] = [
  { id: '#1048', table: 'Mesa 12', status: 'Recebido', total: 'R$ 142,80', items: '3 itens', createdAt: 'há 6 min' },
  { id: '#1047', table: 'Mesa 04', status: 'Pronto', total: 'R$ 88,40', items: '2 itens', createdAt: 'há 9 min' },
  { id: '#1045', table: 'Balcão', status: 'Preparando', total: 'R$ 46,00', items: '4 itens', createdAt: 'há 18 min' },
];

export const reports: ReportView[] = [
  { label: 'Faturamento semanal', value: 'R$ 18.420,10', detail: '+9,2% vs semana passada', icon: 'pi pi-chart-bar' },
  { label: 'Produtos vendidos', value: '642', detail: '87 no horário de pico', icon: 'pi pi-box' },
  { label: 'Tempo médio cozinha', value: '18 min', detail: 'meta operacional: 20 min', icon: 'pi pi-clock' },
];

export const users: UserView[] = [
  { name: 'Administrador', role: 'ADMIN', status: 'Online', lastAccess: 'agora' },
  { name: 'Marina Costa', role: 'WAITER', status: 'Online', lastAccess: 'há 4 min' },
  { name: 'Lucas Nunes', role: 'CASHIER', status: 'Online', lastAccess: 'há 2 min' },
  { name: 'Equipe cozinha', role: 'KITCHEN', status: 'Ativo', lastAccess: 'há 1 min' },
];
