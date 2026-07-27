package com.hubon.backend.product.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ProductOptionRequest(
        @NotBlank
        @Size(max = 120)
        String name,

        @DecimalMin("0.00")
        BigDecimal additionalPrice,

        @Min(0)
        Integer displayOrder,

        Boolean active
) {
}
