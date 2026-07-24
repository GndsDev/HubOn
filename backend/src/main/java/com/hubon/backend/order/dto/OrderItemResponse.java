package com.hubon.backend.order.dto;

import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.product.domain.PreparationFlow;

import java.math.BigDecimal;

public record OrderItemResponse(
        Long id,
        Long productId,
        Long variantId,
        String productNameSnapshot,
        String variantNameSnapshot,
        String displayNameSnapshot,
        PreparationFlow preparationFlow,
        BigDecimal unitPriceSnapshot,
        Integer quantity,
        String notes,
        OrderItemStatus status,
        BigDecimal subtotal
) {
}
