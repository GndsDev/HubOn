package com.hubon.backend.table.dto;

import com.hubon.backend.table.domain.TableStatus;

import java.time.LocalDateTime;

public record RestaurantTableResponse(
        Long id,
        Integer number,
        String name,
        TableStatus status,
        Boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
