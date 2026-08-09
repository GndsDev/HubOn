package com.hubon.backend.stock.dto;

import com.hubon.backend.stock.domain.UnitOfMeasure;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ProductOptionStockLinkResponse(
        Long id,
        Long productOptionId,
        Long stockItemId,
        String stockItemName,
        UnitOfMeasure unit,
        BigDecimal quantityPerSelection,
        Boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
