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
const categoryNames = [
  'Bebidas Diversas',
  'Caldos',
  'Carreteiro Completo',
  'Cervejas 600 ml',
  'Drinks',
  'Espetinhos - Carnes',
  'Espetinhos - Diversos',
  'Jantinha Completa',
  'Long Neck',
  'Petiscos',
  'Porções',
  'Sobremesas artesanais para compartilhar',
];
const categories = categoryNames.map((name, index) => ({
  id: index + 1,
  name,
  description: `Categoria ${name}`,
  active: true,
  displayOrder: index,
  createdAt: now,
  updatedAt: now,
}));

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
  product(1, 8, 'Jantinha Completa', jantinhaName, 'REQUIRES_PREPARATION', jantinhaVariants, jantinhaGroups),
  product(2, 1, 'Bebidas Diversas', 'Coca-Cola', 'DIRECT_SERVICE', cocaVariants),
  product(3, 11, 'Porções', 'Porção de Arroz', 'REQUIRES_PREPARATION', riceVariants),
  product(4, 1, 'Bebidas Diversas', 'Suco temporariamente indisponível', 'DIRECT_SERVICE', [], [], { available: false, complete: false }),
  ...categoryNames
    .filter((categoryName) => !['Bebidas Diversas', 'Jantinha Completa', 'Porções'].includes(categoryName))
    .map((categoryName, index) => {
      const productId = 20 + index;
      const productName = `Produto de ${categoryName}`;
      return product(
        productId,
        categories.find((category) => category.name === categoryName).id,
        categoryName,
        productName,
        index % 2 === 0 ? 'DIRECT_SERVICE' : 'REQUIRES_PREPARATION',
        [variant(200 + index, productId, productName, 'Padrão', 8 + index)],
      );
    }),
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

function reportPerformance(index, netRevenue) {
  const closedTabs = 8 + index % 5;
  const grossRevenue = netRevenue + 24;
  const serviceFees = 16;
  const discounts = 8;
  return {
    closedTabs,
    orders: closedTabs + 2,
    itemsSold: closedTabs * 3,
    grossRevenue,
    serviceFees,
    discounts,
    netRevenue,
    receivedAmount: netRevenue,
    averageTicket: Number((netRevenue / closedTabs).toFixed(2)),
  };
}

const reportSales = Array.from({ length: 45 }, (_, index) => {
  const finalAmount = 32 + index * 1.75;
  return {
    id: 5000 + index,
    origin: index % 3 === 0 ? `Balcão #${120 + index}` : `Mesa ${(index % 18) + 1}`,
    openedAt: `2026-07-${String((index % 27) + 1).padStart(2, '0')}T${String(11 + index % 10).padStart(2, '0')}:00:00`,
    closedAt: `2026-07-${String((index % 27) + 1).padStart(2, '0')}T${String(11 + index % 10).padStart(2, '0')}:37:00`,
    durationMinutes: 37,
    responsible: index % 2 === 0 ? 'Gabriel Owner' : 'Operador com nome extenso para validar a coluna',
    orders: 1 + index % 3,
    items: 2 + index % 6,
    grossRevenue: finalAmount + 4,
    serviceFees: 4,
    discounts: 0,
    finalAmount,
    receivedAmount: finalAmount,
    paymentMethods: index % 2 === 0 ? 'PIX' : 'Cartão de crédito + Dinheiro',
  };
});

const monthlyReport = {
  year: 2026, month: 7, periodLabel: 'julho de 2026', channel: 'ALL',
  summary: {
    grossRevenue: 8420,
    serviceFees: 320,
    discounts: 180,
    netRevenue: 8240,
    receivedAmount: 8240,
    closedTabs: 186,
    orders: 194,
    itemsSold: 438,
    averageTicket: 44.3,
    tableSales: 144,
    counterSales: 42,
    cancelledOrders: 3,
    cancelledItems: 5,
    cancelledAmount: 145,
  },
  comparison: { previousMonthNetRevenue: 7600, netRevenueDifference: 640, percentageChange: 8.42 },
  products: [
    'Combo executivo com acompanhamento especial',
    'Café coado',
    'Açaí tradicional',
    'Água mineral',
    'Bolo de cenoura',
    'Coca-Cola',
    'Espetinho misto',
    'Hambúrguer artesanal',
    'Limonada suíça',
    'Pão de queijo',
    'Porção de fritas',
    'Salada da casa',
    'Suco de laranja',
    'Torta de frango',
  ].map((productName, index) => {
    const quantity = index === 0 ? 12 : 44 - index;
    const salesAmount = 920 - index * 42;
    const smallerQuantity = Math.floor(quantity * 0.4);
    const smallerAmount = Math.floor(salesAmount * 0.4);
    return {
      productName,
      categoryName: index % 3 === 0 ? 'Bebidas' : 'Pratos',
      quantity,
      salesAmount,
      revenueSharePercentage: 11 - index * 0.4,
      variants: index % 3 === 0
        ? [
            { variantName: '600 mL', quantity: smallerQuantity, salesAmount: smallerAmount },
            { variantName: 'Lata', quantity: quantity - smallerQuantity, salesAmount: salesAmount - smallerAmount },
          ]
        : [{ variantName: 'Padrão', quantity, salesAmount }],
    };
  }),
  categories: [{ categoryName: 'Pratos', quantity: 310, salesAmount: 6200, revenueSharePercentage: 75.24 }, { categoryName: 'Bebidas', quantity: 128, salesAmount: 2040, revenueSharePercentage: 24.76 }],
  paymentMethods: [{ method: 'PIX', payments: 102, amount: 4500, receivedSharePercentage: 54.61 }, { method: 'CREDIT_CARD', payments: 56, amount: 2700, receivedSharePercentage: 32.77 }, { method: 'CASH', payments: 28, amount: 1040, receivedSharePercentage: 12.62 }],
  channels: [{ channel: 'TABLE', closedTabs: 144, netRevenue: 6900, averageTicket: 47.92 }, { channel: 'COUNTER', closedTabs: 42, netRevenue: 1340, averageTicket: 31.9 }],
  daily: Array.from({ length: 31 }, (_, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, '0')}`,
    ...reportPerformance(index, 240 + index * 8),
  })),
  sales: reportSales,
  cancellations: { cancelledOrders: 3, cancelledItems: 5, cancelledAmount: 145, mainReasons: [{ reason: 'Cliente desistiu', occurrences: 3 }, { reason: 'Item indisponível', occurrences: 2 }] },
};

const dailyReport = {
  date: '2026-07-27',
  periodLabel: '27 de julho de 2026',
  channel: 'ALL',
  summary: {
    grossRevenue: 492,
    serviceFees: 18,
    discounts: 10,
    netRevenue: 482,
    receivedAmount: 482,
    closedTabs: 12,
    orders: 15,
    itemsSold: 38,
    averageTicket: 40.17,
    tableSales: 8,
    counterSales: 4,
    cancelledOrders: 1,
    cancelledItems: 2,
    cancelledAmount: 38,
  },
  comparison: { previousDayNetRevenue: 440, netRevenueDifference: 42, percentageChange: 9.55 },
  products: monthlyReport.products,
  categories: monthlyReport.categories,
  paymentMethods: monthlyReport.paymentMethods,
  channels: monthlyReport.channels,
  hourly: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    hourLabel: `${String(hour).padStart(2, '0')}:00`,
    ...reportPerformance(hour, hour >= 11 && hour <= 22 ? 18 + hour * 2 : 0),
  })),
  sales: reportSales.slice(0, 18),
  cancellations: { cancelledOrders: 1, cancelledItems: 2, cancelledAmount: 38, mainReasons: [{ reason: 'Item indisponível', occurrences: 2 }] },
};

const annualReport = {
  year: 2026, periodLabel: 'Ano de 2026', channel: 'ALL',
  summary: {
    grossRevenue: 92400,
    serviceFees: 3280,
    discounts: 1940,
    netRevenue: 93740,
    receivedAmount: 93740,
    closedTabs: 2180,
    orders: 2260,
    itemsSold: 5124,
    averageTicket: 43,
    tableSales: 1700,
    counterSales: 480,
    cancelledOrders: 18,
    cancelledItems: 23,
    cancelledAmount: 620,
  },
  comparison: { previousYearNetRevenue: 86400, netRevenueDifference: 7340, percentageChange: 8.5 },
  products: monthlyReport.products.map((product, index) => ({
    ...product,
    quantity: product.quantity * 10 + index,
    salesAmount: product.salesAmount * 10 + index * 25,
  })),
  categories: monthlyReport.categories,
  paymentMethods: monthlyReport.paymentMethods,
  channels: monthlyReport.channels,
  monthly: [
    ['Janeiro', 7200], ['Fevereiro', 6840], ['Março', 7550], ['Abril', 7900],
    ['Maio', 8120], ['Junho', 7600], ['Julho', 8240], ['Agosto', 8450],
    ['Setembro', 8010], ['Outubro', 8790], ['Novembro', 9020], ['Dezembro', 10020],
  ].map(([monthLabel, netRevenue], index) => ({
    month: index + 1,
    monthLabel,
    ...reportPerformance(index, netRevenue),
    cancelledAmount: 24 + index * 5,
  })),
  sales: reportSales,
  indicators: {
    bestMonthLabel: 'Dezembro',
    bestMonthNetRevenue: 10020,
    averageMonthlyRevenue: 7811.67,
    activeMonths: 12,
  },
  cancellations: { cancelledOrders: 18, cancelledItems: 23, cancelledAmount: 620, mainReasons: [{ reason: 'Cliente desistiu', occurrences: 12 }] },
};

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
}

async function mockApi(page) {
  const state = {
    dailyReport,
    monthlyReport,
    annualReport,
    reportDelayMs: 0,
    reportError: false,
    reportRequests: 0,
  };
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
    if (/^\/tabs\/\d+$/.test(apiPath) && method === 'GET') {
      return json(route, tabs.find((item) => item.id === Number(apiPath.split('/').at(-1))) ?? tableTab);
    }
    if (apiPath === '/reports/daily') {
      state.reportRequests += 1;
      if (state.reportDelayMs) await new Promise((resolve) => setTimeout(resolve, state.reportDelayMs));
      if (state.reportError) return json(route, { message: 'Não foi possível carregar o relatório de teste.' }, 500);
      return json(route, state.dailyReport);
    }
    if (apiPath === '/reports/monthly') {
      state.reportRequests += 1;
      if (state.reportDelayMs) await new Promise((resolve) => setTimeout(resolve, state.reportDelayMs));
      if (state.reportError) return json(route, { message: 'Não foi possível carregar o relatório de teste.' }, 500);
      return json(route, state.monthlyReport);
    }
    if (apiPath === '/reports/annual') {
      state.reportRequests += 1;
      if (state.reportDelayMs) await new Promise((resolve) => setTimeout(resolve, state.reportDelayMs));
      if (state.reportError) return json(route, { message: 'Não foi possível carregar o relatório de teste.' }, 500);
      return json(route, state.annualReport);
    }
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
  return state;
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
    const categoryStrip = document.querySelector('.counter-category-filter');
    const categoryButtons = Array.from(categoryStrip?.querySelectorAll('button') ?? []);
    const categoryButtonBoxes = categoryButtons.map((button) => button.getBoundingClientRect());
    const categoryOverlaps = categoryButtonBoxes.some((box, index) => categoryButtonBoxes.slice(index + 1).some((other) => (
      Math.max(0, Math.min(box.right, other.right) - Math.max(box.left, other.left))
      * Math.max(0, Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top)) > 1
    )));
    const categoryStripBox = categoryStrip?.getBoundingClientRect();
    const categoryStyle = categoryStrip ? getComputedStyle(categoryStrip) : null;
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
    const actionGroups = Array.from(document.querySelectorAll('.page-header > .page-header-actions'));
    const actionItems = Array.from(actionGroups[0]?.children ?? [])
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return element.matches('button, a') && box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((element) => element.getBoundingClientRect())
      .sort((left, right) => Math.abs(left.top - right.top) < 2 ? left.left - right.left : left.top - right.top);
    const actionGaps = actionItems.slice(1)
      .filter((box, index) => Math.abs(box.top - actionItems[index].top) < 2)
      .map((box, index) => Math.round((box.left - actionItems[index].right) * 100) / 100);
    const actionGroupBox = actionGroups[0]?.getBoundingClientRect();
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
      categoryStrip: categoryStrip ? {
        buttonCount: categoryButtons.length,
        contentOverflow: categoryStrip.scrollWidth - categoryStrip.clientWidth,
        horizontalScrollEnabled: ['auto', 'scroll'].includes(categoryStyle?.overflowX),
        verticalOverflow: categoryStrip.scrollHeight - categoryStrip.clientHeight,
        insideViewport: !!categoryStripBox && categoryStripBox.left >= -1 && categoryStripBox.right <= innerWidth + 1,
        overlaps: categoryOverlaps,
        clippedButtons: categoryButtons.filter((button) => button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1).length,
        shrinkableButtons: categoryButtons.filter((button) => getComputedStyle(button).flexShrink !== '0').length,
        wrappedButtons: categoryButtons.filter((button) => getComputedStyle(button).whiteSpace !== 'nowrap').length,
      } : null,
      clippedFlowBadges,
      clippedOrderElements,
      orderFiltersOverflow: Math.max(0, (document.querySelector('.order-filters')?.scrollWidth ?? 0) - (document.querySelector('.order-filters')?.clientWidth ?? 0)),
      overlaps: document.querySelectorAll('.modal-panel').length > 1,
      kitchenNavigationLinks: Array.from(document.querySelectorAll('a')).filter((link) => link.textContent?.trim() === 'Cozinha').length,
      startPreparationActions: Array.from(document.querySelectorAll('button, a')).filter((element) => element.textContent?.includes('Iniciar preparo')).length,
      paymentActionCount: Array.from(document.querySelectorAll('button')).filter((button) => /Registrar pagamento|Completar pagamento/.test(button.textContent ?? '')).length,
      pageActions: actionGroups.length ? {
        groupCount: actionGroups.length,
        itemCount: actionItems.length,
        gaps: actionGaps,
        heightDelta: actionItems.length ? Math.max(...actionItems.map((box) => box.height)) - Math.min(...actionItems.map((box) => box.height)) : 0,
        insideViewport: !!actionGroupBox && actionGroupBox.left >= -1 && actionGroupBox.right <= innerWidth + 1,
        ungroupedActions: document.querySelectorAll('.page-header > button, .page-header > a').length,
      } : null,
    };
  }, { screen, viewport, theme });
}

async function categoryScrollMetrics(page, viewport, theme) {
  const strip = page.locator('.counter-category-filter');
  const lastButton = strip.locator('button').last();
  await lastButton.click();
  await page.waitForTimeout(100);
  return strip.evaluate((element, metadata) => {
    const active = element.querySelector('button[aria-pressed="true"]');
    const activeBox = active?.getBoundingClientRect();
    const stripBox = element.getBoundingClientRect();
    return {
      screen: 'counter-category-scroll',
      ...metadata,
      scrollLeft: element.scrollLeft,
      maxScrollLeft: element.scrollWidth - element.clientWidth,
      activeCategory: active?.textContent?.trim() ?? '',
      activeInsideStrip: !!activeBox && activeBox.left >= stripBox.left - 1 && activeBox.right <= stripBox.right + 1,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, { viewport, theme });
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

async function dialogMetrics(page, selector, screen, viewport, theme) {
  return page.locator(selector).evaluate((panel, metadata) => {
    const directRegion = (className) => Array.from(panel.children).find((child) => child.classList.contains(className));
    const header = directRegion('modal-header');
    const body = directRegion('modal-body');
    const footer = directRegion('modal-footer');
    const panelBox = panel.getBoundingClientRect();
    const headerBox = header?.getBoundingClientRect();
    const bodyBox = body?.getBoundingClientRect();
    const footerBox = footer?.getBoundingClientRect();
    const closeBox = header?.querySelector('.icon-button')?.getBoundingClientRect();
    const bodyStyle = body ? getComputedStyle(body) : null;
    const headerStyle = header ? getComputedStyle(header) : null;
    const footerStyle = footer ? getComputedStyle(footer) : null;
    const number = (value) => Number.parseFloat(value || '0');
    return {
      ...metadata,
      regionCount: [header, body, footer].filter(Boolean).length,
      panelInsideViewport: panelBox.left >= -1 && panelBox.top >= -1 && panelBox.right <= innerWidth + 1 && panelBox.bottom <= innerHeight + 1,
      panelHorizontalOverflow: Math.max(0, panel.scrollWidth - panel.clientWidth),
      panelVerticalOverflow: Math.max(0, panel.scrollHeight - panel.clientHeight),
      bodyScrollable: !!body && body.scrollHeight > body.clientHeight + 1,
      footerVisible: !!footerBox && footerBox.top >= 0 && footerBox.bottom <= innerHeight,
      regionOverlap: !headerBox || !bodyBox || !footerBox
        ? true
        : headerBox.bottom > bodyBox.top + 1 || bodyBox.bottom > footerBox.top + 1,
      safePadding: {
        headerLeft: number(headerStyle?.paddingLeft),
        headerRight: number(headerStyle?.paddingRight),
        bodyLeft: number(bodyStyle?.paddingLeft),
        bodyRight: number(bodyStyle?.paddingRight),
        footerLeft: number(footerStyle?.paddingLeft),
        footerRight: number(footerStyle?.paddingRight),
      },
      closeControl: closeBox ? { width: closeBox.width, height: closeBox.height, insideHeader: closeBox.left >= headerBox.left && closeBox.right <= headerBox.right && closeBox.top >= headerBox.top && closeBox.bottom <= headerBox.bottom } : null,
    };
  }, { screen, viewport, theme });
}

async function reportSortMetrics(page, screen, viewport, theme, requestDelta = 0) {
  return page.evaluate(({ screen, viewport, theme, requestDelta }) => {
    const container = document.querySelector('.report-product-sort');
    const section = container?.closest('.section-card');
    const criteria = Array.from(document.querySelectorAll('.report-sort-criteria button'));
    const direction = document.querySelector('.report-sort-direction');
    const controls = [...criteria, direction].filter(Boolean);
    const boxes = controls.map((control) => control.getBoundingClientRect());
    const productNames = Array.from(document.querySelectorAll('.report-product-row summary > strong'))
      .map((element) => element.firstChild?.textContent?.trim() ?? '');
    const params = new URL(location.href).searchParams;
    const periodOptions = Array.from(document.querySelectorAll('.report-filters > .field:first-child .segmented-control button'))
      .map((button) => ({
        label: button.textContent?.trim() ?? '',
        active: button.classList.contains('active'),
        pressed: button.getAttribute('aria-pressed'),
        background: getComputedStyle(button).backgroundColor,
      }));
    const activeChannel = document.querySelector('.report-channel-filter .segmented-control button.active');
    const containerBox = container?.getBoundingClientRect();
    const sectionBox = section?.getBoundingClientRect();
    const overlaps = boxes.some((box, index) => boxes.slice(index + 1).some((other) => (
      Math.max(0, Math.min(box.right, other.right) - Math.max(box.left, other.left))
      * Math.max(0, Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top)) > 1
    )));
    return {
      screen,
      viewport,
      theme,
      requestDelta,
      countLabel: document.querySelector('.report-product-count')?.textContent?.trim() ?? '',
      contextualLabel: document.querySelector('.report-product-sort-label')?.textContent?.trim() ?? '',
      criterionCount: criteria.length,
      activeCriterion: criteria.find((button) => button.getAttribute('aria-pressed') === 'true')?.textContent?.trim() ?? '',
      activeCriterionCount: criteria.filter((button) => button.getAttribute('aria-pressed') === 'true').length,
      directionText: direction?.textContent?.trim() ?? '',
      directionAriaLabel: direction?.getAttribute('aria-label') ?? '',
      announcement: document.querySelector('.report-product-sort [aria-live="polite"]')?.textContent?.trim() ?? '',
      focusedControl: document.activeElement?.closest('.report-product-sort') ? document.activeElement.textContent?.trim() ?? '' : '',
      productNames,
      periodOptions,
      activeChannelBackground: activeChannel ? getComputedStyle(activeChannel).backgroundColor : '',
      query: { sort: params.get('sort'), direction: params.get('direction') },
      controlsInsideSection: !!containerBox && !!sectionBox && containerBox.left >= sectionBox.left - 1 && containerBox.right <= sectionBox.right + 1,
      clippedControls: controls.filter((control) => control.scrollWidth > control.clientWidth + 1 || control.scrollHeight > control.clientHeight + 1).length,
      overlaps,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, { screen, viewport, theme, requestDelta });
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
    const apiState = await mockApi(page);
    for (const [route, screen] of routes) {
      const name = `${screen}-${theme}-${viewport.label}`;
      await openRoute(page, route, name);
      results.push(await viewportChecks(page, screen, viewport.label, theme));
      if (screen === 'counter-detail') {
        results.push(await categoryScrollMetrics(page, viewport.label, theme));
        await screenshot(page, `counter-category-scrolled-${theme}-${viewport.label}`);
      }
      if (screen === 'dashboard') {
        await page.locator('.sidebar-toggle').click();
        await page.waitForFunction(() => Math.abs((document.querySelector('.hub-sidebar')?.getBoundingClientRect().width ?? 0) - 72) < 1);
        const collapsedWidth = await page.locator('.hub-sidebar').evaluate((element) => element.getBoundingClientRect().width);
        results.push({ screen: 'sidebar-collapsed', viewport: viewport.label, theme, collapsedWidth });
        await screenshot(page, `sidebar-collapsed-${theme}-${viewport.label}`);
        await page.locator('.sidebar-toggle').click();
      }
      if (screen === 'reports') {
        await page.waitForFunction(() => new URL(location.href).searchParams.get('sort') === 'REVENUE');
        const reportRequestsBeforeSort = apiState.reportRequests;
        results.push(await reportSortMetrics(page, 'report-sort-revenue', viewport.label, theme, apiState.reportRequests - reportRequestsBeforeSort));

        const trigger = page.locator('.page-header-actions [aria-controls="report-export-menu"]');
        await trigger.click();
        await waitForOverlay(page, '.report-export-menu');
        await screenshot(page, `reports-export-menu-${theme}-${viewport.label}`);
        const menuItems = await page.locator('.report-export-menu [role="menuitem"]').allTextContents();
        const firstItemFocused = await page.locator('.report-export-menu [role="menuitem"]').first().evaluate((element) => element === document.activeElement);
        results.push({
          screen: 'reports-export-menu',
          viewport: viewport.label,
          theme,
          overlay: await overlayBounds(page, '.report-export-menu'),
          menuItems: menuItems.map((item) => item.trim()),
          firstItemFocused,
        });
        await page.keyboard.press('Escape');
        await page.locator('.report-export-menu').waitFor({ state: 'detached' });
        results.push({
          screen: 'reports-export-focus-return',
          viewport: viewport.label,
          theme,
          focusRestored: await trigger.evaluate((element) => element === document.activeElement),
        });

        await page.getByRole('button', { name: 'Quantidade', exact: true }).click();
        await page.waitForFunction(() => new URL(location.href).searchParams.get('sort') === 'QUANTITY');
        await page.waitForFunction(() => document.querySelector('.report-sort-criteria button[aria-pressed="true"]')?.textContent?.trim() === 'Quantidade');
        results.push(await reportSortMetrics(page, 'report-sort-quantity', viewport.label, theme, apiState.reportRequests - reportRequestsBeforeSort));

        await page.getByRole('button', { name: /Ordem decrescente/ }).click();
        await page.waitForFunction(() => new URL(location.href).searchParams.get('direction') === 'ASC');
        await page.waitForFunction(() => document.querySelector('.report-sort-direction')?.textContent?.trim() === 'Crescente');
        results.push(await reportSortMetrics(page, 'report-sort-direction', viewport.label, theme, apiState.reportRequests - reportRequestsBeforeSort));

        const nameSort = page.getByRole('button', { name: 'Nome', exact: true });
        await nameSort.focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => new URL(location.href).searchParams.get('sort') === 'NAME');
        await page.waitForFunction(() => document.querySelector('.report-sort-criteria button[aria-pressed="true"]')?.textContent?.trim() === 'Nome');
        results.push(await reportSortMetrics(page, 'report-sort-name-keyboard', viewport.label, theme, apiState.reportRequests - reportRequestsBeforeSort));
        await screenshot(page, `report-sort-name-${theme}-${viewport.label}`);

        await page.getByRole('button', { name: 'Diário', exact: true }).click();
        await page.getByRole('heading', { name: 'Relatório diário', exact: true }).waitFor({ state: 'visible' });
        await page.waitForFunction(() => document.querySelector('.report-product-count')?.textContent?.includes('14 produtos'));
        await page.waitForFunction(() => Array.from(document.querySelectorAll('.report-filters > .field:first-child button'))
          .every((button) => button.getAnimations().every((animation) => animation.playState === 'finished')));
        const reportRequestsBeforeDailySort = apiState.reportRequests;
        results.push(await reportSortMetrics(page, 'report-sort-daily', viewport.label, theme, apiState.reportRequests - reportRequestsBeforeDailySort));
        await screenshot(page, `report-sort-daily-${theme}-${viewport.label}`);

        await page.getByRole('button', { name: 'Anual', exact: true }).click();
        await page.getByRole('heading', { name: 'Relatório anual', exact: true }).waitFor({ state: 'visible' });
        await page.waitForFunction(() => document.querySelector('.report-product-count')?.textContent?.includes('14 produtos'));
        await page.waitForFunction(() => Array.from(document.querySelectorAll('.report-filters > .field:first-child button'))
          .every((button) => button.getAnimations().every((animation) => animation.playState === 'finished')));
        const reportRequestsBeforeAnnualSort = apiState.reportRequests;
        results.push(await reportSortMetrics(page, 'report-sort-annual', viewport.label, theme, apiState.reportRequests - reportRequestsBeforeAnnualSort));
        await screenshot(page, `report-sort-annual-${theme}-${viewport.label}`);
      }
      if (screen === 'tabs') {
        await page.locator('.collection-card-button').first().click();
        await page.locator('[aria-labelledby="tab-details-dialog-title"]').waitFor({ state: 'visible' });
        await screenshot(page, `tab-details-${theme}-${viewport.label}`);
        results.push(await dialogMetrics(page, '[aria-labelledby="tab-details-dialog-title"]', 'tab-details', viewport.label, theme));
        await page.keyboard.press('Escape');
        await page.locator('[aria-labelledby="tab-details-dialog-title"]').waitFor({ state: 'detached' });
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
        results.push(await dialogMetrics(page, '.product-management-dialog', 'product-management-dialog', viewport.label, theme));
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
  const apiState = await mockApi(page);

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
  results.push(await dialogMetrics(page, '.product-wizard-panel', 'product-wizard', '1440x900', theme));
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
  results.push(await dialogMetrics(page, '.order-builder-panel', 'order-builder', '1440x900', theme));
  await page.keyboard.press('Escape');
  await waitForDialogCleanup(page);
  await page.locator('.order-card .actions-trigger').first().click();
  await waitForOverlay(page, '.order-action-menu');
  await page.getByRole('menuitem', { name: 'Cancelar pedido' }).click();
  await screenshot(page, `order-cancel-${theme}`);
  results.push(await dialogMetrics(page, '[aria-labelledby="cancel-title"]', 'order-cancel', '1440x900', theme));
  await page.keyboard.press('Escape');

  await page.goto(`${baseUrl}/comandas`, { waitUntil: 'networkidle' });
  await page.locator('.collection-card-button').first().click();
  await page.getByRole('button', { name: 'Registrar pagamento' }).click();
  await screenshot(page, `table-payment-${theme}`);
  results.push({ screen: 'table-payment', theme, overlay: await overlayBounds(page, '.payment-dialog') });
  results.push(await dialogMetrics(page, '.payment-dialog', 'table-payment-dialog', '1440x900', theme));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.goto(`${baseUrl}/balcao/106`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Completar pagamento' }).click();
  await screenshot(page, `counter-partial-payment-${theme}`);
  results.push({ screen: 'counter-partial-payment', theme, overlay: await overlayBounds(page, '.payment-dialog') });
  results.push(await dialogMetrics(page, '.payment-dialog', 'counter-payment-dialog', '1440x900', theme));
  await page.keyboard.press('Escape');

  await page.goto(`${baseUrl}/balcao/105`, { waitUntil: 'networkidle' });
  await page.locator('.counter-product').first().click();
  await screenshot(page, `counter-product-options-${theme}`);
  results.push({ screen: 'counter-product-options', theme, overlay: await overlayBounds(page, '.modal-panel') });
  results.push(await dialogMetrics(page, '.modal-panel', 'counter-product-options-dialog', '1440x900', theme));
  await page.keyboard.press('Escape');

  await page.goto(`${baseUrl}/caixa`, { waitUntil: 'networkidle' });
  results.push({ screen: 'cashier-payment-duplication', theme, paymentActions: await page.getByRole('button', { name: /Registrar pagamento|Completar pagamento/ }).count() });
  await page.getByRole('button', { name: 'Registrar sangria' }).click();
  await screenshot(page, `cashier-withdrawal-${theme}`);
  results.push(await dialogMetrics(page, '[aria-labelledby="cash-movement-title"]', 'cashier-withdrawal-dialog', '1440x900', theme));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Fechar caixa' }).click();
  await screenshot(page, `cashier-closing-${theme}`);
  results.push({ screen: 'cashier-closing', theme, overlay: await overlayBounds(page, '.modal-panel') });
  results.push(await dialogMetrics(page, '[aria-labelledby="cash-close-title"]', 'cashier-closing-dialog', '1440x900', theme));
  await page.keyboard.press('Escape');

  const tiedProducts = [
    { ...monthlyReport.products[0], productName: 'Bolo', quantity: 10, salesAmount: 100 },
    { ...monthlyReport.products[1], productName: 'Água', quantity: 10, salesAmount: 100 },
    { ...monthlyReport.products[2], productName: 'Açaí', quantity: 10, salesAmount: 100 },
  ];
  const reportSortScenarios = [
    { name: 'report-sort-zero', products: [] },
    { name: 'report-sort-one', products: monthlyReport.products.slice(0, 1) },
    { name: 'report-sort-two', products: monthlyReport.products.slice(0, 2) },
    { name: 'report-sort-ties', products: tiedProducts },
    { name: 'report-sort-long', products: monthlyReport.products },
  ];
  for (const scenario of reportSortScenarios) {
    apiState.monthlyReport = { ...monthlyReport, products: scenario.products };
    await page.goto(`${baseUrl}/relatorios`, { waitUntil: 'networkidle' });
    await page.locator('.report-product-sort').waitFor({ state: 'visible' });
    await page.waitForFunction(() => new URL(location.href).searchParams.get('sort') === 'REVENUE');
    await page.locator('.report-product-sort').scrollIntoViewIfNeeded();
    await screenshot(page, `${scenario.name}-${theme}`);
    results.push(await reportSortMetrics(page, scenario.name, '1440x900', theme));
  }
  apiState.monthlyReport = monthlyReport;

  apiState.reportDelayMs = 800;
  await page.goto(`${baseUrl}/relatorios`, { waitUntil: 'domcontentloaded' });
  await page.locator('.report-loading').waitFor({ state: 'visible' });
  await screenshot(page, `monthly-report-loading-${theme}`);
  results.push(await viewportChecks(page, 'reports-loading', '1440x900', theme));
  await page.locator('.report-metrics').waitFor({ state: 'visible' });
  apiState.reportDelayMs = 0;

  apiState.monthlyReport = { ...monthlyReport, summary: { ...monthlyReport.summary, closedTabs: 0 } };
  await page.goto(`${baseUrl}/relatorios`, { waitUntil: 'networkidle' });
  await page.locator('.empty-panel').waitFor({ state: 'visible' });
  await screenshot(page, `monthly-report-empty-${theme}`);
  results.push(await viewportChecks(page, 'reports-empty', '1440x900', theme));

  apiState.reportError = true;
  await page.goto(`${baseUrl}/relatorios`, { waitUntil: 'networkidle' });
  await page.locator('.error-panel').waitFor({ state: 'visible' });
  await screenshot(page, `monthly-report-error-${theme}`);
  results.push(await viewportChecks(page, 'reports-error', '1440x900', theme));
  apiState.reportError = false;
  apiState.monthlyReport = monthlyReport;

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
  results.push(await dialogMetrics(page, '[aria-labelledby="movement-dialog-title"]', 'stock-manual-exit-dialog', '1440x900', theme));

  await context.close();
}

await browser.close();
await writeFile(path.join(outputDir, 'audit-results.json'), JSON.stringify(results, null, 2));

function invalidReportSortResult(result) {
  if (!result.screen?.startsWith('report-sort-')) return false;
  if (!result.controlsInsideSection || result.clippedControls > 0 || result.overlaps || result.requestDelta > 0) return true;

  const expectations = {
    'report-sort-zero': { count: 'Nenhum produto vendido no período', controls: 0 },
    'report-sort-one': { count: '1 produto no período', controls: 0 },
    'report-sort-two': { count: '2 produtos no período', controls: 3 },
    'report-sort-ties': { count: '3 produtos no período', controls: 3 },
    'report-sort-long': { count: '14 produtos no período', controls: 3 },
    'report-sort-revenue': { count: '14 produtos no período', controls: 3, active: 'Faturamento', direction: 'Decrescente', sort: 'REVENUE', queryDirection: 'DESC' },
    'report-sort-quantity': { count: '14 produtos no período', controls: 3, active: 'Quantidade', direction: 'Decrescente', sort: 'QUANTITY', queryDirection: 'DESC' },
    'report-sort-direction': { count: '14 produtos no período', controls: 3, active: 'Quantidade', direction: 'Crescente', sort: 'QUANTITY', queryDirection: 'ASC' },
    'report-sort-name-keyboard': { count: '14 produtos no período', controls: 3, active: 'Nome', direction: 'Crescente', sort: 'NAME', queryDirection: 'ASC' },
    'report-sort-daily': { count: '14 produtos no período', controls: 3, active: 'Nome', direction: 'Crescente', sort: 'NAME', queryDirection: 'ASC' },
    'report-sort-annual': { count: '14 produtos no período', controls: 3, active: 'Nome', direction: 'Crescente', sort: 'NAME', queryDirection: 'ASC' },
  }[result.screen];
  if (!expectations || result.countLabel !== expectations.count || result.criterionCount !== expectations.controls) return true;
  if (expectations.controls === 0) return result.activeCriterionCount !== 0 || result.directionText !== '';
  if (result.contextualLabel !== 'Ordenar produtos por' || result.activeCriterionCount !== 1
    || !result.directionAriaLabel.startsWith('Ordem ') || !result.announcement.startsWith('Produtos ordenados por ')) return true;
  if (expectations.active && (result.activeCriterion !== expectations.active
    || result.directionText !== expectations.direction
    || result.query.sort !== expectations.sort
    || result.query.direction !== expectations.queryDirection)) return true;
  if (result.screen === 'report-sort-ties' && result.productNames.join('|') !== 'Açaí|Água|Bolo') return true;
  if (result.screen === 'report-sort-name-keyboard' && result.focusedControl !== 'Nome') return true;
  if (result.screen === 'report-sort-revenue' && result.periodOptions?.find((option) => option.label === 'Mensal')?.active !== true) return true;
  if (result.screen === 'report-sort-daily') {
    const daily = result.periodOptions?.find((option) => option.label === 'Diário');
    const monthly = result.periodOptions?.find((option) => option.label === 'Mensal');
    if (!daily?.active || daily.pressed !== 'true' || monthly?.active || monthly?.pressed !== 'false'
      || daily.background !== result.activeChannelBackground) return true;
  }
  if (result.screen === 'report-sort-annual') {
    const annual = result.periodOptions?.find((option) => option.label === 'Anual');
    const monthly = result.periodOptions?.find((option) => option.label === 'Mensal');
    if (!annual?.active || annual.pressed !== 'true' || monthly?.active || monthly?.pressed !== 'false'
      || annual.background !== result.activeChannelBackground) return true;
  }
  return false;
}

const failures = results.filter((result) => result.horizontalOverflow > 1
  || result.overlaps
  || result.openDialogs > 1
  || result.overlay?.insideViewport === false
  || (result.pageActions && (result.pageActions.groupCount !== 1
    || result.pageActions.ungroupedActions > 0
    || !result.pageActions.insideViewport
    || result.pageActions.heightDelta > 1
    || result.pageActions.gaps.some((gap) => gap < 8 || gap > 13)))
  || (result.screen === 'reports-export-menu' && (!result.firstItemFocused
    || result.menuItems?.join('|') !== 'Resumo e evolução CSV|Produtos e variações CSV|Vendas detalhadas CSV|Excel completo XLSX'))
  || (result.screen === 'reports-export-focus-return' && !result.focusRestored)
  || (result.screen === 'counter-detail' && (!result.categoryStrip
    || result.categoryStrip.buttonCount !== 13
    || result.categoryStrip.contentOverflow <= 1
    || !result.categoryStrip.horizontalScrollEnabled
    || result.categoryStrip.verticalOverflow > 1
    || !result.categoryStrip.insideViewport
    || result.categoryStrip.overlaps
    || result.categoryStrip.clippedButtons > 0
    || result.categoryStrip.shrinkableButtons > 0
    || result.categoryStrip.wrappedButtons > 0))
  || (result.screen === 'counter-category-scroll' && (result.maxScrollLeft <= 1
    || result.scrollLeft <= 1
    || result.activeCategory !== 'Sobremesas artesanais para compartilhar'
    || !result.activeInsideStrip))
  || invalidReportSortResult(result)
  || (result.regionCount != null && (result.regionCount !== 3
    || !result.panelInsideViewport
    || result.panelHorizontalOverflow > 1
    || result.panelVerticalOverflow > 1
    || !result.footerVisible
    || result.regionOverlap
    || Object.values(result.safePadding ?? {}).some((padding) => padding < 20)
    || !result.closeControl?.insideHeader
    || Math.abs(result.closeControl.width - 40) > 1
    || Math.abs(result.closeControl.height - 40) > 1))
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
