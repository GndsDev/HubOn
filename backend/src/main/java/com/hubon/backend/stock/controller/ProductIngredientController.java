package com.hubon.backend.stock.controller;

import com.hubon.backend.stock.dto.ProductIngredientRequest;
import com.hubon.backend.stock.dto.ProductIngredientResponse;
import com.hubon.backend.stock.dto.ProductRecipeResponse;
import com.hubon.backend.stock.service.ProductIngredientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/products/{productId}/ingredients")
@RequiredArgsConstructor
public class ProductIngredientController {

    private final ProductIngredientService productIngredientService;

    @GetMapping
    public ProductRecipeResponse getRecipeByProduct(@PathVariable Long productId) {
        return productIngredientService.getRecipeByProduct(productId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductIngredientResponse addIngredient(
            @PathVariable Long productId,
            @Valid @RequestBody ProductIngredientRequest request
    ) {
        return productIngredientService.addIngredient(productId, request);
    }

    @PutMapping("/{ingredientId}")
    public ProductIngredientResponse updateIngredientQuantity(
            @PathVariable Long productId,
            @PathVariable Long ingredientId,
            @Valid @RequestBody ProductIngredientRequest request
    ) {
        return productIngredientService.updateIngredientQuantity(productId, ingredientId, request);
    }

    @DeleteMapping("/{ingredientId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeIngredient(
            @PathVariable Long productId,
            @PathVariable Long ingredientId
    ) {
        productIngredientService.removeIngredient(productId, ingredientId);
    }

    @PutMapping
    public ProductRecipeResponse replaceRecipe(
            @PathVariable Long productId,
            @RequestBody List<@Valid ProductIngredientRequest> requests
    ) {
        return productIngredientService.replaceRecipe(productId, requests);
    }
}
