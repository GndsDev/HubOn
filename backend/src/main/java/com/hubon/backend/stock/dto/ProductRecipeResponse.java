package com.hubon.backend.stock.dto;

import java.util.List;

public record ProductRecipeResponse(
        Long productId,
        String productName,
        List<ProductIngredientResponse> ingredients
) {
}
