package com.hubon.backend.report.service;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.controller.MonthlyReportController;
import com.hubon.backend.report.dto.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.*;
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
    void pdfContainsSimplifiedSalesSectionsWithoutVariantBreakdown() throws Exception {
        byte[] pdf = pdfService.monthly(monthly());
        assertThat(new String(pdf, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        try (PDDocument document = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(document);
            assertThat(text).contains("HubOn", "Vendas detalhadas", "Produtos", "Cancelamentos", "Jantinha");
            assertThat(text).doesNotContain("Variacoes", "Pedidos");
        }
    }

    @Test
    void workbookUsesSalesProductsAndPaymentsSheets() throws Exception {
        byte[] xlsx = workbookService.monthly(monthly());
        assertThat(xlsx).isNotEmpty();
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
            assertThat(workbook.sheetIterator()).toIterable()
                    .extracting(Sheet::getSheetName)
                    .containsExactly("Resumo", "Evolucao", "Vendas", "Produtos", "Categorias", "Pagamentos",
                            "Canais", "Cancelamentos");
            assertThat(workbook.getSheet("Variacoes")).isNull();
            assertThat(workbook.getSheet("Resumo").getRow(5).getCell(3).getNumericCellValue()).isEqualTo(22.0);
            var sales = workbook.getSheet("Vendas");
            assertThat(sales.getPaneInformation()).isNotNull();
            assertThat(sales.getPaneInformation().isFreezePane()).isTrue();
            assertThat(sales.getCTWorksheet().isSetAutoFilter()).isTrue();
            assertThat(sales.getRow(1).getCell(2).getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(sales.getRow(1).getCell(2).getCellStyle().getDataFormatString()).contains("dd/mm/yyyy");
            assertThat(sales.getRow(1).getCell(10).getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(sales.getRow(1).getCell(10).getCellStyle().getDataFormatString()).contains("R$");
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

    private MonthlyReportResponse monthly() {
        return new MonthlyReportResponse(2026, 8, "Agosto de 2026", ReportChannel.ALL, summary(),
                new MonthlyReportResponse.Comparison(amount("20"), amount("2"), amount("10")),
                List.of(new MonthlyReportResponse.ProductPerformance("Jantinha", "Pratos", 1,
                        amount("20"), amount("100"))),
                List.of(new MonthlyReportResponse.CategoryPerformance("Pratos", 1, amount("20"), amount("100"))),
                List.of(new MonthlyReportResponse.PaymentPerformance("PIX", 1, amount("22"), amount("100"))),
                List.of(new MonthlyReportResponse.ChannelPerformance("TABLE", 1, amount("22"), amount("22"))),
                List.of(new MonthlyReportResponse.DailyPerformance(LocalDate.of(2026, 8, 7), 1, 1,
                        amount("20"), amount("2"), BigDecimal.ZERO, amount("22"), amount("22"), amount("22"))),
                List.of(new MonthlyReportResponse.SaleDetail(1, "Mesa 1",
                        LocalDateTime.of(2026, 8, 7, 12, 0), LocalDateTime.of(2026, 8, 7, 13, 0),
                        60, "Operador", 1, amount("20"), amount("2"), BigDecimal.ZERO,
                        amount("22"), amount("22"), "PIX")),
                new MonthlyReportResponse.CancellationSummary(0, 0, BigDecimal.ZERO, List.of()));
    }

    private MonthlyReportResponse.Summary summary() {
        return new MonthlyReportResponse.Summary(amount("20"), amount("2"), BigDecimal.ZERO,
                amount("22"), amount("22"), 1, 1, amount("22"), 1, 0,
                0, 0, BigDecimal.ZERO);
    }

    private BigDecimal amount(String value) { return new BigDecimal(value); }
}
