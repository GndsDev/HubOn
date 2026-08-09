package com.hubon.backend.product.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ProductResponse(
        Long id,
        Long categoryId,
        String categoryName,
        String name,
        String description,
        BigDecimal price,
        Boolean active,
        Boolean available,
        Integer displayOrder,
        List<ProductOptionGroupResponse> optionGroups,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
