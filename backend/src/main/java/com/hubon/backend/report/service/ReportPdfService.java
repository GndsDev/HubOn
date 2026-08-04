package com.hubon.backend.report.service;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.AnnualReportResponse;
import com.hubon.backend.report.dto.DailyReportResponse;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import com.hubon.backend.report.dto.ReportPdfView;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.Collator;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ReportPdfService {

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter GENERATED_AT = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm", PT_BR);
    private static final DateTimeFormatter SALE_DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", PT_BR);

    private final SpringTemplateEngine templateEngine;
    private final Clock businessClock;

    public byte[] daily(DailyReportResponse report) {
        List<ReportPdfView.SeriesRow> series = report.hourly().stream()
                .map(hour -> seriesRow(
                        hour.hourLabel(), hour.closedTabs(), hour.orders(), hour.itemsSold(),
                        hour.grossRevenue(), hour.serviceFees(), hour.discounts(), hour.netRevenue(),
                        hour.receivedAmount(), hour.averageTicket()))
                .toList();
        return render(view(
                "Relatório diário",
                report.periodLabel(),
                report.channel(),
                report.summary(),
                comparison(report.comparison().percentageChange(), "dia anterior"),
                "Desempenho por hora",
                series,
                report.sales(),
                report.products(),
                report.categories(),
                report.paymentMethods(),
                report.channels(),
                report.cancellations()
        ));
    }

    public byte[] monthly(MonthlyReportResponse report) {
        List<ReportPdfView.SeriesRow> series = report.daily().stream()
                .map(day -> seriesRow(
                        day.date().format(DateTimeFormatter.ofPattern("dd/MM", PT_BR)),
                        day.closedTabs(), day.orders(), day.itemsSold(), day.grossRevenue(), day.serviceFees(),
                        day.discounts(), day.netRevenue(), day.receivedAmount(), day.averageTicket()))
                .toList();
        return render(view(
                "Relatório mensal",
                report.periodLabel(),
                report.channel(),
                report.summary(),
                comparison(report.comparison().percentageChange(), "mês anterior"),
                "Desempenho por dia",
                series,
                report.sales(),
                report.products(),
                report.categories(),
                report.paymentMethods(),
                report.channels(),
                report.cancellations()
        ));
    }

    public byte[] annual(AnnualReportResponse report) {
        List<ReportPdfView.SeriesRow> series = report.monthly().stream()
                .map(month -> seriesRow(
                        month.monthLabel(), month.closedTabs(), month.orders(), month.itemsSold(),
                        month.grossRevenue(), month.serviceFees(), month.discounts(), month.netRevenue(),
                        month.receivedAmount(), month.averageTicket()))
                .toList();
        return render(view(
                "Relatório anual",
                report.periodLabel(),
                report.channel(),
                report.summary(),
                comparison(report.comparison().percentageChange(), "ano anterior"),
                "Desempenho por mês",
                series,
                report.sales(),
                report.products(),
                report.categories(),
                report.paymentMethods(),
                report.channels(),
                report.cancellations()
        ));
    }

    private ReportPdfView view(
            String title,
            String periodLabel,
            ReportChannel channel,
            MonthlyReportResponse.Summary summary,
            String comparisonText,
            String seriesTitle,
            List<ReportPdfView.SeriesRow> series,
            List<MonthlyReportResponse.SaleDetail> sales,
            List<MonthlyReportResponse.ProductPerformance> products,
            List<MonthlyReportResponse.CategoryPerformance> categories,
            List<MonthlyReportResponse.PaymentPerformance> payments,
            List<MonthlyReportResponse.ChannelPerformance> channels,
            MonthlyReportResponse.CancellationSummary cancellations
    ) {
        return new ReportPdfView(
                title,
                periodLabel,
                channelLabel(channel),
                LocalDateTime.now(businessClock).format(GENERATED_AT),
                new ReportPdfView.Summary(
                        currency(summary.grossRevenue()),
                        currency(summary.serviceFees()),
                        currency(summary.discounts()),
                        currency(summary.netRevenue()),
                        currency(summary.receivedAmount()),
                        currency(summary.averageTicket()),
                        summary.closedTabs(),
                        summary.tableSales(),
                        summary.counterSales(),
                        summary.orders(),
                        summary.itemsSold()
                ),
                comparisonText,
                seriesTitle,
                series,
                saleRows(sales),
                productRows(products),
                categories.stream()
                        .map(category -> new ReportPdfView.RankingRow(
                                category.categoryName(),
                                category.quantity() + " itens | " + percentage(category.revenueSharePercentage()),
                                currency(category.salesAmount())))
                        .toList(),
                payments.stream()
                        .map(payment -> new ReportPdfView.RankingRow(
                                paymentLabel(payment.method()),
                                payment.payments() + " registros | " + percentage(payment.receivedSharePercentage()),
                                currency(payment.amount())))
                        .toList(),
                channels.stream()
                        .map(value -> new ReportPdfView.RankingRow(
                                channelLabel(ReportChannel.valueOf(value.channel())),
                                value.closedTabs() + " comandas | ticket " + currency(value.averageTicket()),
                                currency(value.netRevenue())))
                        .toList(),
                new ReportPdfView.CancellationBlock(
                        cancellations.cancelledOrders(),
                        cancellations.cancelledItems(),
                        currency(cancellations.cancelledAmount()),
                        cancellations.mainReasons().stream()
                                .map(reason -> new ReportPdfView.ReasonRow(reason.reason(), reason.occurrences()))
                                .toList()
                )
        );
    }

    private ReportPdfView.SeriesRow seriesRow(
            String label,
            long closedTabs,
            long orders,
            long itemsSold,
            BigDecimal grossRevenue,
            BigDecimal serviceFees,
            BigDecimal discounts,
            BigDecimal netRevenue,
            BigDecimal receivedAmount,
            BigDecimal averageTicket
    ) {
        return new ReportPdfView.SeriesRow(
                label,
                closedTabs,
                orders,
                itemsSold,
                currency(grossRevenue),
                currency(serviceFees),
                currency(discounts),
                currency(netRevenue),
                currency(receivedAmount),
                currency(averageTicket)
        );
    }

    private List<ReportPdfView.SaleRow> saleRows(List<MonthlyReportResponse.SaleDetail> sales) {
        return sales.stream()
                .map(sale -> new ReportPdfView.SaleRow(
                        sale.id(),
                        sale.origin(),
                        formatDateTime(sale.openedAt()),
                        formatDateTime(sale.closedAt()),
                        duration(sale.durationMinutes()),
                        sale.responsible(),
                        sale.orders(),
                        sale.items(),
                        currency(sale.grossRevenue()),
                        currency(sale.discounts()),
                        currency(sale.finalAmount()),
                        currency(sale.receivedAmount()),
                        paymentList(sale.paymentMethods())
                ))
                .toList();
    }

    private List<ReportPdfView.ProductRow> productRows(List<MonthlyReportResponse.ProductPerformance> products) {
        Collator names = Collator.getInstance(PT_BR);
        names.setStrength(Collator.PRIMARY);
        Comparator<MonthlyReportResponse.ProductPerformance> productOrder = Comparator
                .comparing(MonthlyReportResponse.ProductPerformance::salesAmount).reversed()
                .thenComparing(Comparator.comparingLong(MonthlyReportResponse.ProductPerformance::quantity).reversed())
                .thenComparing(MonthlyReportResponse.ProductPerformance::productName, names);
        Comparator<MonthlyReportResponse.VariantPerformance> variantOrder = Comparator
                .comparing(MonthlyReportResponse.VariantPerformance::salesAmount).reversed()
                .thenComparing(Comparator.comparingLong(MonthlyReportResponse.VariantPerformance::quantity).reversed())
                .thenComparing(MonthlyReportResponse.VariantPerformance::variantName, names);
        return products.stream()
                .sorted(productOrder)
                .map(product -> new ReportPdfView.ProductRow(
                        product.productName(),
                        product.categoryName(),
                        product.quantity(),
                        currency(product.salesAmount()),
                        percentage(product.revenueSharePercentage()),
                        product.variants().stream()
                                .sorted(variantOrder)
                                .map(variant -> new ReportPdfView.VariantRow(
                                        variant.variantName(), variant.quantity(), currency(variant.salesAmount())))
                                .toList()
                ))
                .toList();
    }

    private byte[] render(ReportPdfView report) {
        Context context = new Context(PT_BR);
        context.setVariable("report", report);
        String html = templateEngine.process("reports/report-pdf", context);
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(output);
            builder.run();
            return output.toByteArray();
        } catch (Exception exception) {
            throw new IllegalStateException("Não foi possível gerar o PDF do relatório", exception);
        }
    }

    private String comparison(BigDecimal value, String reference) {
        if (value == null) {
            return "Sem base comparável no " + reference;
        }
        return percentage(value.abs()) + (value.signum() >= 0 ? " acima do " : " abaixo do ") + reference;
    }

    private String currency(BigDecimal value) {
        return NumberFormat.getCurrencyInstance(PT_BR).format(value == null ? BigDecimal.ZERO : value);
    }

    private String percentage(BigDecimal value) {
        NumberFormat format = NumberFormat.getNumberInstance(PT_BR);
        format.setMaximumFractionDigits(2);
        return format.format(value == null ? BigDecimal.ZERO : value) + "%";
    }

    private String channelLabel(ReportChannel channel) {
        return channel == ReportChannel.TABLE
                ? "Mesas"
                : channel == ReportChannel.COUNTER ? "Balcão" : "Todos os canais";
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

    private String paymentList(String methods) {
        if (methods == null || methods.isBlank()) {
            return "Não informado";
        }
        return java.util.Arrays.stream(methods.split(",\\s*"))
                .map(this::paymentLabel)
                .toList()
                .stream()
                .reduce((left, right) -> left + ", " + right)
                .orElse("Não informado");
    }

    private String formatDateTime(LocalDateTime value) {
        return value == null ? "-" : value.format(SALE_DATE_TIME);
    }

    private String duration(long minutes) {
        return minutes < 60
                ? minutes + " min"
                : (minutes / 60) + "h " + (minutes % 60) + "min";
    }
}
