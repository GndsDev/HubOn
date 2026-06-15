import { spawnSync } from 'node:child_process';
import {
  access,
  mkdir,
  readdir,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, '..');
const repositoryRoot = path.resolve(frontendRoot, '..');
const browsersPath = path.join(frontendRoot, '.playwright');
const screenshotDirectory = path.join(
  repositoryRoot,
  'docs',
  'media',
  'screenshots',
);
const videoDirectory = path.join(repositoryRoot, 'docs', 'media', 'videos');
const baseUrl = process.env.HUBON_BASE_URL ?? 'http://localhost:4200';
const apiUrl = process.env.HUBON_API_URL ?? 'http://localhost:8080/api';
const mode = process.argv[2] ?? 'all';

process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;

const { chromium } = await import('playwright-core');

const routes = [
  ['01-dashboard.png', '/dashboard', 'Operação em tempo real'],
  ['02-mesas.png', '/mesas', 'Mesas'],
  ['03-categorias.png', '/categorias', 'Categorias'],
  ['04-produtos.png', '/produtos', 'Produtos'],
  ['05-comandas.png', '/comandas', 'Comandas'],
  ['06-pedidos.png', '/pedidos', 'Pedidos'],
  ['07-cozinha.png', '/cozinha', 'Cozinha'],
  ['08-caixa.png', '/caixa', 'Caixa'],
  ['09-usuarios.png', '/usuarios', 'Usuários'],
  ['10-relatorios.png', '/relatorios', 'Relatórios'],
];

const videoRouteLabels = [
  ['Mesas', '/mesas'],
  ['Comandas', '/comandas'],
  ['Pedidos', '/pedidos'],
  ['Cozinha', '/cozinha'],
  ['Caixa', '/caixa'],
  ['Dashboard', '/dashboard'],
];

const demo = {
  categoryName: 'Portfólio HubOn',
  productName: 'Menu Portfólio',
  tableNumber: 9901,
  tableName: 'Mesa Demo Portfólio',
  notes: {
    received: '[PORTFOLIO] Pedido recebido',
    preparing: '[PORTFOLIO] Pedido em preparo',
    ready: '[PORTFOLIO] Pedido pronto',
  },
};

if (!['screenshots', 'video', 'all'].includes(mode)) {
  throw new Error(
    `Modo inválido: ${mode}. Use screenshots, video ou all.`,
  );
}

await checkServices();
const operator = await prepareDemoData();
const executablePath = await findBrowserExecutable();

if (mode === 'screenshots' || mode === 'all') {
  await captureScreenshots(executablePath, operator.id);
}

if (mode === 'video' || mode === 'all') {
  await ensureVideoTools();
  await captureVideo(executablePath, operator.id);
}

console.log('Automação de portfólio concluída.');

async function checkServices() {
  console.log(`Verificando frontend em ${baseUrl}...`);
  await waitForHttp(baseUrl);
  console.log(`Verificando API em ${apiUrl}...`);
  await waitForHttp(`${apiUrl}/users`);
}

async function waitForHttp(url) {
  let lastError;

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }

  throw new Error(
    `Serviço indisponível em ${url}. Inicie backend e frontend antes da automação. Motivo: ${lastError?.message}`,
  );
}

async function prepareDemoData() {
  console.log('Preparando dados idempotentes de demonstração...');

  const users = await apiRequest('/users');
  const operator = users.find((user) => user.active);
  if (!operator) {
    throw new Error('Nenhum operador ativo foi encontrado para a demonstração.');
  }

  const categories = await apiRequest('/categories');
  let category = categories.find((item) => item.name === demo.categoryName);
  if (!category) {
    category = await apiRequest('/categories', {
      method: 'POST',
      body: {
        name: demo.categoryName,
        description: 'Categoria estável usada pela automação de portfólio.',
        displayOrder: 99,
        active: true,
      },
    });
  } else if (!category.active) {
    category = await apiRequest(`/categories/${category.id}/activate`, {
      method: 'PATCH',
      body: {},
    });
  }

  const products = await apiRequest('/products');
  let product = products.find(
    (item) =>
      item.name === demo.productName && item.categoryId === category.id,
  );
  if (!product) {
    product = await apiRequest('/products', {
      method: 'POST',
      body: {
        categoryId: category.id,
        name: demo.productName,
        description: 'Produto de demonstração para screenshots e vídeo.',
        price: 34.9,
        active: true,
        imageUrl: null,
      },
    });
  } else if (!product.active) {
    product = await apiRequest(`/products/${product.id}/activate`, {
      method: 'PATCH',
      body: {},
    });
  }

  const tables = await apiRequest('/tables');
  let table = tables.find((item) => item.number === demo.tableNumber);
  if (!table) {
    table = await apiRequest('/tables', {
      method: 'POST',
      body: {
        number: demo.tableNumber,
        name: demo.tableName,
        status: 'AVAILABLE',
        active: true,
      },
    });
  }

  if (!table.active || ['DISABLED', 'RESERVED'].includes(table.status)) {
    table = await apiRequest(`/tables/${table.id}/status`, {
      method: 'PATCH',
      body: { status: 'AVAILABLE' },
    });
  }

  const orders = await apiRequest('/orders');
  const openTabs = await apiRequest('/tabs/open');
  let tab = openTabs.find((item) => item.tableId === table.id);
  if (
    tab &&
    tab.paidAmount === 0 &&
    Date.now() - new Date(tab.openedAt).getTime() > 4 * 60 * 60 * 1000
  ) {
    const tabOrders = orders.filter((order) => order.tabId === tab.id);
    const canRefreshTab = tabOrders.every(
      (order) =>
        order.status !== 'DELIVERED' &&
        order.notes?.startsWith('[PORTFOLIO]'),
    );

    if (canRefreshTab) {
      for (const order of tabOrders) {
        if (order.status !== 'CANCELLED') {
          await apiRequest(`/orders/${order.id}/cancel`, {
            method: 'POST',
            body: {},
          });
        }
      }
      await apiRequest(`/tabs/${tab.id}/cancel`, {
        method: 'POST',
        body: {},
      });
      table = await apiRequest(`/tables/${table.id}`);
      tab = null;
    }
  }

  if (!tab) {
    if (table.status !== 'AVAILABLE') {
      throw new Error(
        `A mesa demo está em ${table.status} sem comanda aberta. Ajuste a mesa ${demo.tableNumber} antes de regenerar a mídia.`,
      );
    }
    tab = await apiRequest('/tabs/open', {
      method: 'POST',
      body: {
        tableId: table.id,
        openedByUserId: operator.id,
        serviceFee: 0,
        discountAmount: 0,
      },
    });
  }

  await ensureOrderStatus(
    orders,
    tab.id,
    product.id,
    operator.id,
    demo.notes.received,
    'SENT_TO_KITCHEN',
  );
  await ensureOrderStatus(
    orders,
    tab.id,
    product.id,
    operator.id,
    demo.notes.preparing,
    'PREPARING',
  );
  await ensureOrderStatus(
    orders,
    tab.id,
    product.id,
    operator.id,
    demo.notes.ready,
    'READY',
  );

  console.log(
    `Dados demo prontos: mesa ${demo.tableNumber}, comanda #${tab.id}.`,
  );
  return operator;
}

async function ensureOrderStatus(
  existingOrders,
  tabId,
  productId,
  operatorId,
  notes,
  targetStatus,
) {
  const exact = existingOrders.find(
    (order) =>
      order.tabId === tabId &&
      order.notes === notes &&
      order.status === targetStatus,
  );
  if (exact) return exact;

  let order = await apiRequest('/orders', {
    method: 'POST',
    body: {
      tabId,
      createdByUserId: operatorId,
      type: 'TABLE',
      notes,
      items: [
        {
          productId,
          quantity: 1,
          notes: 'Apresentação do fluxo operacional.',
        },
      ],
    },
  });

  order = await apiRequest(`/orders/${order.id}/send-to-kitchen`, {
    method: 'POST',
    body: {},
  });

  if (targetStatus === 'PREPARING' || targetStatus === 'READY') {
    order = await apiRequest(`/orders/${order.id}/status`, {
      method: 'PATCH',
      body: { status: 'PREPARING' },
    });
  }
  if (targetStatus === 'READY') {
    order = await apiRequest(`/orders/${order.id}/status`, {
      method: 'PATCH',
      body: { status: 'READY' },
    });
  }

  return order;
}

async function apiRequest(pathname, options = {}) {
  const response = await fetch(`${apiUrl}${pathname}`, {
    method: options.method ?? 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload?.message
        ? payload.message
        : String(payload);
    throw new Error(`${response.status} em ${pathname}: ${message}`);
  }

  return payload;
}

async function captureScreenshots(executablePath, operatorId) {
  await mkdir(screenshotDirectory, { recursive: true });
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });
  const context = await createContext(browser, operatorId);
  const page = await context.newPage();

  try {
    for (const [fileName, route, heading] of routes) {
      console.log(`Capturando ${fileName}...`);
      await openStablePage(page, route, heading);
      await page.screenshot({
        path: path.join(screenshotDirectory, fileName),
        fullPage: false,
      });
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

async function captureVideo(executablePath, operatorId) {
  await mkdir(videoDirectory, { recursive: true });
  const outputPath = path.join(videoDirectory, 'hubon-demo.webm');
  await removeIfExists(outputPath);

  const temporaryDirectory = path.join(
    os.tmpdir(),
    `hubon-video-${Date.now()}`,
  );
  await mkdir(temporaryDirectory, { recursive: true });

  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });
  const context = await createContext(browser, operatorId, {
    recordVideo: {
      dir: temporaryDirectory,
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage();
  const video = page.video();

  try {
    console.log('Gravando demonstração visual...');
    await openStablePage(page, '/dashboard', 'Operação em tempo real');
    await delay(1800);

    for (const [label, route] of videoRouteLabels) {
      const link = page.locator(`a[href="${route}"]`);
      await link.click();
      await page.waitForURL(`${baseUrl}${route}`);
      await waitUntilStable(page);
      await delay(label === 'Cozinha' ? 2200 : 1500);
    }
  } finally {
    await context.close();
    if (video) {
      await video.saveAs(outputPath);
    }
    await browser.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  const videoStats = await stat(outputPath);
  console.log(
    `Vídeo salvo em ${path.relative(repositoryRoot, outputPath)} (${formatBytes(videoStats.size)}).`,
  );
}

async function createContext(browser, operatorId, extraOptions = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    locale: 'pt-BR',
    reducedMotion: 'reduce',
    ...extraOptions,
  });

  await context.addInitScript(
    ({ selectedOperatorId }) => {
      localStorage.setItem('hubon-theme', 'dark');
      localStorage.setItem(
        'hubon-operator-id',
        String(selectedOperatorId),
      );
    },
    { selectedOperatorId: operatorId },
  );

  return context;
}

async function openStablePage(page, route, heading) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('h1', { hasText: heading }).waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  await waitUntilStable(page);
}

async function waitUntilStable(page) {
  await page.waitForFunction(
    () => document.querySelectorAll('.loading-card').length === 0,
    null,
    { timeout: 15_000 },
  );

  const operatorSelect = page.locator('.operator-chip select');
  await operatorSelect.waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const select = document.querySelector('.operator-chip select');
      return select instanceof HTMLSelectElement && select.options.length > 1;
    },
    null,
    { timeout: 15_000 },
  );
  if ((await operatorSelect.inputValue()) !== String(operator.id)) {
    await operatorSelect.selectOption(String(operator.id));
  }

  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });

  const errorPanel = page.locator('.error-panel');
  if (await errorPanel.isVisible()) {
    throw new Error(
      `A tela ${page.url()} carregou com erro: ${await errorPanel.innerText()}`,
    );
  }

  await delay(350);
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      console.log(`Navegador: ${candidate}`);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }

  throw new Error(
    'Chrome ou Edge não foi encontrado. Defina PLAYWRIGHT_CHROME_PATH com o executável do navegador.',
  );
}

async function ensureVideoTools() {
  await mkdir(browsersPath, { recursive: true });
  const entries = await readdir(browsersPath).catch(() => []);
  if (entries.some((entry) => entry.startsWith('ffmpeg-'))) return;

  console.log('Instalando suporte local de vídeo do Playwright...');
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    command,
    ['playwright-core', 'install', 'ffmpeg'],
    {
      cwd: frontendRoot,
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: browsersPath,
      },
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    throw new Error(
      'Não foi possível instalar o suporte de vídeo. Execute novamente com acesso à internet.',
    );
  }
}

async function removeIfExists(filePath) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
