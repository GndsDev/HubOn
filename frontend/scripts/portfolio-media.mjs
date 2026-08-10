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
let authSession;

process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;

const { chromium } = await import('playwright-core');

const routes = [
  ['01-dashboard.png', '/dashboard', 'Operação em tempo real'],
  ['02-comandas.png', '/comandas', 'Comandas'],
  ['03-balcao.png', '/balcao', 'Balcão'],
  ['04-historico.png', '/historico', 'Histórico de vendas'],
  ['05-categorias.png', '/categorias', 'Categorias'],
  ['06-produtos.png', '/produtos', 'Produtos'],
  ['07-estoque.png', '/stock', 'Estoque'],
  ['08-caixa.png', '/caixa', 'Caixa'],
  ['09-relatorios.png', '/relatorios', 'Relatórios'],
  ['10-usuarios.png', '/usuarios', 'Usuários'],
];

const videoRouteLabels = [
  ['Comandas', '/comandas'],
  ['Balcão', '/balcao'],
  ['Produtos', '/produtos'],
  ['Estoque', '/stock'],
  ['Caixa', '/caixa'],
  ['Dashboard', '/dashboard'],
];

const demo = {
  categoryName: 'Portfólio HubOn',
  productName: 'Menu Portfólio',
  tableNumber: 9901,
  itemNotes: '[PORTFOLIO] Item de demonstração',
};

try {
  await run();
} catch (error) {
  console.error(error?.message ?? String(error));
  process.exitCode = 1;
}

async function run() {
  if (!['screenshots', 'video', 'all'].includes(mode)) {
    throw new Error(
      `Modo inválido: ${mode}. Use screenshots, video ou all.`,
    );
  }

  const portfolioCredentials = readPortfolioCredentials();
  await checkServices();
  authSession = await authenticateForPortfolio(portfolioCredentials);
  await prepareDemoData(authSession.user);
  const executablePath = await findBrowserExecutable();

  if (mode === 'screenshots' || mode === 'all') {
    await captureScreenshots(executablePath, authSession);
  }

  if (mode === 'video' || mode === 'all') {
    await ensureVideoTools();
    await captureVideo(executablePath, authSession);
  }

  console.log('Automação de portfólio concluída.');
}

async function checkServices() {
  console.log(`Verificando frontend em ${baseUrl}...`);
  await waitForHttp(baseUrl);
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

function readPortfolioCredentials() {
  const username = process.env.HUBON_PORTFOLIO_USERNAME?.trim().toLowerCase();
  const password = process.env.HUBON_PORTFOLIO_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Configure HUBON_PORTFOLIO_USERNAME e HUBON_PORTFOLIO_PASSWORD para gerar as mídias.',
    );
  }

  return { username, password };
}

async function authenticateForPortfolio({ username, password }) {
  console.log(`Autenticando usuário de portfólio em ${apiUrl}/auth/login...`);
  let lastError;

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const contentType = response.headers.get('content-type') ?? '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      if (response.ok) {
        return payload;
      }

      const message =
        typeof payload === 'object' && payload?.message
          ? payload.message
          : String(payload);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Credenciais de portfólio recusadas: ${message}`);
      }

      lastError = new Error(`${response.status} em /auth/login: ${message}`);
    } catch (error) {
      if (error.message?.startsWith('Credenciais de portfólio recusadas')) {
        throw error;
      }
      lastError = error;
    }

    await delay(500);
  }

  throw new Error(
    `API indisponível em ${apiUrl}. Inicie o backend antes da automação. Motivo: ${lastError?.message}`,
  );
}

async function prepareDemoData(currentUser) {
  console.log('Preparando dados idempotentes de demonstração...');

  if (!currentUser?.active) {
    throw new Error('O usuário autenticado para o portfólio está inativo.');
  }

  if (!currentUser.roles?.some((role) => role === 'OWNER' || role === 'ADMIN')) {
    throw new Error(
      'Use um usuário OWNER ou ADMIN em HUBON_PORTFOLIO_USERNAME para preparar os dados de portfólio.',
    );
  }

  const categories = await apiRequest('/categories');
  let category = categories.find((item) => item.name === demo.categoryName);
  if (!category) {
    category = await apiRequest('/categories', {
      method: 'POST',
      body: {
        name: demo.categoryName,
        displayOrder: 99,
        active: true,
      },
    });
  } else if (!category.active) {
    category = await apiRequest(`/categories/${category.id}`, {
      method: 'PUT',
      body: {
        name: category.name,
        displayOrder: category.displayOrder,
        active: true,
      },
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
        available: true,
        displayOrder: 99,
      },
    });
  } else if (!product.active || !product.available) {
    product = await apiRequest(`/products/${product.id}`, {
      method: 'PUT',
      body: {
        categoryId: category.id,
        name: product.name,
        description: product.description,
        price: product.price,
        active: true,
        available: true,
        displayOrder: product.displayOrder,
      },
    });
  }

  const openSales = await apiRequest('/sales?status=OPEN&type=TABLE');
  let sale = openSales.find((item) => item.tableNumber === demo.tableNumber);
  if (!sale) {
    sale = await apiRequest('/sales', {
      method: 'POST',
      body: {
        type: 'TABLE',
        tableNumber: demo.tableNumber,
        customerName: null,
        customerPhone: null,
        serviceFee: 0,
        discountAmount: 0,
      },
    });
  }

  const demoItem = sale.items.find(
    (item) => item.productId === product.id && !item.cancelledAt,
  );
  if (!demoItem) {
    if (sale.paidAmount > 0) {
      throw new Error(
        `A venda demo #${sale.id} já possui pagamento e não pode receber o item de portfólio.`,
      );
    }
    sale = await apiRequest(`/sales/${sale.id}/items`, {
      method: 'POST',
      body: {
        productId: product.id,
        quantity: 1,
        notes: demo.itemNotes,
        optionIds: [],
      },
    });
  }

  console.log(
    `Dados demo prontos: mesa ${demo.tableNumber}, venda #${sale.id}.`,
  );
}

async function apiRequest(pathname, options = {}) {
  if (!authSession?.token) {
    throw new Error('Sessão de portfólio ausente. Faça login antes de chamar a API.');
  }

  const response = await fetch(`${apiUrl}${pathname}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${authSession.token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
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

async function captureScreenshots(executablePath, session) {
  await mkdir(screenshotDirectory, { recursive: true });
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });
  const context = await createContext(browser, session);
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

async function captureVideo(executablePath, session) {
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
  const context = await createContext(browser, session, {
    recordVideo: {
      dir: temporaryDirectory,
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage();
  const video = page.video();

  try {
    console.log('Gravando demonstração visual...');
    await openStablePage(
      page,
      '/dashboard',
      'Operação em tempo real',
    );
    await delay(1800);

    for (const [label, route] of videoRouteLabels) {
      const link = page.locator(`a[href="${route}"]`);
      await link.click();
      await page.waitForURL(`${baseUrl}${route}`);
      await waitUntilStable(page);
      await delay(label === 'Balcão' ? 1800 : 1500);
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

async function createContext(browser, session, extraOptions = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    locale: 'pt-BR',
    reducedMotion: 'reduce',
    ...extraOptions,
  });

  await context.addInitScript(
    ({ authSessionValue }) => {
      localStorage.setItem('hubon-theme', 'dark');
      localStorage.setItem('hubon-auth-session', authSessionValue);
      localStorage.removeItem('hubon-operator-id');
    },
    { authSessionValue: JSON.stringify(session) },
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
