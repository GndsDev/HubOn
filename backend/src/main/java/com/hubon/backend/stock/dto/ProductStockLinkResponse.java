package com.hubon.backend.stock.dto;

import com.hubon.backend.stock.domain.UnitOfMeasure;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ProductStockLinkResponse(
        Long id,
        Long variantId,
        String variantName,
        Long productId,
        String productName,
        Long stockItemId,
        String stockItemName,
        UnitOfMeasure unit,
        BigDecimal quantityPerSale,
        Boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
