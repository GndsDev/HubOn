package com.hubon.backend.order.dto;

import com.hubon.backend.order.domain.OrderStatus;
import jakarta.validation.constraints.NotNull;

public record OrderStatusRequest(
        @NotNull
        OrderStatus status
) {
}
