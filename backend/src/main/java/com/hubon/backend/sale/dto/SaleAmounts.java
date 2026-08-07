package com.hubon.backend.sale.dto;

import java.math.BigDecimal;

public record SaleAmounts(
        BigDecimal subtotal,
        BigDecimal finalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount
) {
}
