package com.hubon.backend.stock.dto;

import com.hubon.backend.stock.domain.UnitOfMeasure;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record StockItemRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 255) String description,
        @NotNull UnitOfMeasure unit,
        @NotNull @DecimalMin("0.000") BigDecimal currentStock,
        @NotNull @DecimalMin("0.000") BigDecimal minimumStock,
        Boolean active
) {
}
