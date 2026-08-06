package com.hubon.backend.tab.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record OpenTabRequest(
        Long tableId,

        @Positive
        Integer tableNumber,

        Long openedByUserId,

        @DecimalMin(value = "0.00")
        BigDecimal serviceFee,

        @DecimalMin(value = "0.00")
        BigDecimal discountAmount
) {
}
