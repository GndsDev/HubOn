package com.hubon.backend.tab.dto;

import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.domain.TabType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record TabResponse(
        Long id,
        TabType type,
        Long tableId,
        Integer tableNumber,
        String tableName,
        String customerName,
        String customerPhone,
        String identificationNote,
        String displayLabel,
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
