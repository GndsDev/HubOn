package com.hubon.backend.table.dto;

import java.time.LocalDateTime;

public record RestaurantTableResponse(
        Long id,
        Integer number,
        String label,
        RestaurantTableState state,
        Boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
