package com.hubon.backend.cash.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record OpenCashShiftRequest(
        @NotNull @DecimalMin(value = "0.00") BigDecimal openingBalance
) {
}
