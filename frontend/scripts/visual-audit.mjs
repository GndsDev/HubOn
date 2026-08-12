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
const now = '2026-08-12T09:00:00';

if (!browserPath) {
  throw new Error('Nenhum navegador compatível foi encontrado para a auditoria visual.');
}

const user = {
  id: 1,
  name: 'Gabriel',
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
  { id: 4, name: 'Porções', active: true, displayOrder: 3, createdAt: now, updatedAt: now },
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
    { id: 1, groupId: 1, name: 'Carne', additionalPrice: 0, displayOrder: 0, active: true, stockLink: null, createdAt: now, updatedAt: now },
    { id: 2, groupId: 1, name: 'Frango', additionalPrice: 0, displayOrder: 1, active: true, stockLink: null, createdAt: now, updatedAt: now },
    { id: 3, groupId: 1, name: 'Coração', additionalPrice: 2, displayOrder: 2, active: true, stockLink: null, createdAt: now, updatedAt: now },
  ],
};

const products = [
  { id: 1, categoryId: 1, categoryName: 'Bebidas', name: 'Coca-Cola 350ml', description: 'Lata gelada', price: 6, active: true, available: true, displayOrder: 0, optionGroups: [], createdAt: now, updatedAt: now },
  { id: 2, categoryId: 1, categoryName: 'Bebidas', name: 'Coca-Cola KS', description: null, price: 5, active: true, available: true, displayOrder: 1, optionGroups: [], createdAt: now, updatedAt: now },
  { id: 3, categoryId: 2, categoryName: 'Espetos', name: 'Espeto Carne', description: null, price: 10, active: true, available: true, displayOrder: 2, optionGroups: [], createdAt: now, updatedAt: now },
  { id: 4, categoryId: 2, categoryName: 'Espetos', name: 'Espeto Frango', description: null, price: 9, active: true, available: true, displayOrder: 3, optionGroups: [], createdAt: now, updatedAt: now },
  { id: 5, categoryId: 3, categoryName: 'Jantinhas', name: 'Jantinha', description: 'Refeição completa', price: 20, active: true, available: true, displayOrder: 4, optionGroups: [optionGroup], createdAt: now, updatedAt: now },
  { id: 6, categoryId: null, categoryName: null, name: 'Produto avulso', description: null, price: 4.75, active: true, available: false, displayOrder: 5, optionGroups: [], createdAt: now, updatedAt: now },
  { id: 7, categoryId: 4, categoryName: 'Porções', name: 'Batata frita', description: 'Porção média', price: 18, active: true, available: true, displayOrder: 6, optionGroups: [], createdAt: now, updatedAt: now },
];

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
  tableNumber: 4,
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
  closedBusinessDate: '2026-08-12',
};

const openCounterSale = {
  ...openSale,
  id: 3,
  type: 'COUNTER',
  tableNumber: null,
  customerName: 'Cliente exemplo',
  subtotal: 27,
  finalAmount: 27,
  remainingAmount: 27,
  items: [
    { ...saleItems[0], id: 3, quantity: 2, subtotal: 12 },
    {
      ...saleItems[1],
      id: 4,
      productId: 3,
      productName: 'Espeto Carne',
      categoryName: 'Espetos',
      baseUnitPrice: 10,
      unitPrice: 10,
      subtotal: 10,
      options: [],
    },
    {
      ...saleItems[0],
      id: 5,
      productId: 2,
      productName: 'Coca-Cola KS',
      baseUnitPrice: 5,
      unitPrice: 5,
      quantity: 1,
      subtotal: 5,
    },
  ],
};

const openTableSales = [
  openSale,
  { ...openSale, id: 4, tableNumber: 2, subtotal: 45, finalAmount: 45, remainingAmount: 45 },
  { ...openSale, id: 5, tableNumber: 7, subtotal: 18, finalAmount: 18, remainingAmount: 18 },
  { ...openSale, id: 6, tableNumber: 10, subtotal: 62, finalAmount: 62, remainingAmount: 62 },
];
const sales = [...openTableSales, closedSale, openCounterSale];

const stockItems = [
  { id: 1, name: 'Coca-Cola 350ml', description: 'Controle por unidade', unit: 'UN', currentStock: 18, minimumStock: 5, status: 'NORMAL', active: true, createdAt: now, updatedAt: now },
  { id: 2, name: 'Espeto Carne', description: null, unit: 'UN', currentStock: 3, minimumStock: 5, status: 'LOW_STOCK', active: true, createdAt: now, updatedAt: now },
  { id: 3, name: 'Coca-Cola KS', description: 'Garrafa retornável', unit: 'UN', currentStock: 0, minimumStock: 4, status: 'OUT_OF_STOCK', active: true, createdAt: now, updatedAt: now },
  { id: 4, name: 'Batata pré-frita', description: 'Pacote congelado', unit: 'KG', currentStock: 8.5, minimumStock: 3, status: 'NORMAL', active: true, createdAt: now, updatedAt: now },
];
const stockMovements = [
  { id: 1, stockItemId: 1, stockItemName: 'Coca-Cola 350ml', unit: 'UN', type: 'ENTRY', deltaQuantity: 20, previousBalance: 0, resultingBalance: 20, saleItemId: null, reversedMovementId: null, reason: 'Saldo inicial', createdByUserId: 1, createdByUserName: user.name, createdAt: now },
  { id: 2, stockItemId: 1, stockItemName: 'Coca-Cola 350ml', unit: 'UN', type: 'SALE', deltaQuantity: -2, previousBalance: 20, resultingBalance: 18, saleItemId: 1, reversedMovementId: null, reason: null, createdByUserId: 1, createdByUserName: user.name, createdAt: now },
  { id: 3, stockItemId: 2, stockItemName: 'Espeto Carne', unit: 'UN', type: 'LOSS', deltaQuantity: -1, previousBalance: 4, resultingBalance: 3, saleItemId: null, reversedMovementId: null, reason: 'Quebra no manuseio', createdByUserId: 1, createdByUserName: user.name, createdAt: now },
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
  receivedByMethod: { CASH: 12, PIX: 20, DEBIT_CARD: 0, CREDIT_CARD: 0, VOUCHER: 0 },
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
    { id: 'CASH-1', type: 'SUPPLY', origin: 'Suprimento', amount: 20, method: 'CASH', responsible: user.name, reference: 'Movimentação #1', observation: 'Troco adicional', occurredAt: now },
    { id: 'CASH-2', type: 'WITHDRAWAL', origin: 'Sangria', amount: 5, method: 'CASH', responsible: user.name, reference: 'Movimentação #2', observation: 'Compra emergencial', occurredAt: now },
    { id: 'CANCELLATION-7', type: 'CANCELLATION', origin: 'Mesa 12', amount: 6, method: null, responsible: user.name, reference: 'Venda #7', observation: 'Cliente desistiu', occurredAt: now },
  ],
};

const summary = {
  grossRevenue: 112,
  serviceFees: 4,
  discounts: 2,
  netRevenue: 114,
  receivedAmount: 114,
  closedSales: 3,
  itemsSold: 7,
  averageTicket: 38,
  tableSales: 1,
  counterSales: 2,
  cancelledSales: 0,
  cancelledItems: 1,
  cancelledAmount: 6,
};
const reportBase = {
  periodLabel: 'Agosto de 2026',
  channel: 'ALL',
  summary,
  products: [
    { productName: 'Jantinha', categoryName: 'Jantinhas', quantity: 3, salesAmount: 60, revenueSharePercentage: 53.57 },
    { productName: 'Espeto Carne', categoryName: 'Espetos', quantity: 2, salesAmount: 28, revenueSharePercentage: 25 },
    { productName: 'Coca-Cola 350ml', categoryName: 'Bebidas', quantity: 4, salesAmount: 24, revenueSharePercentage: 21.43 },
  ],
  categories: [
    { categoryName: 'Jantinhas', quantity: 3, salesAmount: 60, revenueSharePercentage: 53.57 },
    { categoryName: 'Espetos', quantity: 2, salesAmount: 28, revenueSharePercentage: 25 },
    { categoryName: 'Bebidas', quantity: 4, salesAmount: 24, revenueSharePercentage: 21.43 },
  ],
  paymentMethods: [
    { method: 'PIX', payments: 2, amount: 52, receivedSharePercentage: 45.61 },
    { method: 'CASH', payments: 2, amount: 32, receivedSharePercentage: 28.07 },
    { method: 'DEBIT_CARD', payments: 1, amount: 30, receivedSharePercentage: 26.32 },
  ],
  channels: [
    { channel: 'TABLE', closedSales: 1, netRevenue: 44, averageTicket: 44 },
    { channel: 'COUNTER', closedSales: 2, netRevenue: 70, averageTicket: 35 },
  ],
  sales: [
    { id: 2, origin: 'Balcão #2', openedAt: now, closedAt: now, durationMinutes: 10, responsible: user.name, items: 3, grossRevenue: 32, serviceFees: 0, discounts: 0, finalAmount: 32, receivedAmount: 32, paymentMethods: 'CASH, PIX' },
    { id: 8, origin: 'Mesa 7', openedAt: now, closedAt: now, durationMinutes: 48, responsible: 'Maria', items: 2, grossRevenue: 42, serviceFees: 4, discounts: 2, finalAmount: 44, receivedAmount: 44, paymentMethods: 'PIX' },
    { id: 9, origin: 'Balcão #9', openedAt: now, closedAt: now, durationMinutes: 6, responsible: 'Maria', items: 2, grossRevenue: 38, serviceFees: 0, discounts: 0, finalAmount: 38, receivedAmount: 38, paymentMethods: 'CASH, DEBIT_CARD' },
  ],
  cancellations: { cancelledSales: 0, cancelledItems: 1, cancelledAmount: 6, mainReasons: [{ reason: 'Cliente desistiu', occurrences: 1 }] },
};
const monthlyReport = {
  ...reportBase,
  year: 2026,
  month: 8,
  comparison: { previousMonthNetRevenue: 96, netRevenueDifference: 18, percentageChange: 18.75 },
  daily: [{ date: '2026-08-12', closedSales: 3, itemsSold: 7, grossRevenue: 112, serviceFees: 4, discounts: 2, netRevenue: 114, receivedAmount: 114, averageTicket: 38 }],
};

const users = [
  user,
  { id: 2, name: 'Maria', username: 'maria', active: true, roles: ['ADMIN'] },
];

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockApi(page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const apiPath = requestUrl.pathname.replace(/^\/api/, '');
    const method = request.method();
    if (method !== 'GET') return json(route, {}, 200);
    if (apiPath === '/auth/me') return json(route, user);
    if (apiPath === '/dashboard/summary') return json(route, {
      todaySales: 114,
      openSales: 5,
      openTableSales: 4,
      openCounterSales: 1,
      pendingPayments: 5,
      averageTicket: 38,
      cashSummary: { received: 114, openAmount: 184, cancelledAmount: 6 },
      recentSales: [
        { id: 2, tableNumber: null, originLabel: 'Balcão #2', status: 'CLOSED', amount: 32, createdAt: now },
        { id: 8, tableNumber: 7, originLabel: 'Mesa 7', status: 'CLOSED', amount: 44, createdAt: now },
        { id: 3, tableNumber: null, originLabel: 'Balcão #3', status: 'OPEN', amount: 27, createdAt: now },
      ],
    });
    if (apiPath === '/categories') return json(route, categories);
    if (apiPath === '/products') return json(route, products);
    if (/^\/products\/\d+\/option-groups$/.test(apiPath)) return json(route, optionGroup.productId === Number(apiPath.split('/')[2]) ? [optionGroup] : []);
    if (/^\/products\/\d+\/stock-link$/.test(apiPath)) {
      const productId = Number(apiPath.split('/')[2]);
      const stockItem = stockItems.find((item) => item.id === productId) ?? stockItems[0];
      const product = products.find((item) => item.id === productId) ?? products[0];
      return json(route, { id: productId, productId, productName: product.name, stockItemId: stockItem.id, stockItemName: stockItem.name, unit: stockItem.unit, quantityPerSale: 1, active: true, createdAt: now, updatedAt: now });
    }
    if (/^\/products\/\d+$/.test(apiPath)) return json(route, products.find((product) => product.id === Number(apiPath.split('/')[2])) ?? products[0]);
    if (apiPath === '/sales') {
      const status = requestUrl.searchParams.get('status');
      const type = requestUrl.searchParams.get('type');
      const filteredSales = sales
        .filter((sale) => !status || sale.status === status)
        .filter((sale) => !type || sale.type === type);
      return json(route, filteredSales);
    }
    if (/^\/sales\/\d+$/.test(apiPath)) {
      const saleId = Number(apiPath.split('/')[2]);
      return json(route, sales.find((sale) => sale.id === saleId) ?? openSale);
    }
    if (apiPath === '/stock-items' || apiPath === '/stock-items/active') return json(route, stockItems);
    if (apiPath === '/stock-items/alerts') return json(route, stockItems.filter((item) => item.status !== 'NORMAL'));
    if (/^\/stock-items\/\d+$/.test(apiPath)) return json(route, stockItems.find((item) => item.id === Number(apiPath.split('/')[2])) ?? stockItems[0]);
    if (apiPath === '/stock-movements' || apiPath.startsWith('/stock-movements/stock-item/')) return json(route, stockMovements);
    if (apiPath === '/cash-shifts/current') return json(route, cashShift);
    if (apiPath === '/cash-shifts/history') return json(route, []);
    if (apiPath === '/reports/monthly') return json(route, monthlyReport);
    if (apiPath === '/reports/daily') return json(route, { ...reportBase, date: '2026-08-12', periodLabel: '12/08/2026', comparison: { previousDayNetRevenue: 28, netRevenueDifference: 4, percentageChange: 14.29 }, hourly: [] });
    if (apiPath === '/reports/annual') return json(route, { ...reportBase, year: 2026, periodLabel: '2026', comparison: { previousYearNetRevenue: 28, netRevenueDifference: 4, percentageChange: 14.29 }, monthly: [], indicators: { bestMonthLabel: 'Agosto', bestMonthNetRevenue: 32, averageMonthlyRevenue: 32, activeMonths: 1 } });
    if (apiPath === '/users') return json(route, users);
    return json(route, []);
  });
}

async function inspectPage(page, screen, viewport, theme) {
  await page.locator('h1').waitFor({ state: 'visible' });
  if (screen === 'balcao') {
    await page.evaluate(() => {
      document.documentElement.style.zoom = '0.96';
    });
  }
  if (screen === 'relatorios') {
    await page.getByRole('button', { name: /Exportar dados/ }).click();
  }
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
  { width: 1600, height: 1000, label: 'desktop' },
];
const routes = [
  ['/dashboard', 'dashboard'],
  ['/comandas', 'comandas'],
  ['/balcao/3', 'balcao'],
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

  for (const theme of ['light', 'dark']) {
    const loginContext = await browser.newContext({ viewport: viewports[0] });
    await loginContext.addInitScript((selectedTheme) => {
      localStorage.setItem('hubon-theme', selectedTheme);
    }, theme);
    const loginPage = await loginContext.newPage();
    await mockApi(loginPage);
    await loginPage.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    results.push(await inspectPage(loginPage, 'login', 'desktop', theme));
    await loginContext.close();
  }
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
