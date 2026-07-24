package com.hubon.backend.product.dto;

import com.hubon.backend.product.domain.PreparationFlow;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ProductRequest(
        @NotNull
        Long categoryId,

        @NotBlank
        @Size(max = 120)
        String name,

        @Size(max = 255)
        String description,

        PreparationFlow preparationFlow,

        Boolean active,

        @Size(max = 500)
        String imageUrl
) {
}
