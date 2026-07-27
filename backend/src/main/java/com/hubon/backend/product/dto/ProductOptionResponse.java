package com.hubon.backend.product.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ProductOptionResponse(
        Long id,
        Long groupId,
        String name,
        BigDecimal additionalPrice,
        Integer displayOrder,
        Boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
