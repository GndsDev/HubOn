package com.hubon.backend.stock.dto;

import com.hubon.backend.stock.domain.StockMovementType;
import com.hubon.backend.stock.domain.UnitOfMeasure;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record StockMovementResponse(
        Long id,
        Long stockItemId,
        String stockItemName,
        UnitOfMeasure unit,
        StockMovementType type,
        BigDecimal deltaQuantity,
        BigDecimal previousBalance,
        BigDecimal resultingBalance,
        Long saleItemId,
        Long reversedMovementId,
        String reason,
        Long createdByUserId,
        String createdByUserName,
        LocalDateTime createdAt
) {
}
