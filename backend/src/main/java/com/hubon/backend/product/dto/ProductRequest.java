package com.hubon.backend.product.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record ProductRequest(
        Long categoryId,

        @NotBlank
        @Size(max = 120)
        String name,

        @Size(max = 255)
        String description,

        @NotNull
        @DecimalMin("0.00")
        java.math.BigDecimal price,

        Boolean active,

        Boolean available,

        @Min(0)
        Integer displayOrder
) {
}
