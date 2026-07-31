package com.hubon.backend.cash.dto;

import com.hubon.backend.payment.domain.PaymentMethod;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CashMovementResponse(
        String id,
        String type,
        String origin,
        BigDecimal amount,
        PaymentMethod method,
        String responsible,
        String reference,
        String observation,
        LocalDateTime occurredAt
) {
}
