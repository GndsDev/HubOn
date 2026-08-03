import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.HUBON_AUDIT_URL ?? 'http://127.0.0.1:4200';
const browserPath = process.env.HUBON_BROWSER_PATH
  ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('dist/visual-audit');

const now = '2026-07-27T14:00:00';
const user = { id: 1, name: 'Gabriel Owner', email: 'owner@hubon.local', active: true, roles: ['OWNER'] };
const session = { token: 'visual-audit-token', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z', user };
const categories = [
  { id: 1, name: 'Pratos', description: 'Refeições', active: true, displayOrder: 0, createdAt: now, updatedAt: now },
  { id: 2, name: 'Bebidas', description: 'Bebidas prontas', active: true, displayOrder: 1, createdAt: now, updatedAt: now },
];

function option(id, groupId, name, additionalPrice = 0) {
  return { id, groupId, name, additionalPrice, displayOrder: id, active: true, createdAt: now, updatedAt: now };
}

function variant(id, productId, productName, name, price, stock = false) {
  return {
    id, productId, productName, name, sku: null, price, active: true, available: true,
    displayOrder: id, stockLinkActive: stock, stockLinkId: stock ? id + 100 : null,
    stockItemId: stock ? id + 20 : null, stockItemName: stock ? `${productName} ${name}` : null,
    quantityPerSale: stock ? 1 : null, createdAt: now, updatedAt: now,
  };
}

function product(id, categoryId, categoryName, name, flow, variants, optionGroups = [], overrides = {}) {
  const prices = variants.map((item) => item.price);
  return {
    id, categoryId, categoryName, categoryActive: true, name, description: `Cadastro operacional de ${name}`,
    preparationFlow: flow, active: true, available: true, displayOrder: id, imageUrl: null,
    variantCount: variants.length, activeVariantCount: variants.length, sellableVariantCount: variants.length,
    minimumVariantPrice: prices.length ? Math.min(...prices) : null,
    maximumVariantPrice: prices.length ? Math.max(...prices) : null,
    hasAutomaticStockLink: variants.some((item) => item.stockLinkActive), complete: variants.length > 0,
    variants, optionGroups, createdAt: now, updatedAt: now, ...overrides,
  };
}

const jantinhaName = 'Jantinha Completa';
const jantinhaVariants = [variant(11, 1, jantinhaName, 'Padrão', 25)];
const jantinhaGroups = [
  { id: 101, productId: 1, name: 'Acompanhamento', required: true, minimumSelections: 1, maximumSelections: 1, displayOrder: 0, active: true, options: [option(1001, 101, 'Feijão tropeiro'), option(1002, 101, 'Caldo')], createdAt: now, updatedAt: now },
  { id: 102, productId: 1, name: 'Espeto', required: true, minimumSelections: 1, maximumSelections: 1, displayOrder: 1, active: true, options: [option(1003, 102, 'Carne'), option(1004, 102, 'Frango'), option(1005, 102, 'Kafta')], createdAt: now, updatedAt: now },
];
const cocaVariants = [
  variant(21, 2, 'Coca-Cola', 'Lata', 5, true),
  variant(22, 2, 'Coca-Cola', '600 mL', 7, true),
  variant(23, 2, 'Coca-Cola', '2 L', 12, true),
];
const riceVariants = [variant(31, 3, 'Porção de Arroz', 'Média', 14), variant(32, 3, 'Porção de Arroz', 'Grande', 20)];
const products = [
  product(1, 1, 'Pratos', jantinhaName, 'REQUIRES_PREPARATION', jantinhaVariants, jantinhaGroups),
  product(2, 2, 'Bebidas', 'Coca-Cola', 'DIRECT_SERVICE', cocaVariants),
  product(3, 1, 'Pratos', 'Porção de Arroz', 'REQUIRES_PREPARATION', riceVariants),
  product(4, 2, 'Bebidas', 'Suco temporariamente indisponível', 'DIRECT_SERVICE', [], [], { available: false, complete: false }),
];

const ingredients = Array.from({ length: 11 }, (_, index) => {
  const direct = index < 4;
  const stock = index === 3 ? 0 : index + 1.5;
  return {
    id: 31 + index,
    name: direct ? ['Coca-Cola Lata', 'Coca-Cola 600 mL', 'Coca-Cola 2 L', 'Agua mineral'][index] : `Ingrediente de preparo ${index - 3}`,
    description: direct ? 'Baixa automática por venda' : 'Controle manual de produção',
    unit: direct ? 'UN' : index % 2 ? 'KG' : 'L', controlMode: direct ? 'DIRECT_SALE' : 'MANUAL',
    currentStock: stock, minimumStock: 2, idealStock: 12, active: index !== 10,
    stockStatus: stock === 0 ? 'OUT_OF_STOCK' : stock <= 2 ? 'LOW_STOCK' : 'NORMAL',
    createdAt: now, updatedAt: now,
  };
});

const orderItems = [
  { id: 501, productId: 1, variantId: 11, productNameSnapshot: jantinhaName, variantNameSnapshot: 'Padrão', displayNameSnapshot: jantinhaName, categoryNameSnapshot: 'Pratos', preparationFlow: 'REQUIRES_PREPARATION', unitPriceSnapshot: 25, quantity: 1, notes: 'Sem vinagrete', status: 'WAITING_PREPARATION', subtotal: 25, options: [{ id: 1, optionId: 1001, groupName: 'Acompanhamento', optionName: 'Feijão tropeiro', additionalPrice: 0 }, { id: 2, optionId: 1003, groupName: 'Espeto', optionName: 'Carne', additionalPrice: 0 }], cancellationReason: null },
  { id: 502, productId: 2, variantId: 21, productNameSnapshot: 'Coca-Cola', variantNameSnapshot: 'Lata', displayNameSnapshot: 'Coca-Cola - Lata', categoryNameSnapshot: 'Bebidas', preparationFlow: 'DIRECT_SERVICE', unitPriceSnapshot: 5, quantity: 2, notes: null, status: 'READY', subtotal: 10, options: [], cancellationReason: null },
];
const tableOrder = { id: 77, tabId: 9, tabStatus: 'OPEN', tabType: 'TABLE', tabDisplayLabel: 'Mesa 12', tableId: 4, tableNumber: 12, status: 'SENT_TO_KITCHEN', type: 'TABLE', createdByUserId: 1, createdByUserName: 'Gabriel Owner', notes: 'Levar talheres', confirmedAt: now, cancellationReason: null, createdAt: now, updatedAt: now, items: orderItems };
const counterItems = [
  { ...orderItems[0], id: 601, status: 'IN_PREPARATION', notes: 'Sem cebola' },
  { ...orderItems[1], id: 602, quantity: 1, subtotal: 5 },
];
const counterOrder = { id: 88, tabId: 104, tabStatus: 'OPEN', tabType: 'COUNTER', tabDisplayLabel: 'Balcão #104 - Ana', tableId: null, tableNumber: null, status: 'PREPARING', type: 'COUNTER', createdByUserId: 1, createdByUserName: 'Gabriel Owner', notes: null, confirmedAt: now, cancellationReason: null, createdAt: now, updatedAt: now, items: counterItems };
const draftItems = [{ ...orderItems[1], id: 603, status: 'DRAFT', quantity: 1, subtotal: 5, notes: 'Bem gelada' }];
const draftOrder = { id: 89, tabId: 105, tabStatus: 'OPEN', tabType: 'COUNTER', tabDisplayLabel: 'Balcão #105', tableId: null, tableNumber: null, status: 'CREATED', type: 'COUNTER', createdByUserId: 1, createdByUserName: 'Gabriel Owner', notes: null, confirmedAt: null, cancellationReason: null, createdAt: now, updatedAt: now, items: draftItems };
const partialItems = [
  { ...orderItems[0], id: 604, status: 'WAITING_PREPARATION' },
  { ...orderItems[1], id: 605, quantity: 1, subtotal: 5 },
];
const partialOrder = { id: 90, tabId: 106, tabStatus: 'OPEN', tabType: 'COUNTER', tabDisplayLabel: 'Balcão #106 - Bruno', tableId: null, tableNumber: null, status: 'SENT_TO_KITCHEN', type: 'COUNTER', createdByUserId: 1, createdByUserName: 'Gabriel Owner', notes: null, confirmedAt: now, cancellationReason: null, createdAt: now, updatedAt: now, items: partialItems };
const orders = [tableOrder, counterOrder, partialOrder, draftOrder];
const queue = [{ ...tableOrder, items: [orderItems[0]] }, { ...counterOrder, items: [counterItems[0]] }];
const tableTab = { id: 9, type: 'TABLE', tableId: 4, tableNumber: 12, tableName: 'Setor 4', customerName: null, customerPhone: null, identificationNote: null, displayLabel: 'Mesa 12', status: 'OPEN', openedByUserId: 1, openedByUserName: 'Gabriel Owner', openedAt: now, closedAt: null, totalAmount: 35, serviceFee: 0, discountAmount: 0, finalAmount: 35, paidAmount: 0, remainingAmount: 35, createdAt: now, updatedAt: now };
const counterTab = { id: 104, type: 'COUNTER', tableId: null, tableNumber: null, tableName: null, customerName: 'Ana', customerPhone: '11999999999', identificationNote: 'Retirada no balcão', displayLabel: 'Balcão #104 - Ana', status: 'OPEN', openedByUserId: 1, openedByUserName: 'Gabriel Owner', openedAt: now, closedAt: null, totalAmount: 30, serviceFee: 0, discountAmount: 0, finalAmount: 30, paidAmount: 30, remainingAmount: 0, createdAt: now, updatedAt: now };
const draftTab = { id: 105, type: 'COUNTER', tableId: null, tableNumber: null, tableName: null, customerName: null, customerPhone: null, identificationNote: null, displayLabel: 'Balcão #105', status: 'OPEN', openedByUserId: 1, openedByUserName: 'Gabriel Owner', openedAt: now, closedAt: null, totalAmount: 0, serviceFee: 0, discountAmount: 0, finalAmount: 0, paidAmount: 0, remainingAmount: 0, createdAt: now, updatedAt: now };
const partialTab = { id: 106, type: 'COUNTER', tableId: null, tableNumber: null, tableName: null, customerName: 'Bruno', customerPhone: null, identificationNote: null, displayLabel: 'Balcão #106 - Bruno', status: 'OPEN', openedByUserId: 1, openedByUserName: 'Gabriel Owner', openedAt: now, closedAt: null, totalAmount: 30, serviceFee: 0, discountAmount: 0, finalAmount: 30, paidAmount: 10, remainingAmount: 20, createdAt: now, updatedAt: now };
const tabs = [tableTab, counterTab, draftTab, partialTab];
const activeCounterSales = [
  { id: 104, number: 104, displayLabel: 'Balcão #104 - Ana', customerName: 'Ana', openedAt: now, closedAt: null, openedByUserName: 'Gabriel Owner', tabStatus: 'OPEN', totalAmount: 30, paidAmount: 30, remainingAmount: 0, itemCount: 2, draftItemCount: 0, waitingItemCount: 0, inPreparationItemCount: 1, readyItemCount: 1, deliveredItemCount: 0, attendanceState: 'IN_PROGRESS', preparationState: 'PARTIALLY_READY', financialState: 'PAID', nextAction: 'FOLLOW_PREPARATION', cancellationAllowed: false },
  { id: 105, number: 105, displayLabel: 'Balcão #105', customerName: null, openedAt: now, closedAt: null, openedByUserName: 'Gabriel Owner', tabStatus: 'OPEN', totalAmount: 0, paidAmount: 0, remainingAmount: 0, itemCount: 1, draftItemCount: 1, waitingItemCount: 0, inPreparationItemCount: 0, readyItemCount: 0, deliveredItemCount: 0, attendanceState: 'ASSEMBLING', preparationState: 'NOT_APPLICABLE', financialState: 'UNPAID', nextAction: 'CONFIRM_ORDER', cancellationAllowed: true },
  { id: 106, number: 106, displayLabel: 'Balcão #106 - Bruno', customerName: 'Bruno', openedAt: now, closedAt: null, openedByUserName: 'Gabriel Owner', tabStatus: 'OPEN', totalAmount: 30, paidAmount: 10, remainingAmount: 20, itemCount: 2, draftItemCount: 0, waitingItemCount: 1, inPreparationItemCount: 0, readyItemCount: 1, deliveredItemCount: 0, attendanceState: 'CONFIRMED', preparationState: 'WAITING_PAYMENT', financialState: 'PARTIALLY_PAID', nextAction: 'COMPLETE_PAYMENT', cancellationAllowed: false },
];
const finishedCounterSales = [{ ...activeCounterSales[0], id: 103, number: 103, displayLabel: 'Balcão #103 - Carlos', customerName: 'Carlos', tabStatus: 'CLOSED', closedAt: now, attendanceState: 'FINISHED', preparationState: 'DELIVERED', readyItemCount: 0, deliveredItemCount: 2, nextAction: 'VIEW', cancellationAllowed: false }];
const counterDetails = {
  104: { summary: activeCounterSales[0], customerPhone: counterTab.customerPhone, identificationNote: counterTab.identificationNote, orders: [counterOrder] },
  105: { summary: activeCounterSales[1], customerPhone: null, identificationNote: null, orders: [draftOrder] },
  106: { summary: activeCounterSales[2], customerPhone: null, identificationNote: null, orders: [partialOrder] },
  103: { summary: finishedCounterSales[0], customerPhone: null, identificationNote: null, orders: [{ ...counterOrder, tabId: 103, tabStatus: 'CLOSED', tabDisplayLabel: 'Balcão #103 - Carlos', status: 'DELIVERED', items: counterItems.map((item) => ({ ...item, status: 'DELIVERED' })) }] },
};
const tables = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  number: index + 1,
  name: index === 0 ? 'Varanda principal proxima ao atendimento' : `Setor ${index + 1}`,
  status: index === 3 ? 'OCCUPIED' : index === 6 ? 'RESERVED' : 'AVAILABLE',
  active: true,
  createdAt: now,
  updatedAt: now,
}));
const users = [
  { id: 1, name: 'Gabriel Owner', email: 'gabriel.owner@hubon.local', active: true, roles: ['OWNER'] },
  { id: 2, name: 'Operador com nome extenso para validar o aproveitamento horizontal', email: 'operador.nome.extenso@hubon.local', active: true, roles: ['WAITER'] },
  { id: 3, name: 'Equipe de preparo', email: 'preparo@hubon.local', active: true, roles: ['KITCHEN'] },
];
const paymentSummary = {
  tabId: 9,
  totalAmount: 35,
  paidAmount: 10,
  remainingAmount: 25,
  payments: [{ id: 1, tabId: 9, amount: 10, method: 'PIX', receivedByUserId: 1, receivedByUserName: 'Gabriel Owner', createdAt: now }],
};
const counterPaymentSummary = {
  tabId: 104,
  totalAmount: 30,
  paidAmount: 30,
  remainingAmount: 0,
  payments: [{ id: 2, tabId: 104, amount: 30, method: 'PIX', receivedByUserId: 1, receivedByUserName: 'Gabriel Owner', createdAt: now }],
};
const movements = [
  { id: 1, ingredientId: 31, ingredientName: 'Coca-Cola Lata', type: 'SALE', quantity: 2, previousStock: 10, resultingStock: 8, reason: 'Baixa automática na confirmação do pedido #77', originType: 'ORDER_ITEM', orderId: 77, orderItemId: 502, originReference: 'ORDER-77/ITEM-502', userId: 1, userName: 'Gabriel Owner', createdAt: now },
  { id: 2, ingredientId: 35, ingredientName: 'Ingrediente de preparo 1', type: 'ENTRY', quantity: 4, previousStock: 2, resultingStock: 6, reason: 'Compra do dia', originType: 'MANUAL', orderId: null, orderItemId: null, originReference: null, userId: 1, userName: 'Gabriel Owner', createdAt: now },
];
const cashShift = {
  id: 7,
  status: 'OPEN',
  openedByUserId: 1,
  openedByUserName: 'Gabriel Owner',
  openedAt: now,
  openingBalance: 100,
  closedByUserId: null,
  closedByUserName: null,
  closedAt: null,
  receivedTotal: 75,
  receivedByMethod: { CASH: 25, PIX: 20, DEBIT_CARD: 10, CREDIT_CARD: 15, VOUCHER: 5 },
  cancellationAmount: 0,
  refundAmount: 0,
  supplyAmount: 20,
  withdrawalAmount: 5,
  expectedCash: 140,
  countedCash: null,
  differenceAmount: null,
  closingNote: null,
  movements: [
    { id: 'cash-1', type: 'PAYMENT', origin: 'Balcão #104', amount: 25, method: 'CASH', responsible: 'Gabriel Owner', reference: 'Pagamento #35', observation: null, occurredAt: now },
    { id: 'cash-2', type: 'SUPPLY', origin: 'Suprimento', amount: 20, method: null, responsible: 'Gabriel Owner', reference: 'Caixa #7', observation: 'Troco adicional', occurredAt: now },
    { id: 'cash-3', type: 'WITHDRAWAL', origin: 'Sangria', amount: 5, method: null, responsible: 'Gabriel Owner', reference: 'Caixa #7', observation: 'Retirada de segurança', occurredAt: now },
  ],
};
const monthlyReport = {
  year: 2026, month: 7, periodLabel: 'julho de 2026', channel: 'ALL',
  summary: { grossRevenue: 8420, serviceFees: 320, discounts: 180, netRevenue: 8240, receivedAmount: 8240, closedTabs: 186, orders: 194, itemsSold: 438, averageTicket: 44.3 },
  comparison: { previousMonthNetRevenue: 7600, netRevenueDifference: 640, percentageChange: 8.42 },
  products: Array.from({ length: 14 }, (_, index) => ({
    productName: index % 3 === 0 ? 'Coca-Cola' : `Produto ${index + 1}`,
    categoryName: index % 3 === 0 ? 'Bebidas' : 'Pratos', quantity: 44 - index,
    salesAmount: 920 - index * 42, revenueSharePercentage: 11 - index * 0.4,
    variants: index % 3 === 0
      ? [{ variantName: 'Lata', quantity: 25, salesAmount: 500 }, { variantName: '600 mL', quantity: 19, salesAmount: 420 }]
      : [{ variantName: 'Padrão', quantity: 44 - index, salesAmount: 920 - index * 42 }],
  })),
  categories: [{ categoryName: 'Pratos', quantity: 310, salesAmount: 6200, revenueSharePercentage: 75.24 }, { categoryName: 'Bebidas', quantity: 128, salesAmount: 2040, revenueSharePercentage: 24.76 }],
  paymentMethods: [{ method: 'PIX', payments: 102, amount: 4500, receivedSharePercentage: 54.61 }, { method: 'CREDIT_CARD', payments: 56, amount: 2700, receivedSharePercentage: 32.77 }, { method: 'CASH', payments: 28, amount: 1040, receivedSharePercentage: 12.62 }],
  channels: [{ channel: 'TABLE', closedTabs: 144, netRevenue: 6900, averageTicket: 47.92 }, { channel: 'COUNTER', closedTabs: 42, netRevenue: 1340, averageTicket: 31.9 }],
  daily: Array.from({ length: 18 }, (_, index) => ({ date: `2026-07-${String(index + 1).padStart(2, '0')}`, closedTabs: 8 + index % 5, netRevenue: 320 + index * 18, averageTicket: 42 })),
  cancellations: { cancelledOrders: 3, cancelledItems: 5, cancelledAmount: 145, mainReasons: [{ reason: 'Cliente desistiu', occurrences: 3 }, { reason: 'Item indisponível', occurrences: 2 }] },
};

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
}

async function mockApi(page) {
  await page.route('**:8080/api/**', async (route) => {
    const url = new URL(route.request().url());
    const apiPath = url.pathname.replace('/api', '');
    const method = route.request().method();
    if (apiPath === '/products' && method === 'GET') return json(route, products);
    if (/^\/products\/\d+$/.test(apiPath) && method === 'GET') return json(route, products.find((item) => item.id === Number(apiPath.split('/')[2])) ?? products[0]);
    if (apiPath === '/categories') return json(route, categories);
    if (apiPath === '/tables' && method === 'GET') return json(route, tables);
    if (apiPath === '/ingredients') return json(route, ingredients);
    if (apiPath === '/inventory-movements') return json(route, movements);
    if (apiPath.startsWith('/inventory-movements/ingredient/')) return json(route, movements);
    if (apiPath === '/orders' && method === 'GET') return json(route, orders);
    if (apiPath === '/orders/preparation-queue') return json(route, queue);
    if (apiPath === '/tabs/counter/active' && method === 'GET') return json(route, activeCounterSales);
    if (apiPath === '/tabs/counter/finished-today' && method === 'GET') return json(route, finishedCounterSales);
    if (apiPath === '/tabs/counter/history' && method === 'GET') return json(route, finishedCounterSales);
    if (/^\/tabs\/counter\/\d+$/.test(apiPath) && method === 'GET') {
      return json(route, counterDetails[Number(apiPath.split('/').at(-1))] ?? counterDetails[105]);
    }
    if (apiPath === '/tabs/counter' && method === 'POST') return json(route, draftTab, 201);
    if (apiPath === '/tabs/open') return json(route, tabs);
    if (apiPath === '/reports/monthly') return json(route, monthlyReport);
    if (apiPath === '/cash-shifts/current' && method === 'GET') return json(route, cashShift);
    if (apiPath === '/cash-shifts/history' && method === 'GET') return json(route, []);
    if (/^\/cash-shifts\/\d+\/(movements|close)$/.test(apiPath) && method === 'POST') return json(route, cashShift);
    if (apiPath === '/cash-shifts' && method === 'POST') return json(route, cashShift, 201);
    if (apiPath === '/payments' && method === 'POST') return json(route, {
      payment: { id: 99, tabId: 106, method: 'PIX', amount: 20, paidAt: now, receivedByUserId: 1, receivedByUserName: 'Gabriel Owner' },
      totalAmount: 30,
      paidAmount: 30,
      remainingAmount: 0,
      financialState: 'PAID',
      orders: [{ ...partialOrder, status: 'PREPARING', items: partialItems.map((item) => item.preparationFlow === 'REQUIRES_PREPARATION' ? { ...item, status: 'IN_PREPARATION' } : item) }],
      nextAction: 'FOLLOW_PREPARATION',
    }, 201);
    if (apiPath === '/payments/tab/104') return json(route, counterPaymentSummary);
    if (apiPath.startsWith('/payments/tab/')) return json(route, paymentSummary);
    if (apiPath === '/users' && method === 'GET') return json(route, users);
    if (apiPath === '/auth/me') return json(route, user);
    if (apiPath === '/dashboard/summary') return json(route, { todaySales: 65, openTabs: 3, ordersInPreparation: 2, activeCounterSales: 2, readyOrders: 1, pendingPayments: 2, averageTicket: 32.5, bestSellingProducts: [], tableSummary: { available: 8, occupied: 1, reserved: 1, disabled: 0, total: 10 }, cashSummary: { received: 30, openAmount: 35, cancelledAmount: 0 }, recentOrders: [{ id: 88, tableNumber: null, originLabel: 'Balcão #104 - Ana', status: 'PREPARING', amount: 30, createdAt: now }, { id: 77, tableNumber: 12, originLabel: 'Mesa 12', status: 'SENT_TO_KITCHEN', amount: 35, createdAt: now }] });
    return json(route, {});
  });
}

async function viewportChecks(page, screen, viewport, theme) {
  return page.evaluate(({ screen, viewport, theme }) => {
    const root = document.documentElement;
    const sidebar = document.querySelector('.hub-sidebar')?.getBoundingClientRect();
    const sidebarCard = document.querySelector('.sidebar-card')?.getBoundingClientRect();
    const sideNav = document.querySelector('.side-nav');
    const topbar = document.querySelector('.hub-topbar')?.getBoundingClientRect();
    let routeHost = document.querySelector('.content-surface > router-outlet')?.nextElementSibling;
    if (routeHost?.children.length === 1 && routeHost.firstElementChild?.tagName === 'APP-COLLECTION-PAGE') {
      routeHost = routeHost.firstElementChild;
    }
    const flowChildren = Array.from(routeHost?.children ?? [])
      .filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.position !== 'fixed' && style.position !== 'absolute' && box.height > 0;
      })
      .map((element) => element.getBoundingClientRect())
      .sort((left, right) => left.top - right.top);
    const sectionGaps = flowChildren.slice(1).map((box, index) => Math.round((box.top - flowChildren[index].bottom) * 100) / 100);
    const stockCards = Array.from(document.querySelectorAll('.stock-stats-grid .stat-card'))
      .map((element) => element.getBoundingClientRect());
    const stockRows = [...new Set(stockCards.map((box) => Math.round(box.top)))].map((top) => stockCards.filter((box) => Math.abs(box.top - top) < 2).length);
    const tableOverflow = ['.catalog-product-table', '.stock-table']
      .map((selector) => document.querySelector(selector))
      .filter(Boolean)
      .map((element) => ({ selector: element.className, overflow: element.scrollWidth - element.clientWidth }));
    const clippedFlowBadges = Array.from(document.querySelectorAll('.flow-status-badge .status-chip'))
      .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
      .length;
    const clippedOrderElements = Array.from(document.querySelectorAll('.order-card button, .order-card a, .order-card .status-chip, .order-filters button'))
      .filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0
          && (box.left < -1 || box.right > innerWidth + 1);
      }).length;
    return {
      screen,
      viewport,
      theme,
      horizontalOverflow: root.scrollWidth - root.clientWidth,
      sidebar: sidebar ? { left: sidebar.left, right: sidebar.right, top: sidebar.top, bottom: sidebar.bottom, width: sidebar.width, height: sidebar.height } : null,
      sidebarCard: sidebarCard ? { top: sidebarCard.top, bottom: sidebarCard.bottom, viewportGap: innerHeight - sidebarCard.bottom } : null,
      sideNav: sideNav ? { scrollHeight: sideNav.scrollHeight, clientHeight: sideNav.clientHeight } : null,
      topbar: topbar ? { left: topbar.left, right: topbar.right, width: topbar.width } : null,
      sectionGaps,
      stockRows,
      stockHeightDelta: stockCards.length ? Math.max(...stockCards.map((box) => box.height)) - Math.min(...stockCards.map((box) => box.height)) : 0,
      tableOverflow,
      clippedFlowBadges,
      clippedOrderElements,
      orderFiltersOverflow: Math.max(0, (document.querySelector('.order-filters')?.scrollWidth ?? 0) - (document.querySelector('.order-filters')?.clientWidth ?? 0)),
      overlaps: document.querySelectorAll('.modal-panel').length > 1,
      kitchenNavigationLinks: Array.from(document.querySelectorAll('a')).filter((link) => link.textContent?.trim() === 'Cozinha').length,
      startPreparationActions: Array.from(document.querySelectorAll('button, a')).filter((element) => element.textContent?.includes('Iniciar preparo')).length,
      paymentActionCount: Array.from(document.querySelectorAll('button')).filter((button) => /Registrar pagamento|Completar pagamento/.test(button.textContent ?? '')).length,
    };
  }, { screen, viewport, theme });
}

async function sidebarAfterScroll(page, viewport, theme) {
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
  return page.evaluate(({ viewport, theme }) => {
    const sidebar = document.querySelector('.hub-sidebar')?.getBoundingClientRect();
    const card = document.querySelector('.sidebar-card')?.getBoundingClientRect();
    return {
      screen: 'sidebar-scrolled',
      viewport,
      theme,
      sidebar: sidebar ? { top: sidebar.top, bottom: sidebar.bottom, width: sidebar.width, height: sidebar.height } : null,
      sidebarCard: card ? { top: card.top, bottom: card.bottom, viewportGap: innerHeight - card.bottom } : null,
      pageScroll: scrollY,
    };
  }, { viewport, theme });
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: false });
}

async function openRoute(page, route, name) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  await page.locator('h1').waitFor();
  await screenshot(page, name);
}

async function overlayBounds(page, selector) {
  return page.locator(selector).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      insideViewport: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
      scrollable: element.scrollHeight > element.clientHeight,
      placement: element.getAttribute('data-placement'),
    };
  });
}

async function waitForOverlay(page, selector) {
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.waitForFunction((menuSelector) => {
    const element = document.querySelector(menuSelector);
    if (!element) return false;
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.top >= 0 && box.width > 0 && box.height > 0;
  }, selector);
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const results = [];
const viewports = [
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1440, height: 900, label: '1440x900' },
  { width: 1920, height: 1080, label: '1920x1080' },
  { width: 1366, height: 650, label: '1366x650' },
];
const routes = [
  ['/dashboard', 'dashboard'],
  ['/balcao', 'counter'],
  ['/balcao/105', 'counter-detail'],
  ['/balcao/106', 'counter-partial'],
  ['/balcao/104', 'counter-preparation'],
  ['/mesas', 'tables'],
  ['/comandas', 'tabs'],
  ['/produtos', 'products'],
  ['/pedidos', 'orders'],
  ['/caixa', 'cashier'],
  ['/categorias', 'categories'],
  ['/stock', 'stock'],
  ['/relatorios', 'reports'],
  ['/usuarios', 'users'],
  ['/minha-conta', 'account'],
];

for (const theme of ['dark', 'light']) {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(({ session, theme }) => {
      localStorage.setItem('hubon-auth-session', JSON.stringify(session));
      localStorage.setItem('hubon-theme', theme);
    }, { session, theme });
    const page = await context.newPage();
    await mockApi(page);
    for (const [route, screen] of routes) {
      const name = `${screen}-${theme}-${viewport.label}`;
      await openRoute(page, route, name);
      results.push(await viewportChecks(page, screen, viewport.label, theme));
      if (screen === 'dashboard') {
        await page.locator('.sidebar-toggle').click();
        await page.waitForFunction(() => Math.abs((document.querySelector('.hub-sidebar')?.getBoundingClientRect().width ?? 0) - 72) < 1);
        const collapsedWidth = await page.locator('.hub-sidebar').evaluate((element) => element.getBoundingClientRect().width);
        results.push({ screen: 'sidebar-collapsed', viewport: viewport.label, theme, collapsedWidth });
        await screenshot(page, `sidebar-collapsed-${theme}-${viewport.label}`);
        await page.locator('.sidebar-toggle').click();
      }
      if (screen === 'products' || screen === 'stock') {
        const menuSelector = screen === 'products' ? '.product-action-menu' : '.stock-action-menu';
        const triggerSelector = screen === 'products'
          ? '.catalog-product-table .actions-trigger'
          : '.stock-row .actions-trigger';
        const triggers = page.locator(triggerSelector);
        await triggers.first().click();
        await waitForOverlay(page, menuSelector);
        await screenshot(page, `${screen}-menu-first-${theme}-${viewport.label}`);
        results.push({ screen: `${screen}-menu-first`, viewport: viewport.label, theme, overlay: await overlayBounds(page, menuSelector) });
        await page.keyboard.press('Escape');
        await triggers.last().scrollIntoViewIfNeeded();
        await triggers.last().click();
        await waitForOverlay(page, menuSelector);
        await screenshot(page, `${screen}-menu-last-${theme}-${viewport.label}`);
        results.push({ screen: `${screen}-menu-last`, viewport: viewport.label, theme, overlay: await overlayBounds(page, menuSelector) });
        await page.keyboard.press('Escape');
      }
      if (screen === 'products') {
        const productTriggers = page.locator('.catalog-product-table .actions-trigger');
        await productTriggers.nth(1).click();
        await waitForOverlay(page, '.product-action-menu');
        await page.getByRole('menuitem', { name: 'Gerenciar produto' }).click();
        await page.getByRole('button', { name: 'Variações e estoque' }).click();
        await page.locator('.variant-manager-row').first().waitFor();
        await screenshot(page, `product-variants-new-${theme}-${viewport.label}`);
        results.push(await page.evaluate(({ viewport, theme }) => {
          const dialog = document.querySelector('.product-management-dialog');
          const content = document.querySelector('.product-management-content');
          const footer = document.querySelector('.product-management-actions');
          const editor = document.querySelector('.variant-editor');
          const editorBox = editor?.getBoundingClientRect();
          const rowBoxes = Array.from(document.querySelectorAll('.variant-manager-row')).map((row) => row.getBoundingClientRect());
          const overlapArea = editorBox ? Math.max(0, ...rowBoxes.map((row) => Math.max(0, Math.min(row.right, editorBox.right) - Math.max(row.left, editorBox.left)) * Math.max(0, Math.min(row.bottom, editorBox.bottom) - Math.max(row.top, editorBox.top)))) : -1;
          const dialogBox = dialog?.getBoundingClientRect();
          const footerBox = footer?.getBoundingClientRect();
          return {
            screen: 'product-variants-new',
            viewport,
            theme,
            variantCount: rowBoxes.length,
            overlapArea,
            modalHorizontalOverflow: content ? content.scrollWidth - content.clientWidth : -1,
            dialogInsideViewport: !!dialogBox && dialogBox.left >= 0 && dialogBox.top >= 0 && dialogBox.right <= innerWidth && dialogBox.bottom <= innerHeight,
            footerVisible: !!footerBox && footerBox.top >= 0 && footerBox.bottom <= innerHeight,
            saveVisible: !!document.querySelector('button[form="variant-editor-form"]'),
          };
        }, { viewport: viewport.label, theme }));

        const variantTriggers = page.locator('.variant-manager-row .actions-trigger');
        await variantTriggers.first().click();
        await waitForOverlay(page, '.variant-action-menu');
        await screenshot(page, `product-variant-menu-first-${theme}-${viewport.label}`);
        results.push({ screen: 'product-variant-menu-first', viewport: viewport.label, theme, overlay: await overlayBounds(page, '.variant-action-menu') });
        await page.keyboard.press('Escape');
        await variantTriggers.last().scrollIntoViewIfNeeded();
        await variantTriggers.last().click();
        await waitForOverlay(page, '.variant-action-menu');
        await screenshot(page, `product-variant-menu-last-${theme}-${viewport.label}`);
        results.push({ screen: 'product-variant-menu-last', viewport: viewport.label, theme, overlay: await overlayBounds(page, '.variant-action-menu') });
        await page.keyboard.press('Escape');
        await page.locator('.variant-manager-row .ghost-button').first().click();
        await screenshot(page, `product-variants-edit-${theme}-${viewport.label}`);
        results.push({
          screen: 'product-variants-edit',
          viewport: viewport.label,
          theme,
          title: await page.locator('#variant-editor-title').textContent(),
          saveVisible: await page.getByRole('button', { name: 'Salvar variação' }).isVisible(),
        });
        await page.keyboard.press('Escape');
      }
      if (screen === 'stock') {
        results.push(await sidebarAfterScroll(page, viewport.label, theme));
        await screenshot(page, `stock-scrolled-${theme}-${viewport.label}`);
        await page.evaluate(() => scrollTo(0, 0));
      }
    }
    await page.goto(`${baseUrl}/cozinha`, { waitUntil: 'networkidle' });
    await page.locator('h1').waitFor();
    results.push({
      screen: 'kitchen-redirect',
      viewport: viewport.label,
      theme,
      redirectedToOrders: new URL(page.url()).pathname === '/pedidos',
      visibleKitchenNavigation: await page.locator('a', { hasText: /^Cozinha$/ }).count(),
      heading: await page.locator('h1').textContent(),
    });
    await context.close();
  }
}

async function waitForDialogCleanup(page) {
  await page.waitForFunction(() => document.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal-backdrop').length === 0
    && !document.body.classList.contains('hubon-overlay-open'));
}

for (const theme of ['dark', 'light']) {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript((selectedTheme) => {
      localStorage.setItem('hubon-theme', selectedTheme);
    }, theme);
    const page = await context.newPage();
    await mockApi(page);
    await openRoute(page, '/login', `login-${theme}-${viewport.label}`);
    results.push(await viewportChecks(page, 'login', viewport.label, theme));
    await context.close();
  }
}

for (const theme of ['dark', 'light']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(({ session, theme }) => {
    localStorage.setItem('hubon-auth-session', JSON.stringify(session));
    localStorage.setItem('hubon-theme', theme);
  }, { session, theme });
  const page = await context.newPage();
  await mockApi(page);

  await page.goto(`${baseUrl}/produtos`, { waitUntil: 'networkidle' });
  const productTriggers = page.locator('.catalog-product-table .actions-trigger');
  await productTriggers.first().click();
  await waitForOverlay(page, '.product-action-menu');
  await screenshot(page, `products-menu-first-${theme}`);
  results.push({ screen: 'products-menu-first', theme, overlay: await overlayBounds(page, '.product-action-menu') });
  await page.keyboard.press('Escape');
  await productTriggers.last().scrollIntoViewIfNeeded();
  await productTriggers.last().click();
  await waitForOverlay(page, '.product-action-menu');
  await screenshot(page, `products-menu-last-${theme}`);
  results.push({ screen: 'products-menu-last', theme, overlay: await overlayBounds(page, '.product-action-menu') });
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Novo produto' }).click();
  await screenshot(page, `product-wizard-step1-${theme}`);
  results.push(await page.evaluate((theme) => ({
    screen: 'product-wizard-flow',
    theme,
    clippedLabels: Array.from(document.querySelectorAll('.flow-choice strong')).filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1).length,
    modalOverflow: Math.max(0, (document.querySelector('.product-wizard-panel')?.scrollWidth ?? 0) - (document.querySelector('.product-wizard-panel')?.clientWidth ?? 0)),
  }), theme));
  await page.locator('input[name="name"]').fill('Produto auditado');
  await page.getByRole('button', { name: /Continuar/ }).click();
  await screenshot(page, `product-wizard-step2-${theme}`);
  await page.getByRole('button', { name: /Continuar/ }).click();
  await screenshot(page, `product-wizard-step3-${theme}`);
  await page.keyboard.press('Escape');
  await waitForDialogCleanup(page);

  await page.goto(`${baseUrl}/pedidos`, { waitUntil: 'networkidle' });
  results.push({ screen: 'orders-payment-duplication', theme, paymentActions: await page.getByRole('button', { name: /Registrar pagamento|Completar pagamento/ }).count() });
  await page.getByRole('button', { name: 'Novo pedido de mesa' }).click();
  await screenshot(page, `order-builder-${theme}`);
  await page.keyboard.press('Escape');
  await waitForDialogCleanup(page);
  await page.locator('.order-card .actions-trigger').first().click();
  await waitForOverlay(page, '.order-action-menu');
  await page.getByRole('menuitem', { name: 'Cancelar pedido' }).click();
  await screenshot(page, `order-cancel-${theme}`);
  await page.keyboard.press('Escape');

  await page.goto(`${baseUrl}/comandas`, { waitUntil: 'networkidle' });
  await page.locator('.collection-card-button').first().click();
  await page.getByRole('button', { name: 'Registrar pagamento' }).click();
  await screenshot(page, `table-payment-${theme}`);
  results.push({ screen: 'table-payment', theme, overlay: await overlayBounds(page, '.payment-dialog') });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.goto(`${baseUrl}/balcao/106`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Completar pagamento' }).click();
  await screenshot(page, `counter-partial-payment-${theme}`);
  results.push({ screen: 'counter-partial-payment', theme, overlay: await overlayBounds(page, '.payment-dialog') });
  await page.keyboard.press('Escape');

  await page.goto(`${baseUrl}/balcao/105`, { waitUntil: 'networkidle' });
  await page.locator('.counter-product').first().click();
  await screenshot(page, `counter-product-options-${theme}`);
  results.push({ screen: 'counter-product-options', theme, overlay: await overlayBounds(page, '.modal-panel') });
  await page.keyboard.press('Escape');

  await page.goto(`${baseUrl}/caixa`, { waitUntil: 'networkidle' });
  results.push({ screen: 'cashier-payment-duplication', theme, paymentActions: await page.getByRole('button', { name: /Registrar pagamento|Completar pagamento/ }).count() });
  await page.getByRole('button', { name: 'Registrar sangria' }).click();
  await screenshot(page, `cashier-withdrawal-${theme}`);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Fechar caixa' }).click();
  await screenshot(page, `cashier-closing-${theme}`);
  results.push({ screen: 'cashier-closing', theme, overlay: await overlayBounds(page, '.modal-panel') });
  await page.keyboard.press('Escape');

  await page.goto(`${baseUrl}/relatorios`, { waitUntil: 'networkidle' });
  await page.locator('.report-product-row').first().click();
  await screenshot(page, `monthly-report-long-${theme}`);

  await page.goto(`${baseUrl}/stock`, { waitUntil: 'networkidle' });
  const stockTriggers = page.locator('.stock-row .actions-trigger');
  await stockTriggers.first().click();
  await waitForOverlay(page, '.stock-action-menu');
  await screenshot(page, `stock-menu-first-${theme}`);
  results.push({ screen: 'stock-menu-first', theme, overlay: await overlayBounds(page, '.stock-action-menu') });
  await page.keyboard.press('Escape');
  await stockTriggers.last().scrollIntoViewIfNeeded();
  await stockTriggers.last().click();
  await waitForOverlay(page, '.stock-action-menu');
  await screenshot(page, `stock-menu-last-${theme}`);
  results.push({ screen: 'stock-menu-last', theme, overlay: await overlayBounds(page, '.stock-action-menu') });
  await page.keyboard.press('Escape');
  await stockTriggers.first().scrollIntoViewIfNeeded();
  await stockTriggers.first().click();
  await waitForOverlay(page, '.stock-action-menu');
  await page.getByRole('menuitem', { name: 'Saída' }).click();
  await screenshot(page, `stock-manual-exit-${theme}`);

  await context.close();
}

await browser.close();
await writeFile(path.join(outputDir, 'audit-results.json'), JSON.stringify(results, null, 2));

const failures = results.filter((result) => result.horizontalOverflow > 1
  || result.overlaps
  || result.openDialogs > 1
  || result.overlay?.insideViewport === false
  || result.kitchenNavigationLinks > 0
  || result.startPreparationActions > 0
  || ((result.screen === 'orders' || result.screen === 'cashier') && result.paymentActionCount > 0)
  || ((result.screen === 'orders-payment-duplication' || result.screen === 'cashier-payment-duplication') && result.paymentActions > 0)
  || (result.screen === 'kitchen-redirect' && (!result.redirectedToOrders || result.visibleKitchenNavigation > 0 || result.heading?.trim() !== 'Pedidos'))
  || (result.screen === 'product-variants-new' && (result.variantCount < 2 || result.overlapArea > 1 || result.modalHorizontalOverflow > 1 || !result.dialogInsideViewport || !result.footerVisible || !result.saveVisible))
  || (result.screen === 'product-variants-edit' && (result.title?.trim() !== 'Editar variação' || !result.saveVisible))
  || result.clippedFlowBadges > 0
  || result.clippedOrderElements > 0
  || result.orderFiltersOverflow > 1
  || result.clippedLabels > 0
  || result.clipped
  || result.modalOverflow > 1
  || result.tableOverflow?.some((table) => table.overflow > 1)
  || result.sectionGaps?.some((gap) => gap < 23)
  || result.stockHeightDelta > 1
  || (result.screen === 'stock' && !(['1366x768', '1366x650', '1440x900'].includes(result.viewport) ? result.stockRows?.join(',') === '3,3' : result.stockRows?.join(',') === '6'))
  || (result.screen === 'sidebar-collapsed' && Math.abs(result.collapsedWidth - 72) > 1)
  || (result.sidebar && result.viewport && result.screen !== 'sidebar-scrolled' && (Math.abs(result.sidebar.top) > 1 || Math.abs(result.sidebar.bottom - Number(result.viewport.split('x')[1])) > 1))
  || (result.sidebarCard && (result.sidebarCard.viewportGap < 8 || result.sidebarCard.viewportGap > 33))
  || (result.screen === 'sidebar-scrolled' && (Math.abs(result.sidebar?.top ?? 999) > 1 || Math.abs((result.sidebar?.bottom ?? 0) - Number(result.viewport?.split('x')[1])) > 1)));
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Visual audit passed with ${results.length} checks. Output: ${outputDir}`);
}
