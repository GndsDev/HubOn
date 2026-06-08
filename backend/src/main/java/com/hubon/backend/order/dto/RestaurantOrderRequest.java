package com.hubon.backend.order.dto;

import com.hubon.backend.order.domain.OrderType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record RestaurantOrderRequest(
        @NotNull
        Long tabId,

        @NotNull
        Long createdByUserId,

        OrderType type,

        @Size(max = 500)
        String notes,

        @NotEmpty
        List<@Valid OrderItemRequest> items
) {
}
