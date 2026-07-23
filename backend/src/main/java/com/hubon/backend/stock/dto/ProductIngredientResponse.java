package com.hubon.backend.stock.dto;

import com.hubon.backend.stock.domain.UnitOfMeasure;

import java.math.BigDecimal;

public record ProductIngredientResponse(
        Long id,
        Long ingredientId,
        String ingredientName,
        UnitOfMeasure unit,
        BigDecimal quantity
) {
}
