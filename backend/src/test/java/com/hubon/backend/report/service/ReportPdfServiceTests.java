package com.hubon.backend.report.service;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.AnnualReportResponse;
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
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

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
    void monthlyPdfRendersTheThymeleafTemplateInFixedBusinessOrder() throws Exception {
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
                List.of(new MonthlyReportResponse.DailyPerformance(LocalDate.of(2026, 7, 10), 2, amount("150"), amount("75"))),
                cancellations()
        );

        byte[] pdf = service.monthly(report);
        String text = pdfText(pdf);

        assertThat(new String(pdf, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        assertThat(text).contains("HubOn", "Relatório mensal", "Produto maior", "Produto menor");
        assertThat(text.indexOf("Produto maior")).isLessThan(text.indexOf("Produto menor"));
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
                List.of(
                        new AnnualReportResponse.MonthPerformance(1, "Janeiro", 1, amount("50"), amount("50")),
                        new AnnualReportResponse.MonthPerformance(2, "Fevereiro", 1, amount("100"), amount("100"))
                ),
                cancellations()
        );

        String text = pdfText(service.annual(report));

        assertThat(text).contains("Relatório anual", "Ano de 2026", "Janeiro", "Fevereiro", "Balcão");
        assertThat(text.indexOf("Produto maior")).isLessThan(text.indexOf("Produto menor"));
    }

    private String pdfText(byte[] pdf) throws Exception {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(document);
        }
    }

    private MonthlyReportResponse.Summary summary() {
        return new MonthlyReportResponse.Summary(
                amount("160"), amount("10"), amount("10"), amount("150"), amount("150"), 2, 2, 3, amount("75"));
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
}
