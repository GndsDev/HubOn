package com.hubon.backend.sale.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record SaleItemResponse(
        Long id,
        Long productId,
        String productName,
        String categoryName,
        BigDecimal baseUnitPrice,
        BigDecimal unitPrice,
        Integer quantity,
        BigDecimal subtotal,
        String notes,
        List<SaleItemOptionResponse> options,
        Long createdByUserId,
        String createdByUserName,
        LocalDateTime createdAt,
        LocalDateTime cancelledAt,
        Long cancelledByUserId,
        String cancelledByUserName,
        String cancellationReason
) {
}
