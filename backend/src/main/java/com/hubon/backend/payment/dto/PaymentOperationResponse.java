package com.hubon.backend.payment.dto;

import com.hubon.backend.order.dto.RestaurantOrderResponse;

import java.math.BigDecimal;
import java.util.List;

public record PaymentOperationResponse(
        PaymentResponse payment,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        PaymentFinancialState financialState,
        List<RestaurantOrderResponse> orders,
        PaymentNextAction nextAction
) {
}
