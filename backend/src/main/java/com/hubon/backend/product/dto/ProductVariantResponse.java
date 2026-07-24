package com.hubon.backend.product.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ProductVariantResponse(
        Long id,
        Long productId,
        String productName,
        String name,
        String sku,
        BigDecimal price,
        Boolean active,
        Boolean stockLinkActive,
        Long stockLinkId,
        Long stockItemId,
        String stockItemName,
        BigDecimal quantityPerSale,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
