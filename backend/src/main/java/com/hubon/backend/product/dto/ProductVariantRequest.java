package com.hubon.backend.product.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ProductVariantRequest(
        @NotBlank
        @Size(max = 120)
        String name,

        @Size(max = 80)
        String sku,

        @NotNull
        @DecimalMin(value = "0.00")
        BigDecimal price,

        Boolean active
) {
}
