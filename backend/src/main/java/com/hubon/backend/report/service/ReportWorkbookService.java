package com.hubon.backend.report.service;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.AnnualReportResponse;
import com.hubon.backend.report.dto.DailyReportResponse;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormat;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.PrintSetup;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.DefaultIndexedColorMap;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
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
    private static final DateTimeFormatter GENERATED_AT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final DateTimeFormatter SERIES_DATE = DateTimeFormatter.ofPattern("dd/MM");
    private static final int[] PRIMARY = {49, 86, 232};
    private static final int[] PRIMARY_LIGHT = {234, 240, 255};
    private static final int[] SURFACE = {255, 255, 255};
    private static final int[] SURFACE_ALT = {246, 248, 252};
    private static final int[] TEXT = {23, 32, 51};
    private static final int[] MUTED = {102, 112, 133};
    private static final int[] WHITE = {255, 255, 255};

    private final Clock businessClock;

    public byte[] daily(DailyReportResponse report) {
        List<Series> series = report.hourly().stream().map(row -> new Series(row.hourLabel(), row.closedSales(),
                row.itemsSold(), row.grossRevenue(), row.serviceFees(), row.discounts(), row.netRevenue(),
                row.receivedAmount(), row.averageTicket())).toList();
        return build(new WorkbookData("Relat\u00f3rio di\u00e1rio", report.periodLabel(), report.channel(), report.summary(),
                series, report.sales(), report.products(), report.categories(), report.paymentMethods(),
                report.channels(), report.cancellations()));
    }

    public byte[] monthly(MonthlyReportResponse report) {
        List<Series> series = report.daily().stream().map(row -> new Series(row.date().format(SERIES_DATE),
                row.closedSales(), row.itemsSold(), row.grossRevenue(), row.serviceFees(), row.discounts(),
                row.netRevenue(), row.receivedAmount(), row.averageTicket())).toList();
        return build(new WorkbookData("Relat\u00f3rio mensal", report.periodLabel(), report.channel(), report.summary(),
                series, report.sales(), report.products(), report.categories(), report.paymentMethods(),
                report.channels(), report.cancellations()));
    }

    public byte[] annual(AnnualReportResponse report) {
        List<Series> series = report.monthly().stream().map(row -> new Series(row.monthLabel(), row.closedSales(),
                row.itemsSold(), row.grossRevenue(), row.serviceFees(), row.discounts(), row.netRevenue(),
                row.receivedAmount(), row.averageTicket())).toList();
        return build(new WorkbookData("Relat\u00f3rio anual", report.periodLabel(), report.channel(), report.summary(),
                series, report.sales(), report.products(), report.categories(), report.paymentMethods(),
                report.channels(), report.cancellations()));
    }

    private byte[] build(WorkbookData data) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Styles styles = styles(workbook);
            summary(workbook, styles, data);
            sales(workbook, styles, data);
            products(workbook, styles, data);
            payments(workbook, styles, data);
            cancellations(workbook, styles, data);
            workbook.setActiveSheet(0);
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Nao foi possivel gerar o Excel do relatorio", exception);
        }
    }

    private void summary(XSSFWorkbook workbook, Styles styles, WorkbookData data) {
        Sheet sheet = workbook.createSheet("Resumo");
        configureSheet(sheet, true);
        titleBlock(sheet, styles, data, 8);
        widths(sheet, 5600, 4000, 4300, 4300, 1100, 5500, 3900, 4400, 4400);

        kpi(sheet, styles, 4, 0, 2, "RECEITA LIQUIDA", data.summary().netRevenue(), true);
        kpi(sheet, styles, 4, 3, 5, "RECEITA BRUTA", data.summary().grossRevenue(), true);
        kpi(sheet, styles, 4, 6, 8, "RECEBIDO", data.summary().receivedAmount(), true);
        kpi(sheet, styles, 7, 0, 2, "VENDAS", data.summary().closedSales(), false);
        kpi(sheet, styles, 7, 3, 5, "ITENS", data.summary().itemsSold(), false);
        kpi(sheet, styles, 7, 6, 8, "TICKET MEDIO", data.summary().averageTicket(), true);

        mergedCell(sheet, 10, 0, 8, "Desempenho no periodo", styles.sectionTitle());
        Row performanceHeader = row(sheet, 11, 25);
        String[] headers = {"Periodo", "Vendas", "Itens", "Bruta", "Taxas", "Descontos", "Liquida", "Recebido", "Ticket"};
        for (int column = 0; column < headers.length; column++) {
            headerCell(performanceHeader, column, headers[column], column == 0 ? styles.headerText() : styles.headerNumber());
        }
        int nextRow = 12;
        for (Series value : data.series()) {
            boolean alternate = nextRow % 2 == 1;
            Row line = row(sheet, nextRow++, 22);
            cell(line, 0, value.label(), alternate ? styles.textAlt() : styles.text());
            cell(line, 1, value.closedSales(), alternate ? styles.numberAlt() : styles.number());
            cell(line, 2, value.itemsSold(), alternate ? styles.numberAlt() : styles.number());
            cell(line, 3, value.gross(), alternate ? styles.moneyAlt() : styles.money());
            cell(line, 4, value.fees(), alternate ? styles.moneyAlt() : styles.money());
            cell(line, 5, value.discounts(), alternate ? styles.moneyAlt() : styles.money());
            cell(line, 6, value.net(), alternate ? styles.moneyAlt() : styles.money());
            cell(line, 7, value.received(), alternate ? styles.moneyAlt() : styles.money());
            cell(line, 8, value.ticket(), alternate ? styles.moneyAlt() : styles.money());
        }

        int rankingTitleRow = nextRow + 2;
        mergedCell(sheet, rankingTitleRow, 0, 3, "Categorias", styles.sectionTitle());
        mergedCell(sheet, rankingTitleRow, 5, 8, "Canais", styles.sectionTitle());
        Row rankingHeader = row(sheet, rankingTitleRow + 1, 25);
        headerCell(rankingHeader, 0, "Categoria", styles.headerText());
        headerCell(rankingHeader, 1, "Quantidade", styles.headerNumber());
        headerCell(rankingHeader, 2, "Valor", styles.headerNumber());
        headerCell(rankingHeader, 3, "Participacao", styles.headerNumber());
        headerCell(rankingHeader, 5, "Origem", styles.headerText());
        headerCell(rankingHeader, 6, "Vendas", styles.headerNumber());
        headerCell(rankingHeader, 7, "Receita liquida", styles.headerNumber());
        headerCell(rankingHeader, 8, "Ticket medio", styles.headerNumber());

        int rankingRows = Math.max(data.categories().size(), data.channels().size());
        for (int index = 0; index < rankingRows; index++) {
            int currentRow = rankingTitleRow + 2 + index;
            boolean alternate = index % 2 == 1;
            Row line = row(sheet, currentRow, 22);
            if (index < data.categories().size()) {
                var category = data.categories().get(index);
                cell(line, 0, category.categoryName(), alternate ? styles.textAlt() : styles.text());
                cell(line, 1, category.quantity(), alternate ? styles.numberAlt() : styles.number());
                cell(line, 2, category.salesAmount(), alternate ? styles.moneyAlt() : styles.money());
                cell(line, 3, percentage(category.revenueSharePercentage()), alternate ? styles.percentageAlt() : styles.percentage());
            }
            if (index < data.channels().size()) {
                var channel = data.channels().get(index);
                cell(line, 5, channelLabel(channel.channel()), alternate ? styles.textAlt() : styles.text());
                cell(line, 6, channel.closedSales(), alternate ? styles.numberAlt() : styles.number());
                cell(line, 7, channel.netRevenue(), alternate ? styles.moneyAlt() : styles.money());
                cell(line, 8, channel.averageTicket(), alternate ? styles.moneyAlt() : styles.money());
            }
        }
        sheet.createFreezePane(0, 3);
    }

    private void sales(XSSFWorkbook workbook, Styles styles, WorkbookData data) {
        Sheet sheet = workbook.createSheet("Vendas");
        configureSheet(sheet, true);
        titleBlock(sheet, styles, data, 12);
        mergedCell(sheet, 4, 0, 12, "Vendas detalhadas", styles.sectionTitle());
        String[] headers = {"ID", "Origem", "Abertura", "Fechamento", "Duracao (min)", "Responsavel", "Itens",
                "Bruta", "Taxas", "Descontos", "Final", "Recebido", "Pagamento"};
        Row header = row(sheet, 5, 30);
        for (int column = 0; column < headers.length; column++) {
            CellStyle style = switch (column) {
                case 0, 4, 6, 7, 8, 9, 10, 11 -> styles.headerNumber();
                case 2, 3 -> styles.headerCenter();
                default -> styles.headerText();
            };
            headerCell(header, column, headers[column], style);
        }

        int nextRow = 6;
        for (var value : data.sales()) {
            boolean alternate = nextRow % 2 == 1;
            Row line = row(sheet, nextRow++, value.paymentMethods().length() > 24 ? 32 : 23);
            cell(line, 0, value.id(), alternate ? styles.numberAlt() : styles.number());
            cell(line, 1, value.origin(), alternate ? styles.textAlt() : styles.text());
            cell(line, 2, value.openedAt(), alternate ? styles.dateTimeAlt() : styles.dateTime());
            cell(line, 3, value.closedAt(), alternate ? styles.dateTimeAlt() : styles.dateTime());
            cell(line, 4, value.durationMinutes(), alternate ? styles.numberAlt() : styles.number());
            cell(line, 5, value.responsible(), alternate ? styles.textAlt() : styles.text());
            cell(line, 6, value.items(), alternate ? styles.numberAlt() : styles.number());
            cell(line, 7, value.grossRevenue(), alternate ? styles.moneyAlt() : styles.money());
            cell(line, 8, value.serviceFees(), alternate ? styles.moneyAlt() : styles.money());
            cell(line, 9, value.discounts(), alternate ? styles.moneyAlt() : styles.money());
            cell(line, 10, value.finalAmount(), alternate ? styles.moneyAlt() : styles.money());
            cell(line, 11, value.receivedAmount(), alternate ? styles.moneyAlt() : styles.money());
            cell(line, 12, paymentMethods(value.paymentMethods()), alternate ? styles.wrapAlt() : styles.wrap());
        }
        finishTable(sheet, 5, headers.length, nextRow);
        widths(sheet, 2600, 5200, 5200, 5200, 3600, 6800, 2800, 4200, 4200, 4200, 4200, 4200, 7600);
    }

    private void products(XSSFWorkbook workbook, Styles styles, WorkbookData data) {
        Sheet sheet = workbook.createSheet("Produtos");
        configureSheet(sheet, false);
        titleBlock(sheet, styles, data, 4);
        mergedCell(sheet, 4, 0, 4, "Desempenho de produtos", styles.sectionTitle());
        String[] headers = {"Produto", "Categoria", "Quantidade", "Valor", "Participacao"};
        Row header = row(sheet, 5, 30);
        for (int column = 0; column < headers.length; column++) {
            headerCell(header, column, headers[column], column < 2 ? styles.headerText() : styles.headerNumber());
        }
        int nextRow = 6;
        for (var value : data.products()) {
            boolean alternate = nextRow % 2 == 1;
            Row line = row(sheet, nextRow++, 23);
            cell(line, 0, value.productName(), alternate ? styles.textAlt() : styles.text());
            cell(line, 1, value.categoryName(), alternate ? styles.textAlt() : styles.text());
            cell(line, 2, value.quantity(), alternate ? styles.numberAlt() : styles.number());
            cell(line, 3, value.salesAmount(), alternate ? styles.moneyAlt() : styles.money());
            cell(line, 4, percentage(value.revenueSharePercentage()), alternate ? styles.percentageAlt() : styles.percentage());
        }
        finishTable(sheet, 5, headers.length, nextRow);
        widths(sheet, 9200, 6800, 3800, 4600, 4300);
    }

    private void payments(XSSFWorkbook workbook, Styles styles, WorkbookData data) {
        Sheet sheet = workbook.createSheet("Pagamentos");
        configureSheet(sheet, false);
        titleBlock(sheet, styles, data, 3);
        mergedCell(sheet, 4, 0, 3, "Formas de pagamento", styles.sectionTitle());
        String[] headers = {"Metodo", "Quantidade", "Valor", "Participacao"};
        Row header = row(sheet, 5, 30);
        for (int column = 0; column < headers.length; column++) {
            headerCell(header, column, headers[column], column == 0 ? styles.headerText() : styles.headerNumber());
        }
        int nextRow = 6;
        for (var value : data.payments()) {
            boolean alternate = nextRow % 2 == 1;
            Row line = row(sheet, nextRow++, 23);
            cell(line, 0, paymentMethod(value.method()), alternate ? styles.textAlt() : styles.text());
            cell(line, 1, value.payments(), alternate ? styles.numberAlt() : styles.number());
            cell(line, 2, value.amount(), alternate ? styles.moneyAlt() : styles.money());
            cell(line, 3, percentage(value.receivedSharePercentage()), alternate ? styles.percentageAlt() : styles.percentage());
        }
        finishTable(sheet, 5, headers.length, nextRow);
        widths(sheet, 7600, 4200, 5000, 4600);
    }

    private void cancellations(XSSFWorkbook workbook, Styles styles, WorkbookData data) {
        Sheet sheet = workbook.createSheet("Cancelamentos");
        configureSheet(sheet, false);
        titleBlock(sheet, styles, data, 4);
        kpi(sheet, styles, 4, 0, 1, "VENDAS CANCELADAS", data.cancellations().cancelledSales(), false);
        kpi(sheet, styles, 4, 2, 2, "ITENS CANCELADOS", data.cancellations().cancelledItems(), false);
        kpi(sheet, styles, 4, 3, 4, "VALOR CANCELADO", data.cancellations().cancelledAmount(), true);
        mergedCell(sheet, 7, 0, 4, "Motivos de cancelamento", styles.sectionTitle());
        Row header = row(sheet, 8, 30);
        headerCell(header, 0, "Motivo", styles.headerText());
        headerCell(header, 1, "Ocorrencias", styles.headerNumber());
        for (int column = 2; column <= 4; column++) headerCell(header, column, "", styles.headerText());
        int nextRow = 9;
        for (var value : data.cancellations().mainReasons()) {
            boolean alternate = nextRow % 2 == 0;
            Row line = row(sheet, nextRow++, 23);
            cell(line, 0, value.reason(), alternate ? styles.textAlt() : styles.text());
            cell(line, 1, value.occurrences(), alternate ? styles.numberAlt() : styles.number());
        }
        finishTable(sheet, 8, 2, nextRow);
        widths(sheet, 12000, 4800, 1600, 4800, 4800);
    }

    private void titleBlock(Sheet sheet, Styles styles, WorkbookData data, int lastColumn) {
        Row brand = row(sheet, 0, 27);
        mergedCell(sheet, brand.getRowNum(), 0, lastColumn, "HubOn", styles.title());
        Row title = row(sheet, 1, 34);
        mergedCell(sheet, title.getRowNum(), 0, lastColumn, data.title(), styles.subtitle());
        String metadata = data.period() + " \u00b7 " + channel(data.channel()) + " \u00b7 Gerado em "
                + LocalDateTime.now(businessClock).format(GENERATED_AT);
        Row meta = row(sheet, 2, 25);
        mergedCell(sheet, meta.getRowNum(), 0, lastColumn, metadata, styles.meta());
    }

    private void kpi(Sheet sheet, Styles styles, int labelRow, int firstColumn, int lastColumn,
            String label, Object value, boolean monetary) {
        Row labels = row(sheet, labelRow, 23);
        mergedCell(sheet, labels.getRowNum(), firstColumn, lastColumn, label, styles.kpiLabel());
        Row values = row(sheet, labelRow + 1, 31);
        mergedCell(sheet, values.getRowNum(), firstColumn, lastColumn, value,
                monetary ? styles.kpiMoney() : styles.kpiNumber());
    }

    private void finishTable(Sheet sheet, int headerRow, int columns, int nextRow) {
        int lastRow = Math.max(headerRow, nextRow - 1);
        sheet.createFreezePane(0, headerRow + 1);
        sheet.setAutoFilter(new CellRangeAddress(headerRow, lastRow, 0, columns - 1));
        sheet.setRepeatingRows(new CellRangeAddress(headerRow, headerRow, -1, -1));
    }

    private void configureSheet(Sheet sheet, boolean landscape) {
        sheet.setDisplayGridlines(false);
        sheet.setPrintGridlines(false);
        sheet.setAutobreaks(true);
        sheet.setFitToPage(true);
        sheet.setHorizontallyCenter(true);
        sheet.setMargin(Sheet.LeftMargin, 0.35);
        sheet.setMargin(Sheet.RightMargin, 0.35);
        sheet.setMargin(Sheet.TopMargin, 0.5);
        sheet.setMargin(Sheet.BottomMargin, 0.5);
        PrintSetup print = sheet.getPrintSetup();
        print.setPaperSize(PrintSetup.A4_PAPERSIZE);
        print.setLandscape(landscape);
        print.setFitWidth((short) 1);
        print.setFitHeight((short) 0);
    }

    private Row row(Sheet sheet, int rowNumber, float height) {
        Row row = sheet.getRow(rowNumber) == null ? sheet.createRow(rowNumber) : sheet.getRow(rowNumber);
        row.setHeightInPoints(height);
        return row;
    }

    private void mergedCell(Sheet sheet, int rowNumber, int firstColumn, int lastColumn,
            Object value, CellStyle style) {
        Row row = sheet.getRow(rowNumber) == null ? sheet.createRow(rowNumber) : sheet.getRow(rowNumber);
        for (int column = firstColumn; column <= lastColumn; column++) cell(row, column, "", style);
        cell(row, firstColumn, value, style);
        if (lastColumn > firstColumn) sheet.addMergedRegion(new CellRangeAddress(rowNumber, rowNumber, firstColumn, lastColumn));
    }

    private void headerCell(Row row, int column, String value, CellStyle style) {
        cell(row, column, value, style);
    }

    private void cell(Row row, int column, Object value, CellStyle style) {
        Cell cell = row.getCell(column) == null ? row.createCell(column) : row.getCell(column);
        if (value instanceof BigDecimal decimal) cell.setCellValue(decimal.doubleValue());
        else if (value instanceof LocalDateTime dateTime) cell.setCellValue(dateTime);
        else if (value instanceof Number number) cell.setCellValue(number.doubleValue());
        else cell.setCellValue(value == null ? "" : value.toString());
        cell.setCellStyle(style);
    }

    private void widths(Sheet sheet, int... widths) {
        for (int column = 0; column < widths.length; column++) sheet.setColumnWidth(column, widths[column]);
    }

    private Styles styles(XSSFWorkbook workbook) {
        DataFormat formats = workbook.createDataFormat();
        XSSFFont titleFont = font(workbook, (short) 14, true, WHITE);
        XSSFFont subtitleFont = font(workbook, (short) 20, true, WHITE);
        XSSFFont metaFont = font(workbook, (short) 10, false, TEXT);
        XSSFFont sectionFont = font(workbook, (short) 11, true, PRIMARY);
        XSSFFont labelFont = font(workbook, (short) 9, true, MUTED);
        XSSFFont valueFont = font(workbook, (short) 15, true, TEXT);
        XSSFFont headerFont = font(workbook, (short) 10, true, WHITE);
        XSSFFont textFont = font(workbook, (short) 10, false, TEXT);

        XSSFCellStyle title = baseStyle(workbook, titleFont, PRIMARY, HorizontalAlignment.LEFT, false);
        XSSFCellStyle subtitle = baseStyle(workbook, subtitleFont, PRIMARY, HorizontalAlignment.LEFT, false);
        XSSFCellStyle meta = baseStyle(workbook, metaFont, PRIMARY_LIGHT, HorizontalAlignment.LEFT, false);
        XSSFCellStyle sectionTitle = baseStyle(workbook, sectionFont, PRIMARY_LIGHT, HorizontalAlignment.LEFT, false);
        XSSFCellStyle kpiLabel = baseStyle(workbook, labelFont, SURFACE_ALT, HorizontalAlignment.LEFT, false);
        XSSFCellStyle kpiMoney = baseStyle(workbook, valueFont, SURFACE, HorizontalAlignment.RIGHT, false);
        kpiMoney.setDataFormat(formats.getFormat("\"R$\" #,##0.00"));
        XSSFCellStyle kpiNumber = baseStyle(workbook, valueFont, SURFACE, HorizontalAlignment.RIGHT, false);
        kpiNumber.setDataFormat(formats.getFormat("#,##0"));

        XSSFCellStyle headerText = baseStyle(workbook, headerFont, PRIMARY, HorizontalAlignment.LEFT, true);
        XSSFCellStyle headerCenter = copy(workbook, headerText, null, HorizontalAlignment.CENTER);
        XSSFCellStyle headerNumber = copy(workbook, headerText, null, HorizontalAlignment.RIGHT);
        XSSFCellStyle text = baseStyle(workbook, textFont, SURFACE, HorizontalAlignment.LEFT, false);
        XSSFCellStyle textAlt = copy(workbook, text, SURFACE_ALT, null);
        XSSFCellStyle wrap = copy(workbook, text, null, null);
        wrap.setWrapText(true);
        XSSFCellStyle wrapAlt = copy(workbook, wrap, SURFACE_ALT, null);
        XSSFCellStyle number = copy(workbook, text, null, HorizontalAlignment.RIGHT);
        number.setDataFormat(formats.getFormat("#,##0"));
        XSSFCellStyle numberAlt = copy(workbook, number, SURFACE_ALT, null);
        XSSFCellStyle money = copy(workbook, number, null, null);
        money.setDataFormat(formats.getFormat("\"R$\" #,##0.00"));
        XSSFCellStyle moneyAlt = copy(workbook, money, SURFACE_ALT, null);
        XSSFCellStyle percentage = copy(workbook, number, null, null);
        percentage.setDataFormat(formats.getFormat("0.0%"));
        XSSFCellStyle percentageAlt = copy(workbook, percentage, SURFACE_ALT, null);
        XSSFCellStyle dateTime = copy(workbook, text, null, HorizontalAlignment.CENTER);
        dateTime.setDataFormat(formats.getFormat("dd/mm/yyyy hh:mm"));
        XSSFCellStyle dateTimeAlt = copy(workbook, dateTime, SURFACE_ALT, null);

        return new Styles(title, subtitle, meta, sectionTitle, kpiLabel, kpiMoney, kpiNumber,
                headerText, headerCenter, headerNumber, text, textAlt, wrap, wrapAlt, number, numberAlt,
                money, moneyAlt, percentage, percentageAlt, dateTime, dateTimeAlt);
    }

    private XSSFCellStyle baseStyle(XSSFWorkbook workbook, XSSFFont font, int[] fill,
            HorizontalAlignment alignment, boolean wrap) {
        XSSFCellStyle style = workbook.createCellStyle();
        style.setFont(font);
        style.setFillForegroundColor(color(fill));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(alignment);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(wrap);
        style.setBorderBottom(BorderStyle.HAIR);
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        return style;
    }

    private XSSFCellStyle copy(XSSFWorkbook workbook, XSSFCellStyle source, int[] fill,
            HorizontalAlignment alignment) {
        XSSFCellStyle style = workbook.createCellStyle();
        style.cloneStyleFrom(source);
        if (fill != null) {
            style.setFillForegroundColor(color(fill));
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        }
        if (alignment != null) style.setAlignment(alignment);
        return style;
    }

    private XSSFFont font(XSSFWorkbook workbook, short size, boolean bold, int[] color) {
        XSSFFont font = workbook.createFont();
        font.setFontName("Aptos");
        font.setFontHeightInPoints(size);
        font.setBold(bold);
        font.setColor(color(color));
        return font;
    }

    private XSSFColor color(int[] rgb) {
        return new XSSFColor(new byte[]{(byte) rgb[0], (byte) rgb[1], (byte) rgb[2]}, new DefaultIndexedColorMap());
    }

    private BigDecimal percentage(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.movePointLeft(2);
    }

    private String channel(ReportChannel channel) {
        return channel == ReportChannel.ALL ? "Todas as origens" : channel == ReportChannel.TABLE ? "Comandas" : "Balcao";
    }

    private String channelLabel(String channel) {
        return "TABLE".equals(channel) ? "Comandas" : "COUNTER".equals(channel) ? "Balcao" : channel;
    }

    private String paymentMethods(String methods) {
        if (methods == null || methods.isBlank()) return "Sem pagamento";
        return List.of(methods.split(",")).stream().map(String::trim).map(this::paymentMethod).reduce((left, right) -> left + ", " + right).orElse("");
    }

    private String paymentMethod(String method) {
        return switch (method) {
            case "CASH" -> "Dinheiro";
            case "CREDIT_CARD" -> "Credito";
            case "DEBIT_CARD" -> "Debito";
            case "VOUCHER" -> "Voucher";
            default -> method;
        };
    }

    private record Styles(CellStyle title, CellStyle subtitle, CellStyle meta, CellStyle sectionTitle,
            CellStyle kpiLabel, CellStyle kpiMoney, CellStyle kpiNumber,
            CellStyle headerText, CellStyle headerCenter, CellStyle headerNumber,
            CellStyle text, CellStyle textAlt, CellStyle wrap, CellStyle wrapAlt,
            CellStyle number, CellStyle numberAlt, CellStyle money, CellStyle moneyAlt,
            CellStyle percentage, CellStyle percentageAlt, CellStyle dateTime, CellStyle dateTimeAlt) { }

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
