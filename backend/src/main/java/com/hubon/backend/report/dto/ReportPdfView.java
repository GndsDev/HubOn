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
        List<ProductRow> products,
        List<RankingRow> categories,
        List<RankingRow> payments,
        String cancellationSummary
) {
    public record Summary(
            String netRevenue,
            String grossRevenue,
            String receivedAmount,
            String discounts,
            long closedTabs,
            long orders,
            long itemsSold,
            String averageTicket
    ) {
    }

    public record SeriesRow(String label, long closedTabs, String netRevenue) {
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
}
