package com.hubon.backend.stock.dto;

import com.hubon.backend.stock.domain.InventoryMovementType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record InventoryMovementResponse(
        Long id,
        Long ingredientId,
        String ingredientName,
        InventoryMovementType type,
        BigDecimal quantity,
        BigDecimal previousStock,
        BigDecimal resultingStock,
        String reason,
        Long userId,
        String userName,
        LocalDateTime createdAt
) {
}
