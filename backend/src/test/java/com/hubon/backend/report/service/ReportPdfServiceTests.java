package com.hubon.backend.report.service;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.AnnualReportResponse;
import com.hubon.backend.report.dto.DailyReportResponse;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class ReportPdfServiceTests {

    private ReportPdfService service;

    @BeforeEach
    void setup() {
        System.setProperty("pdfbox.fontcache", java.nio.file.Path.of("target").toAbsolutePath().toString());
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode("HTML");
        resolver.setCharacterEncoding(StandardCharsets.UTF_8.name());
        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);
        service = new ReportPdfService(
                engine,
                Clock.fixed(Instant.parse("2026-08-03T14:00:00Z"), ZoneOffset.UTC)
        );
    }

    @Test
    void monthlyPdfIsMultipageAndKeepsDetailedSectionsInBusinessOrder() throws Exception {
        MonthlyReportResponse report = new MonthlyReportResponse(
                2026,
                7,
                "Julho de 2026",
                ReportChannel.ALL,
                summary(),
                new MonthlyReportResponse.Comparison(amount("100"), amount("50"), amount("50")),
                unsortedProducts(),
                categories(),
                payments(),
                channels(),
                List.of(dailyPerformance()),
                manySales(),
                cancellations()
        );

        byte[] pdf = service.monthly(report);
        writeArtifact("monthly-report.pdf", pdf);
        String text = pdfText(pdf);
        List<String> salesPages = pdfPageTexts(pdf).stream()
                .filter(page -> page.contains("Mesa "))
                .toList();

        assertThat(new String(pdf, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        assertThat(pdfPages(pdf)).isGreaterThanOrEqualTo(3);
        assertThat(salesPages).hasSizeGreaterThanOrEqualTo(3)
                .allSatisfy(page -> assertThat(page).contains("ID", "ORIGEM", "PAGAMENTOS"));
        assertThat(text).contains(
                "HubOn", "Relatório mensal", "Desempenho por dia", "Vendas detalhadas",
                "Produtos e variações", "Cancelamentos no período", "Produto maior", "Produto menor");
        assertThat(text.indexOf("Produto maior")).isLessThan(text.indexOf("Produto menor"));
    }

    @Test
    void dailyPdfUsesHourlySeriesAndSaleDetails() throws Exception {
        DailyReportResponse report = new DailyReportResponse(
                LocalDate.of(2026, 7, 10),
                "10 de julho de 2026",
                ReportChannel.TABLE,
                summary(),
                new DailyReportResponse.Comparison(amount("100"), amount("50"), amount("50")),
                unsortedProducts(),
                categories(),
                payments(),
                channels(),
                List.of(hourlyPerformance()),
                List.of(sale(1)),
                cancellations()
        );

        byte[] pdf = service.daily(report);
        writeArtifact("daily-report.pdf", pdf);
        String text = pdfText(pdf);

        assertThat(text).contains("Relatório diário", "Desempenho por hora", "12:00-12:59", "Mesa 1");
    }

    @Test
    void annualPdfUsesTheConsolidatedMonthlySeries() throws Exception {
        AnnualReportResponse report = new AnnualReportResponse(
                2026,
                "Ano de 2026",
                ReportChannel.COUNTER,
                summary(),
                new AnnualReportResponse.Comparison(amount("100"), amount("50"), amount("50")),
                unsortedProducts(),
                categories(),
                payments(),
                channels(),
                List.of(monthPerformance(1, "Janeiro", "50"), monthPerformance(2, "Fevereiro", "100")),
                List.of(sale(1)),
                new AnnualReportResponse.Indicators("Fevereiro", amount("100"), amount("12.50"), 2),
                cancellations()
        );

        byte[] pdf = service.annual(report);
        writeArtifact("annual-report.pdf", pdf);
        String text = pdfText(pdf);

        assertThat(text).contains("Relatório anual", "Ano de 2026", "Janeiro", "Fevereiro", "Balcão");
        assertThat(text.indexOf("Produto maior")).isLessThan(text.indexOf("Produto menor"));
    }

    private String pdfText(byte[] pdf) throws Exception {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(document);
        }
    }

    private int pdfPages(byte[] pdf) throws Exception {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            return document.getNumberOfPages();
        }
    }

    private List<String> pdfPageTexts(byte[] pdf) throws Exception {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper();
            return IntStream.rangeClosed(1, document.getNumberOfPages())
                    .mapToObj(page -> {
                        try {
                            stripper.setStartPage(page);
                            stripper.setEndPage(page);
                            return stripper.getText(document);
                        } catch (Exception exception) {
                            throw new IllegalStateException(exception);
                        }
                    })
                    .toList();
        }
    }

    private MonthlyReportResponse.Summary summary() {
        return new MonthlyReportResponse.Summary(
                amount("160"), amount("10"), amount("10"), amount("150"), amount("150"),
                2, 2, 3, amount("75"), 1, 1, 0, 0, BigDecimal.ZERO);
    }

    private MonthlyReportResponse.DailyPerformance dailyPerformance() {
        return new MonthlyReportResponse.DailyPerformance(
                LocalDate.of(2026, 7, 10), 2, 2, 3,
                amount("160"), amount("10"), amount("10"), amount("150"), amount("150"), amount("75"));
    }

    private DailyReportResponse.HourlyPerformance hourlyPerformance() {
        return new DailyReportResponse.HourlyPerformance(
                12, "12:00-12:59", 2, 2, 3,
                amount("160"), amount("10"), amount("10"), amount("150"), amount("150"), amount("75"));
    }

    private AnnualReportResponse.MonthPerformance monthPerformance(int month, String label, String revenue) {
        BigDecimal value = amount(revenue);
        return new AnnualReportResponse.MonthPerformance(
                month, label, 1, 1, 1, value, BigDecimal.ZERO, BigDecimal.ZERO,
                value, value, BigDecimal.ZERO, value);
    }

    private List<MonthlyReportResponse.SaleDetail> manySales() {
        return IntStream.rangeClosed(1, 90).mapToObj(this::sale).toList();
    }

    private MonthlyReportResponse.SaleDetail sale(int id) {
        return new MonthlyReportResponse.SaleDetail(
                id,
                "Mesa " + id,
                LocalDateTime.of(2026, 7, 10, 11, 0),
                LocalDateTime.of(2026, 7, 10, 12, 0),
                60,
                "Operador",
                1,
                2,
                amount("160"),
                amount("10"),
                amount("10"),
                amount("150"),
                amount("150"),
                "PIX"
        );
    }

    private List<MonthlyReportResponse.ProductPerformance> unsortedProducts() {
        return List.of(
                new MonthlyReportResponse.ProductPerformance(
                        "Produto menor", "Categoria", 2, amount("50"), amount("33.33"),
                        List.of(new MonthlyReportResponse.VariantPerformance("Pequena", 2, amount("50")))),
                new MonthlyReportResponse.ProductPerformance(
                        "Produto maior", "Categoria", 1, amount("100"), amount("66.67"),
                        List.of(new MonthlyReportResponse.VariantPerformance("Grande", 1, amount("100"))))
        );
    }

    private List<MonthlyReportResponse.CategoryPerformance> categories() {
        return List.of(new MonthlyReportResponse.CategoryPerformance("Categoria", 3, amount("150"), amount("100")));
    }

    private List<MonthlyReportResponse.PaymentPerformance> payments() {
        return List.of(new MonthlyReportResponse.PaymentPerformance("PIX", 2, amount("150"), amount("100")));
    }

    private List<MonthlyReportResponse.ChannelPerformance> channels() {
        return List.of(new MonthlyReportResponse.ChannelPerformance("COUNTER", 2, amount("150"), amount("75")));
    }

    private MonthlyReportResponse.CancellationSummary cancellations() {
        return new MonthlyReportResponse.CancellationSummary(0, 0, BigDecimal.ZERO, List.of());
    }

    private BigDecimal amount(String value) {
        return new BigDecimal(value);
    }

    private void writeArtifact(String filename, byte[] content) throws Exception {
        if (!Boolean.getBoolean("hubon.validation.artifacts")) {
            return;
        }
        Path directory = Path.of("target", "report-validation");
        Files.createDirectories(directory);
        Files.write(directory.resolve(filename), content);
    }
}
