package com.hubon.backend.product.dto;

import com.hubon.backend.stock.dto.ProductOptionStockLinkResponse;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ProductOptionResponse(
        Long id,
        Long groupId,
        String name,
        BigDecimal additionalPrice,
        Integer displayOrder,
        Boolean active,
        ProductOptionStockLinkResponse stockLink,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
