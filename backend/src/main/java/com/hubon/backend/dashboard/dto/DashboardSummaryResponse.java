package com.hubon.backend.dashboard.dto;

import java.math.BigDecimal;
import java.util.List;

public record DashboardSummaryResponse(
        BigDecimal todaySales,
        long openSales,
        long openTableSales,
        long openCounterSales,
        long pendingPayments,
        BigDecimal averageTicket,
        CashSummary cashSummary,
        List<RecentSale> recentSales
) {
    public record CashSummary(BigDecimal received, BigDecimal openAmount, BigDecimal cancelledAmount) { }
    public record RecentSale(Long id, Integer tableNumber, String originLabel, String status,
                             BigDecimal amount, String createdAt) { }
}
