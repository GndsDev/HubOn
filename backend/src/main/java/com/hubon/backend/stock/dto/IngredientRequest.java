package com.hubon.backend.stock.dto;

import com.hubon.backend.stock.domain.StockControlMode;
import com.hubon.backend.stock.domain.UnitOfMeasure;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record IngredientRequest(
        @NotBlank
        @Size(max = 120)
        String name,

        @Size(max = 255)
        String description,

        @NotNull
        UnitOfMeasure unit,

        StockControlMode controlMode,

        @NotNull
        @DecimalMin(value = "0.000")
        BigDecimal minimumStock,

        @NotNull
        @DecimalMin(value = "0.000")
        BigDecimal idealStock,

        Boolean active
) {
}
