package com.hubon.backend.report.service;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.AnnualReportResponse;
import com.hubon.backend.report.dto.DailyReportResponse;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportWorkbookService {

    private static final byte[] BLUE = new byte[]{49, 86, (byte) 232};
    private static final byte[] INK = new byte[]{23, 32, 51};
    private static final byte[] SOFT_BLUE = new byte[]{(byte) 237, (byte) 241, (byte) 248};
    private static final byte[] SOFT_GREEN = new byte[]{(byte) 231, (byte) 247, (byte) 239};
    private static final DateTimeFormatter GENERATED_AT = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm");
    private final Clock businessClock;

    public byte[] daily(DailyReportResponse report) {
        try (WorkbookBuilder builder = new WorkbookBuilder(
                "Relatório diário", report.periodLabel(), report.channel(), businessClock)) {
            builder.summary(report.summary(), comparison(
                    report.comparison().percentageChange(), "dia anterior"));
            builder.hourly(report.hourly());
            builder.sales(report.sales());
            builder.products(report.products());
            builder.variants(report.products());
            builder.categories(report.categories());
            builder.payments(report.paymentMethods());
            builder.channels(report.channels());
            builder.cancellations(report.cancellations());
            return builder.bytes();
        } catch (IOException exception) {
            throw new IllegalStateException("Não foi possível gerar o Excel do relatório diário", exception);
        }
    }

    public byte[] monthly(MonthlyReportResponse report) {
        try (WorkbookBuilder builder = new WorkbookBuilder(
                "Relatório mensal", report.periodLabel(), report.channel(), businessClock)) {
            builder.summary(report.summary(), comparison(
                    report.comparison().percentageChange(), "mês anterior"));
            builder.daily(report.daily());
            builder.sales(report.sales());
            builder.products(report.products());
            builder.variants(report.products());
            builder.categories(report.categories());
            builder.payments(report.paymentMethods());
            builder.channels(report.channels());
            builder.cancellations(report.cancellations());
            return builder.bytes();
        } catch (IOException exception) {
            throw new IllegalStateException("Não foi possível gerar o Excel do relatório mensal", exception);
        }
    }

    public byte[] annual(AnnualReportResponse report) {
        try (WorkbookBuilder builder = new WorkbookBuilder(
                "Relatório anual", report.periodLabel(), report.channel(), businessClock)) {
            builder.summary(report.summary(), comparison(
                    report.comparison().percentageChange(), "ano anterior"));
            builder.annualIndicators(report.indicators());
            builder.monthly(report.monthly());
            builder.sales(report.sales());
            builder.products(report.products());
            builder.variants(report.products());
            builder.categories(report.categories());
            builder.payments(report.paymentMethods());
            builder.channels(report.channels());
            builder.cancellations(report.cancellations());
            return builder.bytes();
        } catch (IOException exception) {
            throw new IllegalStateException("Não foi possível gerar o Excel do relatório anual", exception);
        }
    }

    private String comparison(BigDecimal value, String reference) {
        if (value == null) {
            return "Sem base comparável no " + reference;
        }
        return value.abs().stripTrailingZeros().toPlainString() + "% "
                + (value.signum() >= 0 ? "acima do " : "abaixo do ") + reference;
    }

    private static final class WorkbookBuilder implements AutoCloseable {

        private final XSSFWorkbook workbook = new XSSFWorkbook();
        private final Styles styles = new Styles(workbook);
        private final String title;
        private final String period;
        private final ReportChannel channel;
        private final Clock clock;

        private WorkbookBuilder(String title, String period, ReportChannel channel, Clock clock) {
            this.title = title;
            this.period = period;
            this.channel = channel;
            this.clock = clock;
            workbook.getProperties().getCoreProperties().setCreator("HubOn");
            workbook.getProperties().getCoreProperties().setTitle(title + " - " + period);
            workbook.getProperties().getCoreProperties().setDescription(
                    "Relatório operacional e financeiro gerado pelo HubOn");
        }

        private void summary(MonthlyReportResponse.Summary summary, String comparison) {
            Sheet sheet = sheet("Resumo");
            int row = title(sheet, 4);
            row = section(sheet, row, "Indicadores financeiros", 4);
            row = metric(sheet, row, "Receita bruta", summary.grossRevenue(), styles.money);
            row = metric(sheet, row, "Taxa de serviço", summary.serviceFees(), styles.money);
            row = metric(sheet, row, "Descontos", summary.discounts(), styles.money);
            row = metric(sheet, row, "Receita líquida", summary.netRevenue(), styles.moneyEmphasis);
            row = metric(sheet, row, "Valor recebido", summary.receivedAmount(), styles.money);
            row = metric(sheet, row, "Ticket médio", summary.averageTicket(), styles.money);
            row++;
            row = section(sheet, row, "Volume e operação", 4);
            row = metric(sheet, row, "Comandas fechadas", summary.closedTabs(), styles.integer);
            row = metric(sheet, row, "Vendas em mesas", summary.tableSales(), styles.integer);
            row = metric(sheet, row, "Vendas no balcão", summary.counterSales(), styles.integer);
            row = metric(sheet, row, "Pedidos", summary.orders(), styles.integer);
            row = metric(sheet, row, "Itens vendidos", summary.itemsSold(), styles.integer);
            row++;
            row = section(sheet, row, "Cancelamentos", 4);
            row = metric(sheet, row, "Pedidos cancelados", summary.cancelledOrders(), styles.integer);
            row = metric(sheet, row, "Itens cancelados", summary.cancelledItems(), styles.integer);
            row = metric(sheet, row, "Valor cancelado", summary.cancelledAmount(), styles.money);
            row++;
            Row comparisonRow = sheet.createRow(row);
            text(comparisonRow, 0, "Comparação", styles.label);
            text(comparisonRow, 1, comparison, styles.text);
            sheet.addMergedRegion(new CellRangeAddress(row, row, 1, 3));
            widths(sheet, 28, 24, 20, 20);
            sheet.createFreezePane(0, 4);
        }

        private void annualIndicators(AnnualReportResponse.Indicators indicators) {
            Sheet sheet = workbook.getSheet("Resumo");
            int row = sheet.getLastRowNum() + 2;
            row = section(sheet, row, "Leitura anual", 4);
            row = metric(sheet, row, "Melhor mês", indicators.bestMonthLabel(), styles.text);
            row = metric(sheet, row, "Receita do melhor mês", indicators.bestMonthNetRevenue(), styles.money);
            row = metric(sheet, row, "Média mensal", indicators.averageMonthlyRevenue(), styles.money);
            metric(sheet, row, "Meses com movimento", indicators.activeMonths(), styles.integer);
        }

        private void hourly(List<DailyReportResponse.HourlyPerformance> rows) {
            Sheet sheet = sheet("Evolução por hora");
            int header = title(sheet, 10);
            headers(sheet, header, "Faixa", "Comandas", "Pedidos", "Itens", "Receita bruta",
                    "Serviço", "Descontos", "Receita líquida", "Recebido", "Ticket médio");
            int rowIndex = header + 1;
            for (DailyReportResponse.HourlyPerformance value : rows) {
                Row row = sheet.createRow(rowIndex++);
                text(row, 0, value.hourLabel(), styles.text);
                number(row, 1, value.closedTabs(), styles.integer);
                number(row, 2, value.orders(), styles.integer);
                number(row, 3, value.itemsSold(), styles.integer);
                money(row, 4, value.grossRevenue());
                money(row, 5, value.serviceFees());
                money(row, 6, value.discounts());
                money(row, 7, value.netRevenue());
                money(row, 8, value.receivedAmount());
                money(row, 9, value.averageTicket());
            }
            finishTable(sheet, header, rowIndex - 1, 10,
                    18, 12, 12, 12, 18, 16, 16, 18, 18, 18);
        }

        private void daily(List<MonthlyReportResponse.DailyPerformance> rows) {
            Sheet sheet = sheet("Evolução diária");
            int header = title(sheet, 10);
            headers(sheet, header, "Data", "Comandas", "Pedidos", "Itens", "Receita bruta",
                    "Serviço", "Descontos", "Receita líquida", "Recebido", "Ticket médio");
            int rowIndex = header + 1;
            for (MonthlyReportResponse.DailyPerformance value : rows) {
                Row row = sheet.createRow(rowIndex++);
                date(row, 0, value.date());
                number(row, 1, value.closedTabs(), styles.integer);
                number(row, 2, value.orders(), styles.integer);
                number(row, 3, value.itemsSold(), styles.integer);
                money(row, 4, value.grossRevenue());
                money(row, 5, value.serviceFees());
                money(row, 6, value.discounts());
                money(row, 7, value.netRevenue());
                money(row, 8, value.receivedAmount());
                money(row, 9, value.averageTicket());
            }
            finishTable(sheet, header, rowIndex - 1, 10,
                    14, 12, 12, 12, 18, 16, 16, 18, 18, 18);
        }

        private void monthly(List<AnnualReportResponse.MonthPerformance> rows) {
            Sheet sheet = sheet("Evolução mensal");
            int header = title(sheet, 11);
            headers(sheet, header, "Mês", "Comandas", "Pedidos", "Itens", "Receita bruta", "Serviço",
                    "Descontos", "Receita líquida", "Recebido", "Cancelado", "Ticket médio");
            int rowIndex = header + 1;
            for (AnnualReportResponse.MonthPerformance value : rows) {
                Row row = sheet.createRow(rowIndex++);
                text(row, 0, value.monthLabel(), styles.text);
                number(row, 1, value.closedTabs(), styles.integer);
                number(row, 2, value.orders(), styles.integer);
                number(row, 3, value.itemsSold(), styles.integer);
                money(row, 4, value.grossRevenue());
                money(row, 5, value.serviceFees());
                money(row, 6, value.discounts());
                money(row, 7, value.netRevenue());
                money(row, 8, value.receivedAmount());
                money(row, 9, value.cancelledAmount());
                money(row, 10, value.averageTicket());
            }
            finishTable(sheet, header, rowIndex - 1, 11,
                    18, 12, 12, 12, 18, 16, 16, 18, 18, 18, 18);
        }

        private void sales(List<MonthlyReportResponse.SaleDetail> rows) {
            Sheet sheet = sheet("Vendas");
            int header = title(sheet, 14);
            headers(sheet, header, "ID", "Origem", "Abertura", "Fechamento", "Duração (min)",
                    "Responsável", "Pedidos", "Itens", "Receita bruta", "Serviço", "Descontos",
                    "Valor final", "Recebido", "Pagamentos");
            int rowIndex = header + 1;
            for (MonthlyReportResponse.SaleDetail value : rows) {
                Row row = sheet.createRow(rowIndex++);
                number(row, 0, value.id(), styles.integer);
                text(row, 1, value.origin(), styles.text);
                dateTime(row, 2, value.openedAt());
                dateTime(row, 3, value.closedAt());
                number(row, 4, value.durationMinutes(), styles.integer);
                text(row, 5, value.responsible(), styles.text);
                number(row, 6, value.orders(), styles.integer);
                number(row, 7, value.items(), styles.integer);
                money(row, 8, value.grossRevenue());
                money(row, 9, value.serviceFees());
                money(row, 10, value.discounts());
                money(row, 11, value.finalAmount());
                money(row, 12, value.receivedAmount());
                text(row, 13, value.paymentMethods(), styles.text);
            }
            finishTable(sheet, header, rowIndex - 1, 14,
                    10, 18, 20, 20, 16, 22, 12, 12, 18, 16, 16, 18, 18, 24);
        }

        private void products(List<MonthlyReportResponse.ProductPerformance> rows) {
            Sheet sheet = sheet("Produtos");
            int header = title(sheet, 5);
            headers(sheet, header, "Produto", "Categoria", "Quantidade", "Valor dos itens", "Participação");
            int rowIndex = header + 1;
            for (MonthlyReportResponse.ProductPerformance value : rows) {
                Row row = sheet.createRow(rowIndex++);
                text(row, 0, value.productName(), styles.text);
                text(row, 1, value.categoryName(), styles.text);
                number(row, 2, value.quantity(), styles.integer);
                money(row, 3, value.salesAmount());
                percentage(row, 4, value.revenueSharePercentage());
            }
            finishTable(sheet, header, rowIndex - 1, 5, 32, 24, 14, 20, 16);
        }

        private void variants(List<MonthlyReportResponse.ProductPerformance> products) {
            Sheet sheet = sheet("Variações");
            int header = title(sheet, 5);
            headers(sheet, header, "Produto", "Categoria", "Variação", "Quantidade", "Valor dos itens");
            int rowIndex = header + 1;
            for (MonthlyReportResponse.ProductPerformance product : products) {
                for (MonthlyReportResponse.VariantPerformance variant : product.variants()) {
                    Row row = sheet.createRow(rowIndex++);
                    text(row, 0, product.productName(), styles.text);
                    text(row, 1, product.categoryName(), styles.text);
                    text(row, 2, variant.variantName(), styles.text);
                    number(row, 3, variant.quantity(), styles.integer);
                    money(row, 4, variant.salesAmount());
                }
            }
            finishTable(sheet, header, rowIndex - 1, 5, 32, 24, 24, 14, 20);
        }

        private void categories(List<MonthlyReportResponse.CategoryPerformance> rows) {
            Sheet sheet = sheet("Categorias");
            int header = title(sheet, 4);
            headers(sheet, header, "Categoria", "Quantidade", "Valor dos itens", "Participação");
            int rowIndex = header + 1;
            for (MonthlyReportResponse.CategoryPerformance value : rows) {
                Row row = sheet.createRow(rowIndex++);
                text(row, 0, value.categoryName(), styles.text);
                number(row, 1, value.quantity(), styles.integer);
                money(row, 2, value.salesAmount());
                percentage(row, 3, value.revenueSharePercentage());
            }
            finishTable(sheet, header, rowIndex - 1, 4, 30, 14, 20, 16);
        }

        private void payments(List<MonthlyReportResponse.PaymentPerformance> rows) {
            Sheet sheet = sheet("Pagamentos");
            int header = title(sheet, 4);
            headers(sheet, header, "Forma de pagamento", "Registros", "Valor recebido", "Participação");
            int rowIndex = header + 1;
            for (MonthlyReportResponse.PaymentPerformance value : rows) {
                Row row = sheet.createRow(rowIndex++);
                text(row, 0, paymentLabel(value.method()), styles.text);
                number(row, 1, value.payments(), styles.integer);
                money(row, 2, value.amount());
                percentage(row, 3, value.receivedSharePercentage());
            }
            finishTable(sheet, header, rowIndex - 1, 4, 28, 14, 20, 16);
        }

        private void channels(List<MonthlyReportResponse.ChannelPerformance> rows) {
            Sheet sheet = sheet("Canais");
            int header = title(sheet, 4);
            headers(sheet, header, "Canal", "Comandas", "Receita líquida", "Ticket médio");
            int rowIndex = header + 1;
            for (MonthlyReportResponse.ChannelPerformance value : rows) {
                Row row = sheet.createRow(rowIndex++);
                text(row, 0, channelLabel(value.channel()), styles.text);
                number(row, 1, value.closedTabs(), styles.integer);
                money(row, 2, value.netRevenue());
                money(row, 3, value.averageTicket());
            }
            finishTable(sheet, header, rowIndex - 1, 4, 24, 14, 20, 18);
        }

        private void cancellations(MonthlyReportResponse.CancellationSummary cancellations) {
            Sheet sheet = sheet("Cancelamentos");
            int row = title(sheet, 3);
            row = section(sheet, row, "Resumo", 3);
            row = metric(sheet, row, "Pedidos cancelados", cancellations.cancelledOrders(), styles.integer);
            row = metric(sheet, row, "Itens cancelados", cancellations.cancelledItems(), styles.integer);
            row = metric(sheet, row, "Valor cancelado", cancellations.cancelledAmount(), styles.money);
            row += 2;
            headers(sheet, row, "Motivo", "Ocorrências", "Observação");
            int header = row;
            row++;
            for (MonthlyReportResponse.CancellationReason reason : cancellations.mainReasons()) {
                Row data = sheet.createRow(row++);
                text(data, 0, reason.reason(), styles.text);
                number(data, 1, reason.occurrences(), styles.integer);
                text(data, 2, "", styles.text);
            }
            finishTable(sheet, header, row - 1, 3, 42, 16, 24);
        }

        private Sheet sheet(String name) {
            Sheet sheet = workbook.createSheet(name);
            sheet.setDisplayGridlines(false);
            sheet.setAutobreaks(true);
            sheet.setFitToPage(true);
            sheet.getPrintSetup().setLandscape(true);
            sheet.getPrintSetup().setFitWidth((short) 1);
            sheet.getPrintSetup().setFitHeight((short) 0);
            sheet.setMargin(Sheet.LeftMargin, 0.35);
            sheet.setMargin(Sheet.RightMargin, 0.35);
            sheet.setMargin(Sheet.TopMargin, 0.5);
            sheet.setMargin(Sheet.BottomMargin, 0.5);
            return sheet;
        }

        private int title(Sheet sheet, int columns) {
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(28);
            text(titleRow, 0, title, styles.title);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, columns - 1));
            Row periodRow = sheet.createRow(1);
            text(periodRow, 0, period + " | " + channelLabel(channel.name()), styles.subtitle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, columns - 1));
            Row generatedRow = sheet.createRow(2);
            text(generatedRow, 0, "Gerado em " + LocalDateTime.now(clock).format(GENERATED_AT), styles.generated);
            sheet.addMergedRegion(new CellRangeAddress(2, 2, 0, columns - 1));
            return 4;
        }

        private int section(Sheet sheet, int rowIndex, String label, int columns) {
            Row row = sheet.createRow(rowIndex);
            row.setHeightInPoints(22);
            text(row, 0, label, styles.section);
            sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 0, columns - 1));
            return rowIndex + 1;
        }

        private int metric(Sheet sheet, int rowIndex, String label, Object value, CellStyle valueStyle) {
            Row row = sheet.createRow(rowIndex);
            text(row, 0, label, styles.label);
            value(row, 1, value, valueStyle);
            return rowIndex + 1;
        }

        private void headers(Sheet sheet, int rowIndex, String... labels) {
            Row row = sheet.createRow(rowIndex);
            row.setHeightInPoints(24);
            for (int column = 0; column < labels.length; column++) {
                text(row, column, labels[column], styles.header);
            }
        }

        private void finishTable(Sheet sheet, int headerRow, int lastRow, int columns, int... widths) {
            if (lastRow >= headerRow) {
                sheet.setAutoFilter(new CellRangeAddress(headerRow, Math.max(headerRow, lastRow), 0, columns - 1));
            }
            sheet.createFreezePane(0, headerRow + 1);
            sheet.setRepeatingRows(new CellRangeAddress(headerRow, headerRow, -1, -1));
            widths(sheet, widths);
        }

        private void widths(Sheet sheet, int... widths) {
            for (int column = 0; column < widths.length; column++) {
                int width = Math.max(8, Math.min(48, widths[column]));
                sheet.setColumnWidth(column, width * 256);
            }
        }

        private void value(Row row, int column, Object value, CellStyle style) {
            if (value instanceof BigDecimal decimal) {
                number(row, column, decimal.doubleValue(), style);
            } else if (value instanceof Number number) {
                number(row, column, number.doubleValue(), style);
            } else {
                text(row, column, value == null ? "" : value.toString(), style);
            }
        }

        private void text(Row row, int column, String value, CellStyle style) {
            Cell cell = row.createCell(column);
            cell.setCellValue(value == null ? "" : value);
            cell.setCellStyle(style);
        }

        private void number(Row row, int column, double value, CellStyle style) {
            Cell cell = row.createCell(column);
            cell.setCellValue(value);
            cell.setCellStyle(style);
        }

        private void number(Row row, int column, long value, CellStyle style) {
            number(row, column, (double) value, style);
        }

        private void money(Row row, int column, BigDecimal value) {
            number(row, column, value == null ? 0 : value.doubleValue(), styles.money);
        }

        private void percentage(Row row, int column, BigDecimal value) {
            number(row, column, value == null ? 0 : value.doubleValue(), styles.percentage);
        }

        private void date(Row row, int column, java.time.LocalDate value) {
            Cell cell = row.createCell(column);
            if (value != null) {
                cell.setCellValue(value);
            }
            cell.setCellStyle(styles.date);
        }

        private void dateTime(Row row, int column, LocalDateTime value) {
            Cell cell = row.createCell(column);
            if (value != null) {
                cell.setCellValue(value);
            }
            cell.setCellStyle(styles.dateTime);
        }

        private String paymentLabel(String method) {
            return switch (method) {
                case "CASH" -> "Dinheiro";
                case "CREDIT_CARD" -> "Cartão de crédito";
                case "DEBIT_CARD" -> "Cartão de débito";
                case "PIX" -> "PIX";
                case "VOUCHER" -> "Voucher";
                default -> method;
            };
        }

        private String channelLabel(String value) {
            return switch (value) {
                case "TABLE" -> "Mesas";
                case "COUNTER" -> "Balcão";
                default -> "Todos os canais";
            };
        }

        private byte[] bytes() throws IOException {
            try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                workbook.write(output);
                return output.toByteArray();
            }
        }

        @Override
        public void close() throws IOException {
            workbook.close();
        }
    }

    private static final class Styles {

        private final CellStyle title;
        private final CellStyle subtitle;
        private final CellStyle generated;
        private final CellStyle section;
        private final CellStyle header;
        private final CellStyle label;
        private final CellStyle text;
        private final CellStyle integer;
        private final CellStyle money;
        private final CellStyle moneyEmphasis;
        private final CellStyle percentage;
        private final CellStyle date;
        private final CellStyle dateTime;

        private Styles(XSSFWorkbook workbook) {
            Font titleFont = font(workbook, 18, true, BLUE);
            Font subtitleFont = font(workbook, 11, true, INK);
            Font bodyFont = font(workbook, 10, false, INK);
            Font mutedFont = font(workbook, 9, false, new byte[]{102, 112, (byte) 133});
            Font whiteFont = font(workbook, 9, true, new byte[]{(byte) 255, (byte) 255, (byte) 255});

            title = style(workbook, titleFont, null, HorizontalAlignment.LEFT);
            subtitle = style(workbook, subtitleFont, null, HorizontalAlignment.LEFT);
            generated = style(workbook, mutedFont, null, HorizontalAlignment.LEFT);
            section = style(workbook, subtitleFont, SOFT_BLUE, HorizontalAlignment.LEFT);
            header = style(workbook, whiteFont, BLUE, HorizontalAlignment.LEFT);
            label = style(workbook, bodyFont, SOFT_BLUE, HorizontalAlignment.LEFT);
            text = style(workbook, bodyFont, null, HorizontalAlignment.LEFT);
            integer = numberStyle(workbook, bodyFont, "#,##0");
            money = numberStyle(workbook, bodyFont, "\"R$\" #,##0.00");
            moneyEmphasis = numberStyle(workbook, font(workbook, 10, true, INK), "\"R$\" #,##0.00");
            ((XSSFCellStyle) moneyEmphasis).setFillForegroundColor(new XSSFColor(SOFT_GREEN, null));
            moneyEmphasis.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            percentage = numberStyle(workbook, bodyFont, "0.00\"%\"");
            date = numberStyle(workbook, bodyFont, "dd/mm/yyyy");
            dateTime = numberStyle(workbook, bodyFont, "dd/mm/yyyy hh:mm");
        }

        private static Font font(XSSFWorkbook workbook, int size, boolean bold, byte[] color) {
            Font font = workbook.createFont();
            font.setFontName("Aptos");
            font.setFontHeightInPoints((short) size);
            font.setBold(bold);
            ((org.apache.poi.xssf.usermodel.XSSFFont) font).setColor(new XSSFColor(color, null));
            return font;
        }

        private static XSSFCellStyle style(
                XSSFWorkbook workbook,
                Font font,
                byte[] fill,
                HorizontalAlignment alignment
        ) {
            XSSFCellStyle style = workbook.createCellStyle();
            style.setFont(font);
            style.setAlignment(alignment);
            style.setVerticalAlignment(VerticalAlignment.CENTER);
            style.setWrapText(false);
            style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
            style.setBorderBottom(BorderStyle.THIN);
            if (fill != null) {
                style.setFillForegroundColor(new XSSFColor(fill, null));
                style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            }
            return style;
        }

        private static XSSFCellStyle numberStyle(XSSFWorkbook workbook, Font font, String format) {
            XSSFCellStyle style = style(workbook, font, null, HorizontalAlignment.RIGHT);
            style.setDataFormat(workbook.getCreationHelper().createDataFormat().getFormat(format));
            return style;
        }
    }
}
