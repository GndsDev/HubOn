package com.hubon.backend.report.service;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.AnnualReportResponse;
import com.hubon.backend.report.dto.DailyReportResponse;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
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

class ReportWorkbookServiceTests {

    private final ReportWorkbookService service = new ReportWorkbookService(
            Clock.fixed(Instant.parse("2026-08-03T14:00:00Z"), ZoneOffset.UTC));

    @Test
    void monthlyWorkbookContainsProfessionalTypedAndFilterableSheets() throws Exception {
        byte[] content = service.monthly(monthlyReport(sales(1)));
        writeArtifact("monthly-report.xlsx", content);

        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(content))) {
            assertThat(workbook.getNumberOfSheets()).isEqualTo(9);
            assertThat(workbook.getProperties().getCoreProperties().getCreator()).isEqualTo("HubOn");
            assertThat(workbook.getSheet("Resumo")).isNotNull();
            assertThat(workbook.getSheet("Evolução diária")).isNotNull();
            assertThat(workbook.getSheet("Vendas")).isNotNull();
            assertThat(workbook.getSheet("Produtos")).isNotNull();
            assertThat(workbook.getSheet("Variações")).isNotNull();
            assertThat(workbook.getSheet("Cancelamentos")).isNotNull();

            var sales = workbook.getSheet("Vendas");
            assertThat(sales.getPaneInformation()).isNotNull();
            assertThat(sales.getCTWorksheet().isSetAutoFilter()).isTrue();
            assertThat(sales.getRow(5).getCell(0).getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(sales.getRow(5).getCell(2).getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(sales.getRow(5).getCell(11).getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(sales.getRow(5).getCell(11).getCellStyle().getDataFormatString()).contains("R$");

            var summary = workbook.getSheet("Resumo");
            assertThat(summary.isDisplayGridlines()).isFalse();
            assertThat(summary.getRow(9).getCell(1).getCellType()).isEqualTo(CellType.NUMERIC);
        }
    }

    @Test
    void dailyAndAnnualWorkbooksKeepPeriodSpecificSeriesAndProfessionalStructure() throws Exception {
        byte[] dailyContent = service.daily(dailyReport());
        byte[] annualContent = service.annual(annualReport());
        writeArtifact("daily-report.xlsx", dailyContent);
        writeArtifact("annual-report.xlsx", annualContent);

        try (XSSFWorkbook daily = new XSSFWorkbook(new ByteArrayInputStream(dailyContent));
             XSSFWorkbook annual = new XSSFWorkbook(new ByteArrayInputStream(annualContent))) {
            assertThat(daily.getNumberOfSheets()).isEqualTo(9);
            assertThat(daily.getSheet("Evolução por hora")).isNotNull();
            assertThat(daily.getSheet("Vendas").getCTWorksheet().isSetAutoFilter()).isTrue();

            assertThat(annual.getNumberOfSheets()).isEqualTo(9);
            assertThat(annual.getSheet("Evolução mensal")).isNotNull();
            var annualSummary = annual.getSheet("Resumo");
            var bestMonthRevenue = IntStream.rangeClosed(0, annualSummary.getLastRowNum())
                    .mapToObj(annualSummary::getRow)
                    .filter(row -> row != null && row.getCell(0) != null
                            && "Receita do melhor mês".equals(row.getCell(0).getStringCellValue()))
                    .findFirst()
                    .orElseThrow();
            assertThat(bestMonthRevenue.getCell(1).getCellType()).isEqualTo(CellType.NUMERIC);
        }
    }

    @Test
    void monthlyWorkbookHandlesLargeSalesVolumeWithoutLosingRows() throws Exception {
        byte[] content = service.monthly(monthlyReport(sales(1_500)));

        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(content))) {
            assertThat(workbook.getSheet("Vendas").getLastRowNum()).isEqualTo(1_504);
        }
    }

    private MonthlyReportResponse monthlyReport(List<MonthlyReportResponse.SaleDetail> sales) {
        BigDecimal gross = new BigDecimal("160.00");
        BigDecimal net = new BigDecimal("155.00");
        MonthlyReportResponse.Summary summary = new MonthlyReportResponse.Summary(
                gross, new BigDecimal("10.00"), new BigDecimal("5.00"), net, net,
                2, 2, 3, new BigDecimal("77.50"), 1, 1, 0, 0, BigDecimal.ZERO);
        MonthlyReportResponse.ProductPerformance product = new MonthlyReportResponse.ProductPerformance(
                "Coca-Cola", "Bebidas", 3, new BigDecimal("150.00"), new BigDecimal("100.00"),
                List.of(new MonthlyReportResponse.VariantPerformance("Lata", 3, new BigDecimal("150.00"))));
        return new MonthlyReportResponse(
                2026,
                7,
                "Julho de 2026",
                ReportChannel.ALL,
                summary,
                new MonthlyReportResponse.Comparison(BigDecimal.ZERO, net, null),
                List.of(product),
                List.of(new MonthlyReportResponse.CategoryPerformance(
                        "Bebidas", 3, new BigDecimal("150.00"), new BigDecimal("100.00"))),
                List.of(new MonthlyReportResponse.PaymentPerformance(
                        "PIX", 1, net, new BigDecimal("100.00"))),
                List.of(new MonthlyReportResponse.ChannelPerformance("TABLE", 1, net, net)),
                List.of(new MonthlyReportResponse.DailyPerformance(
                        LocalDate.of(2026, 7, 10), 2, 2, 3, gross,
                        new BigDecimal("10.00"), new BigDecimal("5.00"), net, net, new BigDecimal("77.50"))),
                sales,
                new MonthlyReportResponse.CancellationSummary(0, 0, BigDecimal.ZERO, List.of())
        );
    }

    private DailyReportResponse dailyReport() {
        return new DailyReportResponse(
                LocalDate.of(2026, 7, 10),
                "10 de julho de 2026",
                ReportChannel.ALL,
                summary(),
                new DailyReportResponse.Comparison(BigDecimal.ZERO, new BigDecimal("155.00"), null),
                products(),
                categories(),
                payments(),
                channels(),
                List.of(new DailyReportResponse.HourlyPerformance(
                        12, "12:00-12:59", 2, 2, 3, new BigDecimal("160.00"),
                        new BigDecimal("10.00"), new BigDecimal("5.00"), new BigDecimal("155.00"),
                        new BigDecimal("155.00"), new BigDecimal("77.50"))),
                sales(1),
                cancellations()
        );
    }

    private AnnualReportResponse annualReport() {
        return new AnnualReportResponse(
                2026,
                "Ano de 2026",
                ReportChannel.ALL,
                summary(),
                new AnnualReportResponse.Comparison(BigDecimal.ZERO, new BigDecimal("155.00"), null),
                products(),
                categories(),
                payments(),
                channels(),
                List.of(new AnnualReportResponse.MonthPerformance(
                        7, "Julho", 2, 2, 3, new BigDecimal("160.00"), new BigDecimal("10.00"),
                        new BigDecimal("5.00"), new BigDecimal("155.00"), new BigDecimal("155.00"),
                        BigDecimal.ZERO, new BigDecimal("77.50"))),
                sales(1),
                new AnnualReportResponse.Indicators("Julho", new BigDecimal("155.00"), new BigDecimal("12.92"), 1),
                cancellations()
        );
    }

    private MonthlyReportResponse.Summary summary() {
        return new MonthlyReportResponse.Summary(
                new BigDecimal("160.00"), new BigDecimal("10.00"), new BigDecimal("5.00"),
                new BigDecimal("155.00"), new BigDecimal("155.00"), 2, 2, 3,
                new BigDecimal("77.50"), 1, 1, 0, 0, BigDecimal.ZERO);
    }

    private List<MonthlyReportResponse.ProductPerformance> products() {
        return List.of(new MonthlyReportResponse.ProductPerformance(
                "Coca-Cola", "Bebidas", 3, new BigDecimal("150.00"), new BigDecimal("100.00"),
                List.of(new MonthlyReportResponse.VariantPerformance("Lata", 3, new BigDecimal("150.00")))));
    }

    private List<MonthlyReportResponse.CategoryPerformance> categories() {
        return List.of(new MonthlyReportResponse.CategoryPerformance(
                "Bebidas", 3, new BigDecimal("150.00"), new BigDecimal("100.00")));
    }

    private List<MonthlyReportResponse.PaymentPerformance> payments() {
        return List.of(new MonthlyReportResponse.PaymentPerformance(
                "PIX", 1, new BigDecimal("155.00"), new BigDecimal("100.00")));
    }

    private List<MonthlyReportResponse.ChannelPerformance> channels() {
        return List.of(new MonthlyReportResponse.ChannelPerformance(
                "TABLE", 1, new BigDecimal("155.00"), new BigDecimal("155.00")));
    }

    private MonthlyReportResponse.CancellationSummary cancellations() {
        return new MonthlyReportResponse.CancellationSummary(0, 0, BigDecimal.ZERO, List.of());
    }

    private List<MonthlyReportResponse.SaleDetail> sales(int count) {
        return IntStream.rangeClosed(1, count).mapToObj(id -> new MonthlyReportResponse.SaleDetail(
                id, "Mesa " + id, LocalDateTime.of(2026, 7, 10, 11, 0),
                LocalDateTime.of(2026, 7, 10, 12, 0), 60, "Operador", 2, 3,
                new BigDecimal("160.00"), new BigDecimal("10.00"), new BigDecimal("5.00"),
                new BigDecimal("155.00"), new BigDecimal("155.00"), "PIX")).toList();
    }

    private void writeArtifact(String filename, byte[] content) throws IOException {
        if (!Boolean.getBoolean("hubon.validation.artifacts")) {
            return;
        }
        Path directory = Path.of("target", "report-validation");
        Files.createDirectories(directory);
        Files.write(directory.resolve(filename), content);
    }
}
