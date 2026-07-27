package com.hubon.backend.product.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ProductOptionGroupRequest(
        @NotBlank
        @Size(max = 120)
        String name,

        Boolean required,

        @NotNull
        @Min(0)
        Integer minimumSelections,

        @NotNull
        @Min(1)
        Integer maximumSelections,

        @Min(0)
        Integer displayOrder,

        Boolean active,

        List<@Valid ProductOptionRequest> options
) {
}
