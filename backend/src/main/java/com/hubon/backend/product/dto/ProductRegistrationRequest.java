package com.hubon.backend.product.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ProductRegistrationRequest(
        @NotNull
        @Valid
        ProductRequest product,
        List<@Valid ProductOptionGroupRequest> optionGroups
) {
}
