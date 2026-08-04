import {
  AnnualReport,
  DailyReport,
  MonthlyReport,
  ReportChannel,
  ReportData,
  ReportPerformance,
  ReportProductPerformance,
  ReportSaleDetail,
} from '../models/monthly-report.model';

const performanceHeaders = [
  'Comandas fechadas',
  'Pedidos',
  'Itens vendidos',
  'Receita bruta',
  'Taxa de serviço',
  'Descontos',
  'Receita líquida',
  'Valor recebido',
  'Ticket médio',
];

export function dailySummaryCsv(report: DailyReport): string {
  return rowsToCsv([
    ...summaryRows('Relatório diário', report),
    [],
    ['Faixa de horário', ...performanceHeaders],
    ...report.hourly.map((hour) => [hour.hourLabel, ...performanceRow(hour)]),
  ]);
}

export function monthlySummaryCsv(report: MonthlyReport): string {
  return rowsToCsv([
    ...summaryRows('Relatório mensal', report),
    [],
    ['Data', ...performanceHeaders],
    ...report.daily.map((day) => [day.date, ...performanceRow(day)]),
  ]);
}

export function annualSummaryCsv(report: AnnualReport): string {
  return rowsToCsv([
    ...summaryRows('Relatório anual', report),
    ['Melhor mês', report.indicators.bestMonthLabel],
    ['Receita do melhor mês', decimal(report.indicators.bestMonthNetRevenue)],
    ['Média mensal', decimal(report.indicators.averageMonthlyRevenue)],
    ['Meses com movimento', String(report.indicators.activeMonths)],
    [],
    ['Mês', ...performanceHeaders, 'Valor cancelado'],
    ...report.monthly.map((month) => [
      month.monthLabel,
      ...performanceRow(month),
      decimal(month.cancelledAmount),
    ]),
  ]);
}

export function dailyProductsCsv(
  report: DailyReport,
  products: readonly ReportProductPerformance[] = report.products,
): string {
  return productsCsv(products);
}

export function monthlyProductsCsv(
  report: MonthlyReport,
  products: readonly ReportProductPerformance[] = report.products,
): string {
  return productsCsv(products);
}

export function annualProductsCsv(
  report: AnnualReport,
  products: readonly ReportProductPerformance[] = report.products,
): string {
  return productsCsv(products);
}

export function dailySalesCsv(report: DailyReport): string {
  return salesCsv(report.sales);
}

export function monthlySalesCsv(report: MonthlyReport): string {
  return salesCsv(report.sales);
}

export function annualSalesCsv(report: AnnualReport): string {
  return salesCsv(report.sales);
}

function summaryRows(title: string, report: ReportData): string[][] {
  return [
    [title, report.periodLabel],
    ['Canal', channelLabel(report.channel)],
    [],
    ['Indicador', 'Valor'],
    ['Receita bruta', decimal(report.summary.grossRevenue)],
    ['Taxa de serviço', decimal(report.summary.serviceFees)],
    ['Descontos', decimal(report.summary.discounts)],
    ['Receita líquida', decimal(report.summary.netRevenue)],
    ['Valor recebido', decimal(report.summary.receivedAmount)],
    ['Comandas fechadas', String(report.summary.closedTabs)],
    ['Vendas em mesas', String(report.summary.tableSales)],
    ['Vendas no balcão', String(report.summary.counterSales)],
    ['Pedidos concluídos', String(report.summary.orders)],
    ['Itens vendidos', String(report.summary.itemsSold)],
    ['Ticket médio', decimal(report.summary.averageTicket)],
    ['Pedidos cancelados', String(report.cancellations.cancelledOrders)],
    ['Itens cancelados', String(report.cancellations.cancelledItems)],
    ['Valor cancelado', decimal(report.cancellations.cancelledAmount)],
  ];
}

function performanceRow(value: ReportPerformance): string[] {
  return [
    String(value.closedTabs),
    String(value.orders),
    String(value.itemsSold),
    decimal(value.grossRevenue),
    decimal(value.serviceFees),
    decimal(value.discounts),
    decimal(value.netRevenue),
    decimal(value.receivedAmount),
    decimal(value.averageTicket),
  ];
}

function productsCsv(products: readonly ReportProductPerformance[]): string {
  return rowsToCsv([
    ['Produto', 'Variação', 'Categoria', 'Quantidade', 'Valor dos itens', 'Participação (%)'],
    ...products.flatMap((product) => product.variants.map((variant) => [
      product.productName,
      variant.variantName,
      product.categoryName,
      String(variant.quantity),
      decimal(variant.salesAmount),
      decimal(product.revenueSharePercentage),
    ])),
  ]);
}

function salesCsv(sales: readonly ReportSaleDetail[]): string {
  return rowsToCsv([
    [
      'ID',
      'Origem',
      'Abertura',
      'Fechamento',
      'Duração (min)',
      'Responsável',
      'Pedidos',
      'Itens',
      'Receita bruta',
      'Taxa de serviço',
      'Descontos',
      'Valor final',
      'Valor recebido',
      'Formas de pagamento',
    ],
    ...sales.map((sale) => [
      String(sale.id),
      sale.origin,
      sale.openedAt,
      sale.closedAt,
      String(sale.durationMinutes),
      sale.responsible,
      String(sale.orders),
      String(sale.items),
      decimal(sale.grossRevenue),
      decimal(sale.serviceFees),
      decimal(sale.discounts),
      decimal(sale.finalAmount),
      decimal(sale.receivedAmount),
      sale.paymentMethods,
    ]),
  ]);
}

function rowsToCsv(rows: string[][]): string {
  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(';')).join('\r\n')}`;
}

function escapeCell(value: string): string {
  const normalized = value.replaceAll('"', '""');
  return /[;"\r\n]/.test(normalized) ? `"${normalized}"` : normalized;
}

function decimal(value: number): string {
  return Number(value ?? 0).toFixed(2).replace('.', ',');
}

function channelLabel(channel: ReportChannel): string {
  return channel === 'TABLE' ? 'Mesas' : channel === 'COUNTER' ? 'Balcão' : 'Todos';
}
