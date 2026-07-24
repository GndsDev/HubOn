package com.hubon.backend.product.dto;

import com.hubon.backend.product.domain.PreparationFlow;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ProductResponse(
        Long id,
        Long categoryId,
        String categoryName,
        Boolean categoryActive,
        String name,
        String description,
        PreparationFlow preparationFlow,
        Boolean active,
        String imageUrl,
        Integer activeVariantCount,
        BigDecimal minimumVariantPrice,
        Boolean hasAutomaticStockLink,
        List<ProductVariantResponse> variants,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
