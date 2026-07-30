package com.hubon.backend.tab.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record OpenCounterTabRequest(
        @Size(max = 120)
        String customerName,

        @Size(max = 30)
        String customerPhone,

        @Size(max = 160)
        String identificationNote,

        @DecimalMin(value = "0.00")
        BigDecimal serviceFee,

        @DecimalMin(value = "0.00")
        BigDecimal discountAmount
) {
}
