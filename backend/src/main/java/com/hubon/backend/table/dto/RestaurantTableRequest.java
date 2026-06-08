package com.hubon.backend.table.dto;

import com.hubon.backend.table.domain.TableStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RestaurantTableRequest(
        @NotNull
        @Min(1)
        Integer number,

        @Size(max = 80)
        String name,

        TableStatus status,

        Boolean active
) {
}
