package com.hubon.backend.order.dto;

import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.domain.OrderType;
import com.hubon.backend.tab.domain.TabStatus;

import java.time.LocalDateTime;
import java.util.List;

public record RestaurantOrderResponse(
        Long id,
        Long tabId,
        TabStatus tabStatus,
        Long tableId,
        Integer tableNumber,
        OrderStatus status,
        OrderType type,
        Long createdByUserId,
        String createdByUserName,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<OrderItemResponse> items
) {
}
