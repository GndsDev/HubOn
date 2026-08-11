package com.hubon.backend.report.service;

import com.hubon.backend.report.controller.MonthlyReportController;
import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.AnnualReportResponse;
import com.hubon.backend.report.dto.DailyReportResponse;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReportArtifactServiceTests {
    private ReportPdfService pdfService;
    private ReportWorkbookService workbookService;

    @BeforeEach
    void setup() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode("HTML");
        resolver.setCharacterEncoding(StandardCharsets.UTF_8.name());
        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);
        Clock clock = Clock.fixed(Instant.parse("2026-08-07T15:00:00Z"), ZoneOffset.UTC);
        pdfService = new ReportPdfService(engine, clock);
        workbookService = new ReportWorkbookService(clock);
    }

    @Test
    void pdfContainsReadableSimplifiedSections() throws Exception {
        byte[] pdf = pdfService.monthly(monthly());
        assertPdf(pdf);
        try (PDDocument document = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(document);
            assertThat(text).contains("HubOn", "Vendas detalhadas", "Fechamento", "Responsavel",
                    "Total", "Recebido", "Pagamento", "Produtos", "Cancelamentos", "Jantinha");
            assertThat(text).doesNotContain("Abertura", "Duracao", "Variacoes", "Pedidos");
        }
    }

    @Test
    void pdfGeneratesForDailyMonthlyAndAnnualPeriods() throws Exception {
        assertPdf(pdfService.daily(daily()));
        assertPdf(pdfService.monthly(monthly()));
        assertPdf(pdfService.annual(annual()));
    }

    @Test
    void pdfTemplateUsesDedicatedDeterministicColumnsAndSemanticAlignment() throws Exception {
        String template;
        try (var input = getClass().getClassLoader().getResourceAsStream("templates/reports/report-pdf.html")) {
            assertThat(input).isNotNull();
            template = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertThat(columnsIn(template, "evolution-columns")).isEqualTo(7);
        assertThat(columnsIn(template, "sales-columns")).isEqualTo(8);
        assertThat(columnsIn(template, "product-columns")).isEqualTo(5);
        assertThat(template).contains("table-layout: fixed", "width: 270mm", "white-space: nowrap");
        assertThat(template).contains("<th class=\"money\">Total</th>", "<td class=\"money\" th:text=\"${sale.finalAmount}\"");
        assertThat(template).contains("<th class=\"date\">Fechamento</th>", "<td class=\"date\" th:text=\"${sale.closedAt}\"");
    }

    @Test
    void workbookUsesFiveProfessionalSheetsAndTypedCells() throws Exception {
        byte[] xlsx = workbookService.monthly(monthly());
        assertThat(xlsx).isNotEmpty();
        assertThat(new String(xlsx, 0, 2, StandardCharsets.US_ASCII)).isEqualTo("PK");
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
            assertThat(workbook.sheetIterator()).toIterable()
                    .extracting(Sheet::getSheetName)
                    .containsExactly("Resumo", "Vendas", "Produtos", "Pagamentos", "Cancelamentos");
            assertThat(workbook.getSheet("Evolucao")).isNull();
            assertThat(workbook.getSheet("Categorias")).isNull();
            assertThat(workbook.getSheet("Canais")).isNull();

            var summary = workbook.getSheet("Resumo");
            assertThat(summary.getNumMergedRegions()).isGreaterThan(6);
            assertThat(summary.isDisplayGridlines()).isFalse();
            assertThat(summary.getRow(0).getCell(0).getStringCellValue()).isEqualTo("HubOn");
            assertThat(summary.getRow(5).getCell(0).getNumericCellValue()).isEqualTo(22.0);
            assertThat(summary.getRow(10).getCell(0).getStringCellValue()).isEqualTo("Desempenho no periodo");

            var sales = workbook.getSheet("Vendas");
            assertThat(sales.getPaneInformation()).isNotNull();
            assertThat(sales.getPaneInformation().isFreezePane()).isTrue();
            assertThat(sales.getPaneInformation().getHorizontalSplitPosition()).isEqualTo((short) 6);
            assertThat(sales.getCTWorksheet().isSetAutoFilter()).isTrue();
            assertThat(sales.getRow(6).getCell(2).getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(sales.getRow(6).getCell(2).getCellStyle().getDataFormatString()).contains("dd/mm/yyyy");
            assertThat(sales.getRow(6).getCell(10).getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(sales.getRow(6).getCell(10).getCellStyle().getDataFormatString()).contains("R$");
            assertThat(sales.getRow(5).getCell(0).getCellStyle().getFillForegroundColorColor()).isNotNull();
            assertThat(sales.getRow(5).getHeightInPoints()).isGreaterThan(20);
        }
    }

    @Test
    void controllerExportsOfficialContentTypesAndFileExtensions() {
        MonthlyReportService reportService = mock(MonthlyReportService.class);
        when(reportService.generate(2026, 8, ReportChannel.ALL)).thenReturn(monthly());
        MonthlyReportController controller = new MonthlyReportController(reportService, pdfService, workbookService,
                Clock.fixed(Instant.parse("2026-08-07T15:00:00Z"), ZoneOffset.UTC));

        var xlsx = controller.monthlyXlsx(2026, 8, ReportChannel.ALL);
        assertThat(xlsx.getHeaders().getContentType()).isEqualTo(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        assertThat(xlsx.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                .isEqualTo("attachment; filename=\"hubon-relatorio-mensal-2026-08.xlsx\"");
        assertThat(xlsx.getBody()).isNotEmpty();

        var pdf = controller.monthlyPdf(2026, 8, ReportChannel.ALL);
        assertThat(pdf.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_PDF);
        assertThat(pdf.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                .isEqualTo("attachment; filename=\"hubon-relatorio-mensal-2026-08.pdf\"");
        assertThat(pdf.getBody()).isNotEmpty();
    }

    private void assertPdf(byte[] pdf) throws Exception {
        assertThat(pdf).isNotEmpty();
        assertThat(new String(pdf, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        try (PDDocument document = Loader.loadPDF(pdf)) {
            assertThat(document.getNumberOfPages()).isPositive();
        }
    }

    private long columnsIn(String template, String className) {
        int start = template.indexOf("<colgroup class=\"" + className + "\">");
        int end = template.indexOf("</colgroup>", start);
        assertThat(start).isGreaterThanOrEqualTo(0);
        assertThat(end).isGreaterThan(start);
        String colgroup = template.substring(start, end);
        return (colgroup.length() - colgroup.replace("<col ", "").length()) / "<col ".length();
    }

    private MonthlyReportResponse monthly() {
        return new MonthlyReportResponse(2026, 8, "Agosto de 2026", ReportChannel.ALL, summary(),
                new MonthlyReportResponse.Comparison(amount("20"), amount("2"), amount("10")),
                products(), categories(), payments(), channels(),
                List.of(new MonthlyReportResponse.DailyPerformance(LocalDate.of(2026, 8, 7), 1, 1,
                        amount("20"), amount("2"), BigDecimal.ZERO, amount("22"), amount("22"), amount("22"))),
                sales(), cancellations());
    }

    private DailyReportResponse daily() {
        return new DailyReportResponse(LocalDate.of(2026, 8, 7), "7 de agosto de 2026", ReportChannel.ALL,
                summary(), new DailyReportResponse.Comparison(amount("20"), amount("2"), amount("10")),
                products(), categories(), payments(), channels(),
                List.of(new DailyReportResponse.HourlyPerformance(12, "12:00-12:59", 1, 1,
                        amount("20"), amount("2"), BigDecimal.ZERO, amount("22"), amount("22"), amount("22"))),
                sales(), cancellations());
    }

    private AnnualReportResponse annual() {
        return new AnnualReportResponse(2026, "Ano de 2026", ReportChannel.ALL, summary(),
                new AnnualReportResponse.Comparison(amount("20"), amount("2"), amount("10")),
                products(), categories(), payments(), channels(),
                List.of(new AnnualReportResponse.MonthPerformance(8, "Agosto", 1, 1,
                        amount("20"), amount("2"), BigDecimal.ZERO, amount("22"), amount("22"),
                        BigDecimal.ZERO, amount("22"))),
                sales(), new AnnualReportResponse.Indicators("Agosto", amount("22"), amount("22"), 1),
                cancellations());
    }

    private List<MonthlyReportResponse.ProductPerformance> products() {
        return List.of(new MonthlyReportResponse.ProductPerformance("Jantinha", "Pratos", 1,
                amount("20"), amount("100")));
    }

    private List<MonthlyReportResponse.CategoryPerformance> categories() {
        return List.of(new MonthlyReportResponse.CategoryPerformance("Pratos", 1, amount("20"), amount("100")));
    }

    private List<MonthlyReportResponse.PaymentPerformance> payments() {
        return List.of(new MonthlyReportResponse.PaymentPerformance("PIX", 1, amount("22"), amount("100")));
    }

    private List<MonthlyReportResponse.ChannelPerformance> channels() {
        return List.of(new MonthlyReportResponse.ChannelPerformance("TABLE", 1, amount("22"), amount("22")));
    }

    private List<MonthlyReportResponse.SaleDetail> sales() {
        return List.of(new MonthlyReportResponse.SaleDetail(1, "Mesa 1",
                LocalDateTime.of(2026, 8, 7, 12, 0), LocalDateTime.of(2026, 8, 7, 13, 0),
                60, "Operador", 1, amount("20"), amount("2"), BigDecimal.ZERO,
                amount("22"), amount("22"), "PIX"));
    }

    private MonthlyReportResponse.CancellationSummary cancellations() {
        return new MonthlyReportResponse.CancellationSummary(0, 0, BigDecimal.ZERO, List.of());
    }

    private MonthlyReportResponse.Summary summary() {
        return new MonthlyReportResponse.Summary(amount("20"), amount("2"), BigDecimal.ZERO,
                amount("22"), amount("22"), 1, 1, amount("22"), 1, 0,
                0, 0, BigDecimal.ZERO);
    }

    private BigDecimal amount(String value) {
        return new BigDecimal(value);
    }
}
