package com.hubon.backend.payment.dto;

import java.math.BigDecimal;
import java.util.List;

public record PaymentSummaryResponse(
        Long tabId,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        List<PaymentResponse> payments
) {
}
