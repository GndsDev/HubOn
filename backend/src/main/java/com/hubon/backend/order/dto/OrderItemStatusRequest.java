package com.hubon.backend.order.dto;

import com.hubon.backend.order.domain.OrderItemStatus;
import jakarta.validation.constraints.NotNull;

public record OrderItemStatusRequest(
        @NotNull
        OrderItemStatus status
) {
}
