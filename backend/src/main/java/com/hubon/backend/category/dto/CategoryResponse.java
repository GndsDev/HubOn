package com.hubon.backend.category.dto;

import java.time.LocalDateTime;

public record CategoryResponse(
        Long id,
        String name,
        Boolean active,
        Integer displayOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
