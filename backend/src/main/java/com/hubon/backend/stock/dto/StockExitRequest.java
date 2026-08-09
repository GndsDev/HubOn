package com.hubon.backend.stock.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record StockExitRequest(
        @NotNull
        Long stockItemId,

        @NotNull
        @DecimalMin(value = "0.000", inclusive = false)
        BigDecimal quantity,

        @Size(max = 500)
        String reason
) {
}
