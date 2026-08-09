package com.hubon.backend.sale.dto;

import com.hubon.backend.sale.domain.SaleType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record OpenSaleRequest(
        @NotNull SaleType type,
        Integer tableNumber,
        @Size(max = 120) String customerName,
        @Size(max = 30) String customerPhone,
        @DecimalMin("0.00") BigDecimal serviceFee,
        @DecimalMin("0.00") BigDecimal discountAmount
) {
}
