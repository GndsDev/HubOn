package com.hubon.backend.report.service;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.*;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
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
    private final Clock businessClock;

    public byte[] daily(DailyReportResponse report) {
        List<Series> series = report.hourly().stream().map(row -> new Series(row.hourLabel(), row.closedSales(),
                row.itemsSold(), row.grossRevenue(), row.serviceFees(), row.discounts(), row.netRevenue(),
                row.receivedAmount(), row.averageTicket())).toList();
        return build(new WorkbookData("Relatorio diario", report.periodLabel(), report.channel(), report.summary(),
                series, report.sales(), report.products(), report.categories(), report.paymentMethods(),
                report.channels(), report.cancellations()));
    }

    public byte[] monthly(MonthlyReportResponse report) {
        List<Series> series = report.daily().stream().map(row -> new Series(row.date().toString(), row.closedSales(),
                row.itemsSold(), row.grossRevenue(), row.serviceFees(), row.discounts(), row.netRevenue(),
                row.receivedAmount(), row.averageTicket())).toList();
        return build(new WorkbookData("Relatorio mensal", report.periodLabel(), report.channel(), report.summary(),
                series, report.sales(), report.products(), report.categories(), report.paymentMethods(),
                report.channels(), report.cancellations()));
    }

    public byte[] annual(AnnualReportResponse report) {
        List<Series> series = report.monthly().stream().map(row -> new Series(row.monthLabel(), row.closedSales(),
                row.itemsSold(), row.grossRevenue(), row.serviceFees(), row.discounts(), row.netRevenue(),
                row.receivedAmount(), row.averageTicket())).toList();
        return build(new WorkbookData("Relatorio anual", report.periodLabel(), report.channel(), report.summary(),
                series, report.sales(), report.products(), report.categories(), report.paymentMethods(),
                report.channels(), report.cancellations()));
    }

    private byte[] build(WorkbookData data) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Styles styles = styles(workbook);
            summary(workbook, styles, data);
            evolution(workbook, styles, data.series());
            sales(workbook, styles, data.sales());
            products(workbook, styles, data.products());
            categories(workbook, styles, data.categories());
            payments(workbook, styles, data.payments());
            channels(workbook, styles, data.channels());
            cancellations(workbook, styles, data.cancellations());
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Nao foi possivel gerar o Excel do relatorio", exception);
        }
    }

    private void summary(XSSFWorkbook workbook, Styles styles, WorkbookData data) {
        Sheet sheet = workbook.createSheet("Resumo");
        title(sheet, styles, data.title(), data.period() + " - " + channel(data.channel()));
        String[][] labels = {{"Receita bruta", "Taxas", "Descontos", "Receita liquida", "Recebido", "Ticket medio"},
                {"Vendas fechadas", "Vendas em mesas", "Vendas no balcao", "Itens vendidos", "Vendas canceladas", "Itens cancelados"}};
        BigDecimal[] money = {data.summary().grossRevenue(), data.summary().serviceFees(), data.summary().discounts(),
                data.summary().netRevenue(), data.summary().receivedAmount(), data.summary().averageTicket()};
        long[] counts = {data.summary().closedSales(), data.summary().tableSales(), data.summary().counterSales(),
                data.summary().itemsSold(), data.summary().cancelledSales(), data.summary().cancelledItems()};
        Row moneyLabels = sheet.createRow(4);
        Row moneyValues = sheet.createRow(5);
        Row countLabels = sheet.createRow(7);
        Row countValues = sheet.createRow(8);
        for (int column = 0; column < labels[0].length; column++) {
            cell(moneyLabels, column, labels[0][column], styles.header());
            cell(moneyValues, column, money[column], styles.money());
            cell(countLabels, column, labels[1][column], styles.header());
            cell(countValues, column, counts[column], styles.number());
            sheet.setColumnWidth(column, 5200);
        }
    }

    private void evolution(XSSFWorkbook workbook, Styles styles, List<Series> values) {
        Sheet sheet = workbook.createSheet("Evolucao");
        String[] headers = {"Periodo", "Vendas", "Itens", "Receita bruta", "Taxas", "Descontos", "Receita liquida", "Recebido", "Ticket medio"};
        header(sheet, styles, headers);
        int row = 1;
        for (Series value : values) {
            Row line = sheet.createRow(row++);
            cell(line, 0, value.label(), styles.text()); cell(line, 1, value.closedSales(), styles.number());
            cell(line, 2, value.itemsSold(), styles.number()); cell(line, 3, value.gross(), styles.money());
            cell(line, 4, value.fees(), styles.money()); cell(line, 5, value.discounts(), styles.money());
            cell(line, 6, value.net(), styles.money()); cell(line, 7, value.received(), styles.money());
            cell(line, 8, value.ticket(), styles.money());
        }
        finishTable(sheet, headers.length, row);
    }

    private void sales(XSSFWorkbook workbook, Styles styles, List<MonthlyReportResponse.SaleDetail> values) {
        Sheet sheet = workbook.createSheet("Vendas");
        String[] headers = {"ID", "Origem", "Abertura", "Fechamento", "Duracao (min)", "Responsavel", "Itens", "Bruta", "Taxas", "Descontos", "Final", "Recebido", "Pagamentos"};
        header(sheet, styles, headers);
        int row = 1;
        for (MonthlyReportResponse.SaleDetail value : values) {
            Row line = sheet.createRow(row++);
            cell(line, 0, value.id(), styles.number()); cell(line, 1, value.origin(), styles.text());
            cell(line, 2, value.openedAt(), styles.dateTime()); cell(line, 3, value.closedAt(), styles.dateTime());
            cell(line, 4, value.durationMinutes(), styles.number()); cell(line, 5, value.responsible(), styles.text());
            cell(line, 6, value.items(), styles.number()); cell(line, 7, value.grossRevenue(), styles.money());
            cell(line, 8, value.serviceFees(), styles.money()); cell(line, 9, value.discounts(), styles.money());
            cell(line, 10, value.finalAmount(), styles.money()); cell(line, 11, value.receivedAmount(), styles.money());
            cell(line, 12, value.paymentMethods(), styles.text());
        }
        finishTable(sheet, headers.length, row);
        widths(sheet, 2600, 5000, 5200, 5200, 3800, 6800, 2800, 4200, 4200, 4200, 4200, 4200, 7200);
    }

    private void products(XSSFWorkbook workbook, Styles styles, List<MonthlyReportResponse.ProductPerformance> values) {
        Sheet sheet = workbook.createSheet("Produtos");
        header(sheet, styles, "Produto", "Categoria", "Quantidade", "Valor", "Participacao (%)");
        int row = 1;
        for (var value : values) {
            Row line = sheet.createRow(row++); cell(line, 0, value.productName(), styles.text());
            cell(line, 1, value.categoryName(), styles.text()); cell(line, 2, value.quantity(), styles.number());
            cell(line, 3, value.salesAmount(), styles.money()); cell(line, 4, value.revenueSharePercentage(), styles.decimal());
        }
        finishTable(sheet, 5, row);
        widths(sheet, 9000, 6500, 3800, 4200, 4200);
    }

    private void categories(XSSFWorkbook workbook, Styles styles, List<MonthlyReportResponse.CategoryPerformance> values) {
        Sheet sheet = workbook.createSheet("Categorias");
        header(sheet, styles, "Categoria", "Quantidade", "Valor", "Participacao (%)");
        int row = 1;
        for (var value : values) { Row line = sheet.createRow(row++); cell(line, 0, value.categoryName(), styles.text());
            cell(line, 1, value.quantity(), styles.number()); cell(line, 2, value.salesAmount(), styles.money());
            cell(line, 3, value.revenueSharePercentage(), styles.decimal()); }
        finishTable(sheet, 4, row);
    }

    private void payments(XSSFWorkbook workbook, Styles styles, List<MonthlyReportResponse.PaymentPerformance> values) {
        Sheet sheet = workbook.createSheet("Pagamentos");
        header(sheet, styles, "Metodo", "Registros", "Valor", "Participacao (%)");
        int row = 1;
        for (var value : values) { Row line = sheet.createRow(row++); cell(line, 0, value.method(), styles.text());
            cell(line, 1, value.payments(), styles.number()); cell(line, 2, value.amount(), styles.money());
            cell(line, 3, value.receivedSharePercentage(), styles.decimal()); }
        finishTable(sheet, 4, row);
    }

    private void channels(XSSFWorkbook workbook, Styles styles, List<MonthlyReportResponse.ChannelPerformance> values) {
        Sheet sheet = workbook.createSheet("Canais");
        header(sheet, styles, "Canal", "Vendas", "Receita liquida", "Ticket medio");
        int row = 1;
        for (var value : values) { Row line = sheet.createRow(row++); cell(line, 0, value.channel(), styles.text());
            cell(line, 1, value.closedSales(), styles.number()); cell(line, 2, value.netRevenue(), styles.money());
            cell(line, 3, value.averageTicket(), styles.money()); }
        finishTable(sheet, 4, row);
    }

    private void cancellations(XSSFWorkbook workbook, Styles styles, MonthlyReportResponse.CancellationSummary value) {
        Sheet sheet = workbook.createSheet("Cancelamentos");
        header(sheet, styles, "Vendas canceladas", "Itens cancelados", "Valor cancelado");
        Row totals = sheet.createRow(1); cell(totals, 0, value.cancelledSales(), styles.number());
        cell(totals, 1, value.cancelledItems(), styles.number()); cell(totals, 2, value.cancelledAmount(), styles.money());
        Row reasons = sheet.createRow(3); cell(reasons, 0, "Motivo", styles.header()); cell(reasons, 1, "Ocorrencias", styles.header());
        int row = 4;
        for (var reason : value.mainReasons()) { Row line = sheet.createRow(row++); cell(line, 0, reason.reason(), styles.text()); cell(line, 1, reason.occurrences(), styles.number()); }
        fit(sheet, 3);
    }

    private void title(Sheet sheet, Styles styles, String title, String subtitle) {
        Row first = sheet.createRow(0); cell(first, 0, "HubOn - " + title, styles.title());
        Row second = sheet.createRow(1); cell(second, 0, subtitle, styles.text());
        Row generated = sheet.createRow(2); cell(generated, 0, "Gerado em " + LocalDateTime.now(businessClock).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")), styles.text());
    }

    private void header(Sheet sheet, Styles styles, String... values) {
        Row row = sheet.createRow(0);
        for (int i = 0; i < values.length; i++) cell(row, i, values[i], styles.header());
        sheet.createFreezePane(0, 1);
    }

    private void cell(Row row, int column, Object value, CellStyle style) {
        Cell cell = row.getCell(column) == null ? row.createCell(column) : row.getCell(column);
        if (value instanceof BigDecimal decimal) cell.setCellValue(decimal.doubleValue());
        else if (value instanceof LocalDateTime dateTime) cell.setCellValue(dateTime);
        else if (value instanceof Number number) cell.setCellValue(number.doubleValue());
        else cell.setCellValue(value == null ? "" : value.toString());
        cell.setCellStyle(style);
    }

    private void finishTable(Sheet sheet, int columns, int nextRow) {
        fit(sheet, columns);
        sheet.setAutoFilter(new CellRangeAddress(0, Math.max(0, nextRow - 1), 0, columns - 1));
    }

    private void fit(Sheet sheet, int columns) {
        for (int column = 0; column < columns; column++) { sheet.autoSizeColumn(column); sheet.setColumnWidth(column, Math.min(sheet.getColumnWidth(column) + 600, 12000)); }
    }

    private void widths(Sheet sheet, int... widths) {
        for (int column = 0; column < widths.length; column++) sheet.setColumnWidth(column, widths[column]);
    }

    private Styles styles(XSSFWorkbook workbook) {
        DataFormat formats = workbook.createDataFormat();
        CellStyle text = workbook.createCellStyle(); text.setWrapText(true); text.setVerticalAlignment(VerticalAlignment.TOP);
        CellStyle number = workbook.createCellStyle(); number.setDataFormat(formats.getFormat("0")); number.setAlignment(HorizontalAlignment.RIGHT);
        CellStyle decimal = workbook.createCellStyle(); decimal.setDataFormat(formats.getFormat("0.00")); decimal.setAlignment(HorizontalAlignment.RIGHT);
        CellStyle money = workbook.createCellStyle(); money.setDataFormat(formats.getFormat("R$ #,##0.00")); money.setAlignment(HorizontalAlignment.RIGHT);
        CellStyle dateTime = workbook.createCellStyle(); dateTime.setDataFormat(formats.getFormat("dd/mm/yyyy hh:mm"));
        CellStyle header = workbook.createCellStyle(); header.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
        header.setFillPattern(FillPatternType.SOLID_FOREGROUND); Font headerFont = workbook.createFont();
        headerFont.setBold(true); headerFont.setColor(IndexedColors.WHITE.getIndex()); header.setFont(headerFont);
        header.setWrapText(true); header.setVerticalAlignment(VerticalAlignment.CENTER);
        CellStyle title = workbook.createCellStyle(); Font titleFont = workbook.createFont(); titleFont.setBold(true); titleFont.setFontHeightInPoints((short) 16); title.setFont(titleFont);
        return new Styles(text, number, decimal, money, dateTime, header, title);
    }

    private String channel(ReportChannel channel) { return channel == ReportChannel.ALL ? "Todos os canais" : channel == ReportChannel.TABLE ? "Mesas" : "Balcao"; }

    private record Styles(CellStyle text, CellStyle number, CellStyle decimal, CellStyle money,
                          CellStyle dateTime, CellStyle header, CellStyle title) { }
    private record Series(String label, long closedSales, long itemsSold, BigDecimal gross,
            BigDecimal fees, BigDecimal discounts, BigDecimal net, BigDecimal received, BigDecimal ticket) { }
    private record WorkbookData(String title, String period, ReportChannel channel,
            MonthlyReportResponse.Summary summary, List<Series> series,
            List<MonthlyReportResponse.SaleDetail> sales,
            List<MonthlyReportResponse.ProductPerformance> products,
            List<MonthlyReportResponse.CategoryPerformance> categories,
            List<MonthlyReportResponse.PaymentPerformance> payments,
            List<MonthlyReportResponse.ChannelPerformance> channels,
            MonthlyReportResponse.CancellationSummary cancellations) { }
}
