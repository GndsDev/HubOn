package com.hubon.backend.product.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ProductResponse(
        Long id,
        Long categoryId,
        String categoryName,
        Boolean categoryActive,
        String name,
        String description,
        BigDecimal price,
        Boolean active,
        String imageUrl,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
