package com.hubon.backend.product.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ProductVariantRegistrationRequest(
        @NotNull
        @Valid
        ProductVariantRequest variant,

        Long stockItemId,

        BigDecimal quantityPerSale
) {
}
