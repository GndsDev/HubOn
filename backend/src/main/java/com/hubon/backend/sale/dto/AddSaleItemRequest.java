package com.hubon.backend.sale.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record AddSaleItemRequest(
        @NotNull Long productId,
        @NotNull @Min(1) Integer quantity,
        @Size(max = 500) String notes,
        List<Long> optionIds
) {
}
