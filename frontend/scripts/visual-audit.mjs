import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.HUBON_AUDIT_URL ?? 'http://127.0.0.1:4200';
const browserPath = [
  process.env.HUBON_BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((candidate) => candidate && existsSync(candidate));
const outputDir = path.resolve('dist/visual-audit');
const now = '2026-08-07T18:30:00';

if (!browserPath) {
  throw new Error('Nenhum navegador compatível foi encontrado para a auditoria visual.');
}

const user = {
  id: 1,
  name: 'Proprietário HubOn',
  username: 'owner',
  active: true,
  roles: ['OWNER'],
};
const session = {
  token: 'visual-audit-token',
  tokenType: 'Bearer',
  expiresAt: '2099-01-01T00:00:00Z',
  user,
};

const categories = [
  { id: 1, name: 'Bebidas', active: true, displayOrder: 0, createdAt: now, updatedAt: now },
  { id: 2, name: 'Espetos', active: true, displayOrder: 1, createdAt: now, updatedAt: now },
  { id: 3, name: 'Jantinhas', active: true, displayOrder: 2, createdAt: now, updatedAt: now },
];

const optionGroup = {
  id: 1,
  productId: 5,
  name: 'Escolha o espeto',
  minimumSelections: 1,
  maximumSelections: 1,
  displayOrder: 0,
  active: true,
  createdAt: now,
  updatedAt: now,
  options: [
    { id: 1, groupId: 1, name: 'Carne', additionalPrice: 0, displayOrder: 0, active: true, createdAt: now, updatedAt: now },
    { id: 2, groupId: 1, name: 'Frango', additionalPrice: 0, displayOrder: 1, active: true, createdAt: now, updatedAt: now },
  ],
};

const products = [
  { id: 1, categoryId: 1, categoryName: 'Bebidas', name: 'Coca-Cola 350ml', description: 'Lata gelada', price: 6, active: true, available: true, displayOrder: 0, optionGroups: [], createdAt: now, updatedAt: now },
  { id: 2, categoryId: 1, categoryName: 'Bebidas', name: 'Coca-Cola KS', description: null, price: 5, active: true, available: true, displayOrder: 1, optionGroups: [], createdAt: now, updatedAt: now },
  { id: 3, categoryId: 2, categoryName: 'Espetos', name: 'Espeto Carne', description: null, price: 10, active: true, available: true, displayOrder: 2, optionGroups: [], createdAt: now, updatedAt: now },
  { id: 4, categoryId: 2, categoryName: 'Espetos', name: 'Espeto Frango', description: null, price: 9, active: true, available: true, displayOrder: 3, optionGroups: [], createdAt: now, updatedAt: now },
  { id: 5, categoryId: 3, categoryName: 'Jantinhas', name: 'Jantinha', description: 'Refeição completa', price: 20, active: true, available: true, displayOrder: 4, optionGroups: [optionGroup], createdAt: now, updatedAt: now },
  { id: 6, categoryId: null, categoryName: null, name: 'Produto avulso', description: null, price: 4.75, active: true, available: false, displayOrder: 5, optionGroups: [], createdAt: now, updatedAt: now },
];

const tables = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  number: index + 1,
  label: index === 0 ? 'Salão principal' : null,
  state: index === 0 ? 'OCCUPIED' : 'FREE',
  active: true,
  createdAt: now,
  updatedAt: now,
}));

const saleItems = [
  {
    id: 1,
    productId: 1,
    productName: 'Coca-Cola 350ml',
    categoryName: 'Bebidas',
    baseUnitPrice: 6,
    unitPrice: 6,
    quantity: 2,
    subtotal: 12,
    notes: null,
    options: [],
    createdByUserId: 1,
    createdByUserName: user.name,
    createdAt: now,
    cancelledAt: null,
    cancelledByUserId: null,
    cancelledByUserName: null,
    cancellationReason: null,
  },
  {
    id: 2,
    productId: 5,
    productName: 'Jantinha',
    categoryName: 'Jantinhas',
    baseUnitPrice: 20,
    unitPrice: 20,
    quantity: 1,
    subtotal: 20,
    notes: null,
    options: [{ id: 1, productOptionId: 1, optionGroupName: 'Escolha o espeto', optionName: 'Carne', additionalPrice: 0 }],
    createdByUserId: 1,
    createdByUserName: user.name,
    createdAt: now,
    cancelledAt: null,
    cancelledByUserId: null,
    cancelledByUserName: null,
    cancellationReason: null,
  },
];

const openSale = {
  id: 1,
  type: 'TABLE',
  status: 'OPEN',
  tableNumber: 1,
  customerName: null,
  customerPhone: null,
  subtotal: 32,
  serviceFee: 0,
  discountAmount: 0,
  finalAmount: 32,
  paidAmount: 0,
  remainingAmount: 32,
  items: saleItems,
  payments: [],
  openedByUserId: 1,
  openedByUserName: user.name,
  openedAt: now,
  closedByUserId: null,
  closedByUserName: null,
  closedAt: null,
  closedBusinessDate: null,
  cancelledByUserId: null,
  cancelledByUserName: null,
  cancelledAt: null,
  cancellationReason: null,
};

const closedSale = {
  ...openSale,
  id: 2,
  type: 'COUNTER',
  status: 'CLOSED',
  tableNumber: null,
  finalAmount: 32,
  paidAmount: 32,
  remainingAmount: 0,
  payments: [
    { id: 1, saleId: 2, method: 'PIX', amount: 20, paidAt: now, receivedByUserId: 1, receivedByUserName: user.name },
    { id: 2, saleId: 2, method: 'CASH', amount: 12, paidAt: now, receivedByUserId: 1, receivedByUserName: user.name },
  ],
  closedByUserId: 1,
  closedByUserName: user.name,
  closedAt: now,
  closedBusinessDate: '2026-08-07',
};

const stockItems = [
  { id: 1, name: 'Coca-Cola 350ml', description: 'Controle por unidade', unit: 'UN', currentStock: 18, minimumStock: 5, status: 'NORMAL', active: true, createdAt: now, updatedAt: now },
  { id: 2, name: 'Espeto Carne', description: null, unit: 'UN', currentStock: 3, minimumStock: 5, status: 'LOW_STOCK', active: true, createdAt: now, updatedAt: now },
];
const stockMovements = [
  { id: 1, stockItemId: 1, stockItemName: 'Coca-Cola 350ml', unit: 'UN', type: 'ENTRY', deltaQuantity: 20, previousBalance: 0, resultingBalance: 20, saleItemId: null, reversedMovementId: null, reason: 'Saldo inicial', createdByUserId: 1, createdByUserName: user.name, createdAt: now },
  { id: 2, stockItemId: 1, stockItemName: 'Coca-Cola 350ml', unit: 'UN', type: 'SALE', deltaQuantity: -2, previousBalance: 20, resultingBalance: 18, saleItemId: 1, reversedMovementId: null, reason: null, createdByUserId: 1, createdByUserName: user.name, createdAt: now },
];

const cashShift = {
  id: 1,
  status: 'OPEN',
  openedByUserId: 1,
  openedByUserName: user.name,
  openedAt: now,
  openingBalance: 100,
  closedByUserId: null,
  closedByUserName: null,
  closedAt: null,
  receivedTotal: 32,
  receivedByMethod: { CASH: 12, PIX: 20 },
  cancellationAmount: 6,
  supplyAmount: 20,
  withdrawalAmount: 5,
  expectedCash: 127,
  countedCash: null,
  differenceAmount: null,
  closingNote: null,
  movements: [
    { id: 'PAYMENT-1', type: 'PAYMENT', origin: 'Balcão #2', amount: 20, method: 'PIX', responsible: user.name, reference: 'Pagamento #1', observation: null, occurredAt: now },
    { id: 'PAYMENT-2', type: 'PAYMENT', origin: 'Balcão #2', amount: 12, method: 'CASH', responsible: user.name, reference: 'Pagamento #2', observation: null, occurredAt: now },
    { id: 'CANCELLATION-3', type: 'CANCELLATION', origin: 'Mesa 3', amount: 6, method: null, responsible: user.name, reference: 'Venda #3', observation: 'Cliente desistiu', occurredAt: now },
  ],
};

const summary = {
  grossRevenue: 32,
  serviceFees: 0,
  discounts: 0,
  netRevenue: 32,
  receivedAmount: 32,
  closedSales: 1,
  itemsSold: 3,
  averageTicket: 32,
  tableSales: 0,
  counterSales: 1,
  cancelledSales: 0,
  cancelledItems: 1,
  cancelledAmount: 6,
};
const reportBase = {
  periodLabel: 'Agosto de 2026',
  channel: 'ALL',
  summary,
  products: [
    { productName: 'Jantinha', categoryName: 'Jantinhas', quantity: 1, salesAmount: 20, revenueSharePercentage: 62.5 },
    { productName: 'Coca-Cola 350ml', categoryName: 'Bebidas', quantity: 2, salesAmount: 12, revenueSharePercentage: 37.5 },
  ],
  categories: [
    { categoryName: 'Jantinhas', quantity: 1, salesAmount: 20, revenueSharePercentage: 62.5 },
    { categoryName: 'Bebidas', quantity: 2, salesAmount: 12, revenueSharePercentage: 37.5 },
  ],
  paymentMethods: [
    { method: 'PIX', payments: 1, amount: 20, receivedSharePercentage: 62.5 },
    { method: 'CASH', payments: 1, amount: 12, receivedSharePercentage: 37.5 },
  ],
  channels: [{ channel: 'COUNTER', closedSales: 1, netRevenue: 32, averageTicket: 32 }],
  sales: [{ id: 2, origin: 'Balcão #2', openedAt: now, closedAt: now, durationMinutes: 10, responsible: user.name, items: 3, grossRevenue: 32, serviceFees: 0, discounts: 0, finalAmount: 32, receivedAmount: 32, paymentMethods: 'CASH, PIX' }],
  cancellations: { cancelledSales: 0, cancelledItems: 1, cancelledAmount: 6, mainReasons: [{ reason: 'Cliente desistiu', occurrences: 1 }] },
};
const monthlyReport = {
  ...reportBase,
  year: 2026,
  month: 8,
  comparison: { previousMonthNetRevenue: 28, netRevenueDifference: 4, percentageChange: 14.29 },
  daily: [{ date: '2026-08-07', closedSales: 1, itemsSold: 3, grossRevenue: 32, serviceFees: 0, discounts: 0, netRevenue: 32, receivedAmount: 32, averageTicket: 32 }],
};

const users = [
  user,
  { id: 2, name: 'Operador de atendimento', username: 'operador', active: true, roles: ['WAITER', 'CASHIER'] },
];

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockApi(page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const apiPath = new URL(request.url()).pathname.replace(/^\/api/, '');
    const method = request.method();
    if (method !== 'GET') return json(route, {}, 200);
    if (apiPath === '/auth/me') return json(route, user);
    if (apiPath === '/dashboard/summary') return json(route, {
      todaySales: 32,
      openSales: 1,
      openTableSales: 1,
      openCounterSales: 0,
      pendingPayments: 1,
      averageTicket: 32,
      cashSummary: { received: 32, openAmount: 32, cancelledAmount: 6 },
      recentSales: [{ id: 2, tableNumber: null, originLabel: 'Balcão #2', status: 'CLOSED', amount: 32, createdAt: now }],
    });
    if (apiPath === '/categories') return json(route, categories);
    if (apiPath === '/products') return json(route, products);
    if (/^\/products\/\d+\/option-groups$/.test(apiPath)) return json(route, optionGroup.productId === Number(apiPath.split('/')[2]) ? [optionGroup] : []);
    if (/^\/products\/\d+\/stock-link$/.test(apiPath)) return json(route, { id: 1, productId: 1, productName: products[0].name, stockItemId: 1, stockItemName: stockItems[0].name, unit: 'UN', quantityPerSale: 1, active: true, createdAt: now, updatedAt: now });
    if (/^\/products\/\d+$/.test(apiPath)) return json(route, products.find((product) => product.id === Number(apiPath.split('/')[2])) ?? products[0]);
    if (apiPath === '/sales') return json(route, [openSale, closedSale]);
    if (/^\/sales\/\d+$/.test(apiPath)) return json(route, Number(apiPath.split('/')[2]) === closedSale.id ? closedSale : openSale);
    if (apiPath === '/stock-items' || apiPath === '/stock-items/active') return json(route, stockItems);
    if (apiPath === '/stock-items/alerts') return json(route, stockItems.filter((item) => item.status !== 'NORMAL'));
    if (/^\/stock-items\/\d+$/.test(apiPath)) return json(route, stockItems.find((item) => item.id === Number(apiPath.split('/')[2])) ?? stockItems[0]);
    if (apiPath === '/stock-movements' || apiPath.startsWith('/stock-movements/stock-item/')) return json(route, stockMovements);
    if (apiPath === '/cash-shifts/current') return json(route, cashShift);
    if (apiPath === '/cash-shifts/history') return json(route, []);
    if (apiPath === '/reports/monthly') return json(route, monthlyReport);
    if (apiPath === '/reports/daily') return json(route, { ...reportBase, date: '2026-08-07', periodLabel: '07/08/2026', comparison: { previousDayNetRevenue: 28, netRevenueDifference: 4, percentageChange: 14.29 }, hourly: [] });
    if (apiPath === '/reports/annual') return json(route, { ...reportBase, year: 2026, periodLabel: '2026', comparison: { previousYearNetRevenue: 28, netRevenueDifference: 4, percentageChange: 14.29 }, monthly: [], indicators: { bestMonthLabel: 'Agosto', bestMonthNetRevenue: 32, averageMonthlyRevenue: 32, activeMonths: 1 } });
    if (apiPath === '/users') return json(route, users);
    return json(route, []);
  });
}

async function inspectPage(page, screen, viewport, theme) {
  await page.locator('h1').waitFor({ state: 'visible' });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(outputDir, `${screen}-${theme}-${viewport}.png`), fullPage: false });
  return page.evaluate(({ screen, viewport, theme }) => {
    const root = document.documentElement;
    const heading = document.querySelector('h1');
    const errorPanel = document.querySelector('.error-panel, [role="alert"]');
    return {
      screen,
      viewport,
      theme,
      heading: heading?.textContent?.trim() ?? null,
      horizontalOverflow: Math.max(0, root.scrollWidth - root.clientWidth),
      pageHeight: root.scrollHeight,
      hasVisibleHeading: !!heading && heading.getBoundingClientRect().height > 0,
      hasErrorPanel: !!errorPanel,
      hasLegacyCopy: /variante|preparo|cozinha|pedido/i.test(document.body.innerText),
    };
  }, { screen, viewport, theme });
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const results = [];
const runtimeErrors = [];
const viewports = [
  { width: 1366, height: 768, label: 'desktop' },
  { width: 820, height: 1180, label: 'tablet' },
];
const routes = [
  ['/dashboard', 'dashboard'],
  ['/comandas', 'comandas'],
  ['/balcao', 'balcao'],
  ['/historico', 'historico'],
  ['/caixa', 'caixa'],
  ['/categorias', 'categorias'],
  ['/produtos', 'produtos'],
  ['/stock', 'estoque'],
  ['/relatorios', 'relatorios'],
  ['/usuarios', 'usuarios'],
  ['/minha-conta', 'minha-conta'],
];

try {
  for (const theme of ['light', 'dark']) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(({ auditSession, selectedTheme }) => {
        localStorage.setItem('hubon-auth-session', JSON.stringify(auditSession));
        localStorage.setItem('hubon-theme', selectedTheme);
      }, { auditSession: session, selectedTheme: theme });
      const page = await context.newPage();
      page.on('pageerror', (error) => runtimeErrors.push(`${theme}/${viewport.label}: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') runtimeErrors.push(`${theme}/${viewport.label}: ${message.text()}`);
      });
      await mockApi(page);
      for (const [route, screen] of routes) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        results.push(await inspectPage(page, screen, viewport.label, theme));
      }
      await context.close();
    }
  }

  const loginContext = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  const loginPage = await loginContext.newPage();
  await mockApi(loginPage);
  await loginPage.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  results.push(await inspectPage(loginPage, 'login', 'tablet', 'light'));
  await loginContext.close();
} finally {
  await browser.close();
}

await writeFile(path.join(outputDir, 'audit-results.json'), JSON.stringify({ results, runtimeErrors }, null, 2));
const failures = results.filter((result) => !result.hasVisibleHeading
  || result.horizontalOverflow > 1
  || result.hasErrorPanel
  || result.hasLegacyCopy);

if (failures.length || runtimeErrors.length) {
  console.error(JSON.stringify({ failures, runtimeErrors }, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Visual audit passed with ${results.length} checks. Output: ${outputDir}`);
}
