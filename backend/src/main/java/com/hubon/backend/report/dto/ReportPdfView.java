package com.hubon.backend.report.dto;

import java.util.List;

public record ReportPdfView(
        String reportTitle,
        String periodLabel,
        String channelLabel,
        String generatedAt,
        Summary summary,
        String comparisonText,
        String seriesTitle,
        List<SeriesRow> series,
        List<SaleRow> sales,
        List<ProductRow> products,
        List<RankingRow> categories,
        List<RankingRow> payments,
        List<RankingRow> channels,
        CancellationBlock cancellations
) {
    public record Summary(
            String grossRevenue,
            String serviceFees,
            String discounts,
            String netRevenue,
            String receivedAmount,
            String averageTicket,
            long closedTabs,
            long tableSales,
            long counterSales,
            long orders,
            long itemsSold
    ) {
    }

    public record SeriesRow(
            String label,
            long closedTabs,
            long orders,
            long itemsSold,
            String grossRevenue,
            String serviceFees,
            String discounts,
            String netRevenue,
            String receivedAmount,
            String averageTicket
    ) {
    }

    public record SaleRow(
            long id,
            String origin,
            String openedAt,
            String closedAt,
            String duration,
            String responsible,
            long orders,
            long items,
            String grossRevenue,
            String discounts,
            String finalAmount,
            String receivedAmount,
            String paymentMethods
    ) {
    }

    public record ProductRow(
            String productName,
            String categoryName,
            long quantity,
            String salesAmount,
            String revenueShare,
            List<VariantRow> variants
    ) {
    }

    public record VariantRow(String variantName, long quantity, String salesAmount) {
    }

    public record RankingRow(String label, String detail, String value) {
    }

    public record CancellationBlock(
            long cancelledOrders,
            long cancelledItems,
            String cancelledAmount,
            List<ReasonRow> reasons
    ) {
    }

    public record ReasonRow(String reason, long occurrences) {
    }
}
