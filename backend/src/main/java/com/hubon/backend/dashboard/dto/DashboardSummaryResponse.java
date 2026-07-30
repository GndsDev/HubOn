package com.hubon.backend.dashboard.dto;

import java.math.BigDecimal;
import java.util.List;

public record DashboardSummaryResponse(
        BigDecimal todaySales,
        long openTabs,
        long activeCounterSales,
        long ordersInPreparation,
        long readyOrders,
        long pendingPayments,
        BigDecimal averageTicket,
        List<BestSellingProduct> bestSellingProducts,
        TableSummary tableSummary,
        CashSummary cashSummary,
        List<RecentOrder> recentOrders
) {
    public record BestSellingProduct(
            String name,
            String category,
            long quantity,
            BigDecimal revenue
    ) {
    }

    public record TableSummary(
            long available,
            long occupied,
            long reserved,
            long disabled,
            long total
    ) {
    }

    public record CashSummary(
            BigDecimal received,
            BigDecimal openAmount,
            BigDecimal cancelledAmount
    ) {
    }

    public record RecentOrder(
            Long id,
            Integer tableNumber,
            String originLabel,
            String status,
            BigDecimal amount,
            String createdAt
    ) {
    }
}
