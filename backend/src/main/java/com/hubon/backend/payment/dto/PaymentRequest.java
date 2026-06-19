package com.hubon.backend.payment.dto;

import com.hubon.backend.payment.domain.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record PaymentRequest(
        @NotNull
        Long tabId,

        @NotNull
        PaymentMethod method,

        @NotNull
        @DecimalMin(value = "0.01")
        BigDecimal amount,

        Long receivedByUserId
) {
}
