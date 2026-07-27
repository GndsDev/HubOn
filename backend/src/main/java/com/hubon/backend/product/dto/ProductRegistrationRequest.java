package com.hubon.backend.product.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ProductRegistrationRequest(
        @NotNull
        @Valid
        ProductRequest product,

        @NotEmpty
        List<@Valid ProductVariantRegistrationRequest> variants,

        List<@Valid ProductOptionGroupRequest> optionGroups
) {
}
