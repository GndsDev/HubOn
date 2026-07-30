package com.hubon.backend.report.dto;

import com.hubon.backend.report.domain.ReportChannel;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record MonthlyReportResponse(
        int year,
        int month,
        String periodLabel,
        ReportChannel channel,
        Summary summary,
        Comparison comparison,
        List<ProductPerformance> products,
        List<CategoryPerformance> categories,
        List<PaymentPerformance> paymentMethods,
        List<ChannelPerformance> channels,
        List<DailyPerformance> daily,
        CancellationSummary cancellations
) {
    public record Summary(
            BigDecimal grossRevenue,
            BigDecimal serviceFees,
            BigDecimal discounts,
            BigDecimal netRevenue,
            BigDecimal receivedAmount,
            long closedTabs,
            long orders,
            long itemsSold,
            BigDecimal averageTicket
    ) {
    }

    public record Comparison(
            BigDecimal previousMonthNetRevenue,
            BigDecimal netRevenueDifference,
            BigDecimal percentageChange
    ) {
    }

    public record ProductPerformance(
            String productName,
            String categoryName,
            long quantity,
            BigDecimal salesAmount,
            BigDecimal revenueSharePercentage,
            List<VariantPerformance> variants
    ) {
    }

    public record VariantPerformance(
            String variantName,
            long quantity,
            BigDecimal salesAmount
    ) {
    }

    public record CategoryPerformance(
            String categoryName,
            long quantity,
            BigDecimal salesAmount,
            BigDecimal revenueSharePercentage
    ) {
    }

    public record PaymentPerformance(
            String method,
            long payments,
            BigDecimal amount,
            BigDecimal receivedSharePercentage
    ) {
    }

    public record ChannelPerformance(
            String channel,
            long closedTabs,
            BigDecimal netRevenue,
            BigDecimal averageTicket
    ) {
    }

    public record DailyPerformance(
            LocalDate date,
            long closedTabs,
            BigDecimal netRevenue,
            BigDecimal averageTicket
    ) {
    }

    public record CancellationSummary(
            long cancelledOrders,
            long cancelledItems,
            BigDecimal cancelledAmount,
            List<CancellationReason> mainReasons
    ) {
    }

    public record CancellationReason(String reason, long occurrences) {
    }
}
