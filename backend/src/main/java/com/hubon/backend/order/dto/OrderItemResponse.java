package com.hubon.backend.order.dto;

import com.hubon.backend.order.domain.OrderItemStatus;

import java.math.BigDecimal;

public record OrderItemResponse(
        Long id,
        Long productId,
        String productNameSnapshot,
        BigDecimal unitPriceSnapshot,
        Integer quantity,
        String notes,
        OrderItemStatus status,
        BigDecimal subtotal
) {
}
