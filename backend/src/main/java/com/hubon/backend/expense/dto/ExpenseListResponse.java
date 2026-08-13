package com.hubon.backend.expense.dto;

import java.util.List;

public record ExpenseListResponse(
        ExpenseSummaryResponse summary,
        List<ExpenseResponse> items
) {
}
