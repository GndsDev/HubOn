package com.hubon.backend.sale.dto;

import com.hubon.backend.payment.dto.PaymentResponse;
import com.hubon.backend.sale.domain.SaleStatus;
import com.hubon.backend.sale.domain.SaleType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record SaleResponse(
        Long id,
        SaleType type,
        SaleStatus status,
        Long restaurantTableId,
        Integer tableNumber,
        String tableLabel,
        String customerName,
        String customerPhone,
        BigDecimal subtotal,
        BigDecimal serviceFee,
        BigDecimal discountAmount,
        BigDecimal finalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        List<SaleItemResponse> items,
        List<PaymentResponse> payments,
        Long openedByUserId,
        String openedByUserName,
        LocalDateTime openedAt,
        Long closedByUserId,
        String closedByUserName,
        LocalDateTime closedAt,
        LocalDate closedBusinessDate,
        Long cancelledByUserId,
        String cancelledByUserName,
        LocalDateTime cancelledAt,
        String cancellationReason
) {
}
