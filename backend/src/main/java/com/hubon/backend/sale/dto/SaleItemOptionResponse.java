package com.hubon.backend.sale.dto;

import java.math.BigDecimal;

public record SaleItemOptionResponse(
        Long id,
        Long productOptionId,
        String optionGroupName,
        String optionName,
        BigDecimal additionalPrice
) {
}
