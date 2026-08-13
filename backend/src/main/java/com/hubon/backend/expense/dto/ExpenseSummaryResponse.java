package com.hubon.backend.expense.dto;

import java.math.BigDecimal;

public record ExpenseSummaryResponse(
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal pendingAmount,
        BigDecimal stockPurchaseAmount,
        long expenseCount
) {
}
