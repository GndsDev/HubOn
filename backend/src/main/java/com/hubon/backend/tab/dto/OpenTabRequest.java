package com.hubon.backend.tab.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record OpenTabRequest(
        @NotNull
        Long tableId,

        Long openedByUserId,

        @DecimalMin(value = "0.00")
        BigDecimal serviceFee,

        @DecimalMin(value = "0.00")
        BigDecimal discountAmount
) {
}
