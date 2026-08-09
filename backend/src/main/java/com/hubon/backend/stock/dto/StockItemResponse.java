package com.hubon.backend.stock.dto;

import com.hubon.backend.stock.domain.StockStatus;
import com.hubon.backend.stock.domain.UnitOfMeasure;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record StockItemResponse(
        Long id,
        String name,
        String description,
        UnitOfMeasure unit,
        BigDecimal currentStock,
        BigDecimal minimumStock,
        StockStatus status,
        Boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
