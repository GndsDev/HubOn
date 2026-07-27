package com.hubon.backend.product.dto;

import com.hubon.backend.product.domain.PreparationFlow;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record ProductRequest(
        @NotNull
        Long categoryId,

        @NotBlank
        @Size(max = 120)
        String name,

        @Size(max = 255)
        String description,

        @NotNull
        PreparationFlow preparationFlow,

        Boolean active,

        Boolean available,

        @Min(0)
        Integer displayOrder,

        @Size(max = 500)
        String imageUrl
) {
}
