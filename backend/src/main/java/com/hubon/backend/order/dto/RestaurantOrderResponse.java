package com.hubon.backend.order.dto;

import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.domain.OrderType;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.domain.TabType;

import java.time.LocalDateTime;
import java.util.List;

public record RestaurantOrderResponse(
        Long id,
        Long tabId,
        TabStatus tabStatus,
        TabType tabType,
        String tabDisplayLabel,
        Long tableId,
        Integer tableNumber,
        OrderStatus status,
        OrderType type,
        Long createdByUserId,
        String createdByUserName,
        String notes,
        LocalDateTime confirmedAt,
        String cancellationReason,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<OrderItemResponse> items
) {
}
