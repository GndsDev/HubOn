package com.hubon.backend.product.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ProductOptionGroupResponse(
        Long id,
        Long productId,
        String name,
        Boolean required,
        Integer minimumSelections,
        Integer maximumSelections,
        Integer displayOrder,
        Boolean active,
        List<ProductOptionResponse> options,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
