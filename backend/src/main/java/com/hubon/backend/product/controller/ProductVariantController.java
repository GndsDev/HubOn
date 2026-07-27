package com.hubon.backend.product.controller;

import com.hubon.backend.product.dto.ProductVariantRequest;
import com.hubon.backend.product.dto.ProductVariantResponse;
import com.hubon.backend.product.service.ProductVariantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/products/{productId}/variants")
@RequiredArgsConstructor
public class ProductVariantController {

    private final ProductVariantService productVariantService;

    @GetMapping
    public List<ProductVariantResponse> listByProduct(@PathVariable Long productId) {
        return productVariantService.listByProduct(productId);
    }

    @GetMapping("/{variantId}")
    public ProductVariantResponse getByProduct(@PathVariable Long productId, @PathVariable Long variantId) {
        return productVariantService.getByProduct(productId, variantId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductVariantResponse create(
            @PathVariable Long productId,
            @Valid @RequestBody ProductVariantRequest request
    ) {
        return productVariantService.create(productId, request);
    }

    @PutMapping("/{variantId}")
    public ProductVariantResponse update(
            @PathVariable Long productId,
            @PathVariable Long variantId,
            @Valid @RequestBody ProductVariantRequest request
    ) {
        return productVariantService.update(productId, variantId, request);
    }

    @PatchMapping("/{variantId}/activate")
    public ProductVariantResponse activate(@PathVariable Long productId, @PathVariable Long variantId) {
        return productVariantService.activate(productId, variantId);
    }

    @PatchMapping("/{variantId}/deactivate")
    public ProductVariantResponse deactivate(@PathVariable Long productId, @PathVariable Long variantId) {
        return productVariantService.deactivate(productId, variantId);
    }

    @PatchMapping("/{variantId}/available")
    public ProductVariantResponse makeAvailable(@PathVariable Long productId, @PathVariable Long variantId) {
        return productVariantService.setAvailable(productId, variantId, true);
    }

    @PatchMapping("/{variantId}/unavailable")
    public ProductVariantResponse makeUnavailable(@PathVariable Long productId, @PathVariable Long variantId) {
        return productVariantService.setAvailable(productId, variantId, false);
    }
}
