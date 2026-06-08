package com.hubon.backend.payment.dto;

import com.hubon.backend.payment.domain.PaymentMethod;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PaymentResponse(
        Long id,
        Long tabId,
        PaymentMethod method,
        BigDecimal amount,
        LocalDateTime paidAt,
        Long receivedByUserId,
        String receivedByUserName
) {
}
