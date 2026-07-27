package com.hubon.backend.order.dto;

import java.math.BigDecimal;

public record OrderItemOptionResponse(
        Long id,
        Long optionId,
        String groupName,
        String optionName,
        BigDecimal additionalPrice
) {
}
