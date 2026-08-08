package com.hubon.backend.sale.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record UpdateSaleItemQuantityRequest(
        @NotNull @Min(1) Integer quantity
) {
}
