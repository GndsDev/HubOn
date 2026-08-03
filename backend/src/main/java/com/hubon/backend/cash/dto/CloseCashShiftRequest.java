package com.hubon.backend.cash.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CloseCashShiftRequest(
        @NotNull @DecimalMin(value = "0.00") BigDecimal countedCash,
        @Size(max = 500) String note
) {
}
