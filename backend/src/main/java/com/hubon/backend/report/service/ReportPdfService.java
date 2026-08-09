package com.hubon.backend.report.service;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.*;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ReportPdfService {
    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", PT_BR);
    private final SpringTemplateEngine templateEngine;
    private final Clock businessClock;

    public byte[] daily(DailyReportResponse report) {
        List<ReportPdfView.SeriesRow> series = report.hourly().stream().map(row -> series(row.hourLabel(),
                row.closedSales(), row.itemsSold(), row.grossRevenue(), row.serviceFees(), row.discounts(),
                row.netRevenue(), row.receivedAmount(), row.averageTicket())).toList();
        return render(view("Relat\u00f3rio di\u00e1rio", report.periodLabel(), report.channel(), report.summary(),
                comparison(report.comparison().percentageChange(), "dia anterior"), "Desempenho por hora",
                series, report.sales(), report.products(), report.categories(), report.paymentMethods(),
                report.channels(), report.cancellations()));
    }

    public byte[] monthly(MonthlyReportResponse report) {
        List<ReportPdfView.SeriesRow> series = report.daily().stream().map(row -> series(
                row.date().format(DateTimeFormatter.ofPattern("dd/MM")), row.closedSales(), row.itemsSold(),
                row.grossRevenue(), row.serviceFees(), row.discounts(), row.netRevenue(),
                row.receivedAmount(), row.averageTicket())).toList();
        return render(view("Relat\u00f3rio mensal", report.periodLabel(), report.channel(), report.summary(),
                comparison(report.comparison().percentageChange(), "m\u00eas anterior"), "Desempenho por dia",
                series, report.sales(), report.products(), report.categories(), report.paymentMethods(),
                report.channels(), report.cancellations()));
    }

    public byte[] annual(AnnualReportResponse report) {
        List<ReportPdfView.SeriesRow> series = report.monthly().stream().map(row -> series(row.monthLabel(),
                row.closedSales(), row.itemsSold(), row.grossRevenue(), row.serviceFees(), row.discounts(),
                row.netRevenue(), row.receivedAmount(), row.averageTicket())).toList();
        return render(view("Relat\u00f3rio anual", report.periodLabel(), report.channel(), report.summary(),
                comparison(report.comparison().percentageChange(), "ano anterior"), "Desempenho por m\u00eas",
                series, report.sales(), report.products(), report.categories(), report.paymentMethods(),
                report.channels(), report.cancellations()));
    }

    private ReportPdfView view(String title, String period, ReportChannel channel,
            MonthlyReportResponse.Summary summary, String comparison, String seriesTitle,
            List<ReportPdfView.SeriesRow> series, List<MonthlyReportResponse.SaleDetail> sales,
            List<MonthlyReportResponse.ProductPerformance> products,
            List<MonthlyReportResponse.CategoryPerformance> categories,
            List<MonthlyReportResponse.PaymentPerformance> payments,
            List<MonthlyReportResponse.ChannelPerformance> channels,
            MonthlyReportResponse.CancellationSummary cancellations) {
        return new ReportPdfView(title, period, channelLabel(channel),
                LocalDateTime.now(businessClock).format(DATE_TIME),
                new ReportPdfView.Summary(money(summary.grossRevenue()), money(summary.serviceFees()),
                        money(summary.discounts()), money(summary.netRevenue()), money(summary.receivedAmount()),
                        money(summary.averageTicket()), summary.closedSales(), summary.tableSales(),
                        summary.counterSales(), summary.itemsSold()), comparison, seriesTitle, series,
                sales.stream().map(this::sale).toList(),
                products.stream().map(product -> new ReportPdfView.ProductRow(product.productName(),
                        product.categoryName(), product.quantity(), money(product.salesAmount()),
                        percent(product.revenueSharePercentage()))).toList(),
                categories.stream().map(category -> new ReportPdfView.RankingRow(category.categoryName(),
                        category.quantity() + " itens", money(category.salesAmount()))).toList(),
                payments.stream().map(payment -> new ReportPdfView.RankingRow(payment.method(),
                        payment.payments() + " recebimentos", money(payment.amount()))).toList(),
                channels.stream().map(value -> new ReportPdfView.RankingRow(value.channel(),
                        value.closedSales() + " vendas", money(value.netRevenue()))).toList(),
                new ReportPdfView.CancellationBlock(cancellations.cancelledSales(),
                        cancellations.cancelledItems(), money(cancellations.cancelledAmount()),
                        cancellations.mainReasons().stream().map(reason -> new ReportPdfView.ReasonRow(
                                reason.reason(), reason.occurrences())).toList()));
    }

    private ReportPdfView.SeriesRow series(String label, long sales, long items, BigDecimal gross,
            BigDecimal fees, BigDecimal discounts, BigDecimal net, BigDecimal received, BigDecimal ticket) {
        return new ReportPdfView.SeriesRow(label, sales, items, money(gross), money(fees), money(discounts),
                money(net), money(received), money(ticket));
    }

    private ReportPdfView.SaleRow sale(MonthlyReportResponse.SaleDetail sale) {
        return new ReportPdfView.SaleRow(sale.id(), sale.origin(), sale.openedAt().format(DATE_TIME),
                sale.closedAt().format(DATE_TIME), sale.durationMinutes() + " min", sale.responsible(),
                sale.items(), money(sale.grossRevenue()), money(sale.discounts()), money(sale.finalAmount()),
                money(sale.receivedAmount()), sale.paymentMethods());
    }

    private byte[] render(ReportPdfView view) {
        Context context = new Context(PT_BR);
        context.setVariable("report", view);
        String html = templateEngine.process("reports/report-pdf", context);
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            new PdfRendererBuilder().useFastMode().withHtmlContent(html, null).toStream(output).run();
            return output.toByteArray();
        } catch (Exception exception) {
            throw new IllegalStateException("Nao foi possivel gerar o PDF do relatorio", exception);
        }
    }

    private String money(BigDecimal value) { return NumberFormat.getCurrencyInstance(PT_BR).format(value); }
    private String percent(BigDecimal value) { return value.setScale(2) + "%"; }
    private String channelLabel(ReportChannel channel) { return channel == ReportChannel.ALL ? "Todos os canais" : channel == ReportChannel.TABLE ? "Mesas" : "Balcao"; }
    private String comparison(BigDecimal percentage, String base) { return "Variacao sobre " + base + ": " + (percentage.signum() > 0 ? "+" : "") + percent(percentage); }
}
