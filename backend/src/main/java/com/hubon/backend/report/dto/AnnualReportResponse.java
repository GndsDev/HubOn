package com.hubon.backend.report.dto;

import com.hubon.backend.report.domain.ReportChannel;

import java.math.BigDecimal;
import java.util.List;

public record AnnualReportResponse(
        int year, String periodLabel, ReportChannel channel,
        MonthlyReportResponse.Summary summary, Comparison comparison,
        List<MonthlyReportResponse.ProductPerformance> products,
        List<MonthlyReportResponse.CategoryPerformance> categories,
        List<MonthlyReportResponse.PaymentPerformance> paymentMethods,
        List<MonthlyReportResponse.ChannelPerformance> channels,
        List<MonthPerformance> monthly,
        List<MonthlyReportResponse.SaleDetail> sales,
        Indicators indicators,
        MonthlyReportResponse.CancellationSummary cancellations
) {
    public record Comparison(BigDecimal previousYearNetRevenue, BigDecimal netRevenueDifference,
            BigDecimal percentageChange) { }
    public record MonthPerformance(int month, String monthLabel, long closedSales, long itemsSold,
            BigDecimal grossRevenue, BigDecimal serviceFees, BigDecimal discounts,
            BigDecimal netRevenue, BigDecimal receivedAmount, BigDecimal cancelledAmount,
            BigDecimal averageTicket) { }
    public record Indicators(String bestMonthLabel, BigDecimal bestMonthNetRevenue,
            BigDecimal averageMonthlyRevenue, long activeMonths) { }
}
