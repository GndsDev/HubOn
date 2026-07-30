import { MonthlyReport } from '../models/monthly-report.model';

export function monthlySummaryCsv(report: MonthlyReport): string {
  return rowsToCsv([
    ['Relatório mensal', report.periodLabel],
    ['Canal', channelLabel(report.channel)],
    [],
    ['Indicador', 'Valor'],
    ['Receita bruta', decimal(report.summary.grossRevenue)],
    ['Taxas de servico', decimal(report.summary.serviceFees)],
    ['Descontos', decimal(report.summary.discounts)],
    ['Receita liquida', decimal(report.summary.netRevenue)],
    ['Valor recebido', decimal(report.summary.receivedAmount)],
    ['Comandas fechadas', String(report.summary.closedTabs)],
    ['Pedidos concluidos', String(report.summary.orders)],
    ['Itens vendidos', String(report.summary.itemsSold)],
    ['Ticket médio', decimal(report.summary.averageTicket)],
    ['Itens cancelados', String(report.cancellations.cancelledItems)],
    ['Valor cancelado', decimal(report.cancellations.cancelledAmount)],
    [],
    ['Data', 'Comandas fechadas', 'Receita liquida'],
    ...report.daily.map((day) => [day.date, String(day.closedTabs), decimal(day.netRevenue)]),
  ]);
}

export function monthlyProductsCsv(report: MonthlyReport): string {
  return rowsToCsv([
    ['Produto', 'Variação', 'Categoria', 'Quantidade', 'Valor dos itens', 'Participação (%)'],
    ...report.products.flatMap((product) => product.variants.map((variant) => [
      product.productName,
      variant.variantName,
      product.categoryName,
      String(variant.quantity),
      decimal(variant.salesAmount),
      decimal(product.revenueSharePercentage),
    ])),
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

function channelLabel(channel: MonthlyReport['channel']): string {
  return channel === 'TABLE' ? 'Mesas' : channel === 'COUNTER' ? 'Balcão' : 'Todos';
}
