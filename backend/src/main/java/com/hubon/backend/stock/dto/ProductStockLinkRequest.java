package com.hubon.backend.stock.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ProductStockLinkRequest(
        @NotNull
        Long stockItemId,

        @NotNull
        @DecimalMin(value = "0.000", inclusive = false)
        BigDecimal quantityPerSale
) {
}
