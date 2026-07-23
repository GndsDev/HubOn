package com.hubon.backend.stock.dto;

import com.hubon.backend.stock.domain.StockStatus;
import com.hubon.backend.stock.domain.UnitOfMeasure;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record IngredientResponse(
        Long id,
        String name,
        String description,
        UnitOfMeasure unit,
        BigDecimal currentStock,
        BigDecimal minimumStock,
        BigDecimal idealStock,
        Boolean active,
        StockStatus stockStatus,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
