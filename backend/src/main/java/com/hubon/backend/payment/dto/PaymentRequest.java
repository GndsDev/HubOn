package com.hubon.backend.payment.dto;

import com.hubon.backend.payment.domain.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record PaymentRequest(
        @NotNull PaymentMethod method,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        Long receivedByUserId
) {
}
