package com.hubon.backend.expense.dto;

import com.hubon.backend.expense.domain.*;
import com.hubon.backend.stock.domain.UnitOfMeasure;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseRequest(
        @NotNull LocalDate expenseDate,
        @NotBlank @Size(max = 200) String description,
        @NotNull ExpenseCategory category,
        @Size(max = 160) String supplier,
        @NotNull ExpenseValueMode valueMode,
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 3) BigDecimal quantity,
        UnitOfMeasure unit,
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 2) BigDecimal unitPrice,
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 2) BigDecimal totalAmount,
        @NotNull ExpensePaymentMethod paymentMethod,
        @NotNull ExpenseStatus status,
        Boolean generateStockEntry,
        Long stockItemId,
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 3) BigDecimal stockQuantity
) {
}
