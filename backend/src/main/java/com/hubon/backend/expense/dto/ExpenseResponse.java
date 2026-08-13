package com.hubon.backend.expense.dto;

import com.hubon.backend.expense.domain.*;
import com.hubon.backend.stock.domain.UnitOfMeasure;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record ExpenseResponse(
        Long id,
        LocalDate expenseDate,
        String description,
        ExpenseCategory category,
        String supplier,
        ExpenseValueMode valueMode,
        BigDecimal quantity,
        UnitOfMeasure unit,
        BigDecimal unitPrice,
        BigDecimal totalAmount,
        ExpensePaymentMethod paymentMethod,
        ExpenseStatus status,
        Long stockItemId,
        String stockItemName,
        UnitOfMeasure stockItemUnit,
        BigDecimal stockQuantity,
        Long stockMovementId,
        Long createdByUserId,
        String createdByUserName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
