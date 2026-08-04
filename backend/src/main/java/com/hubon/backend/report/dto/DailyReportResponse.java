package com.hubon.backend.report.dto;

import com.hubon.backend.report.domain.ReportChannel;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record DailyReportResponse(
        LocalDate date,
        String periodLabel,
        ReportChannel channel,
        MonthlyReportResponse.Summary summary,
        Comparison comparison,
        List<MonthlyReportResponse.ProductPerformance> products,
        List<MonthlyReportResponse.CategoryPerformance> categories,
        List<MonthlyReportResponse.PaymentPerformance> paymentMethods,
        List<MonthlyReportResponse.ChannelPerformance> channels,
        List<HourlyPerformance> hourly,
        List<MonthlyReportResponse.SaleDetail> sales,
        MonthlyReportResponse.CancellationSummary cancellations
) {
    public record Comparison(
            BigDecimal previousDayNetRevenue,
            BigDecimal netRevenueDifference,
            BigDecimal percentageChange
    ) {
    }

    public record HourlyPerformance(
            int hour,
            String hourLabel,
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
    }
}
