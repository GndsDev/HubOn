package com.hubon.backend.tab.dto;

import com.hubon.backend.tab.domain.TabStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record TabResponse(
        Long id,
        Long tableId,
        Integer tableNumber,
        String tableName,
        TabStatus status,
        Long openedByUserId,
        String openedByUserName,
        LocalDateTime openedAt,
        LocalDateTime closedAt,
        BigDecimal totalAmount,
        BigDecimal serviceFee,
        BigDecimal discountAmount,
        BigDecimal finalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount
) {
}
