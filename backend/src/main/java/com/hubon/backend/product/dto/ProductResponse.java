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
        Boolean available,
        Integer displayOrder,
        String imageUrl,
        Integer variantCount,
        Integer activeVariantCount,
        Integer sellableVariantCount,
        BigDecimal minimumVariantPrice,
        BigDecimal maximumVariantPrice,
        Boolean hasAutomaticStockLink,
        Boolean complete,
        List<ProductVariantResponse> variants,
        List<ProductOptionGroupResponse> optionGroups,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
