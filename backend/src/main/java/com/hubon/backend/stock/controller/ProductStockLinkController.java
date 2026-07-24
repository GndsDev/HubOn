package com.hubon.backend.stock.controller;

import com.hubon.backend.stock.dto.ProductStockLinkRequest;
import com.hubon.backend.stock.dto.ProductStockLinkResponse;
import com.hubon.backend.stock.service.ProductStockLinkService;
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

@RestController
@RequestMapping("/api/product-variants/{variantId}/stock-link")
@RequiredArgsConstructor
public class ProductStockLinkController {

    private final ProductStockLinkService productStockLinkService;

    @GetMapping
    public ProductStockLinkResponse getByVariant(@PathVariable Long variantId) {
        return productStockLinkService.getByVariant(variantId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductStockLinkResponse create(
            @PathVariable Long variantId,
            @Valid @RequestBody ProductStockLinkRequest request
    ) {
        return productStockLinkService.create(variantId, request);
    }

    @PutMapping
    public ProductStockLinkResponse update(
            @PathVariable Long variantId,
            @Valid @RequestBody ProductStockLinkRequest request
    ) {
        return productStockLinkService.update(variantId, request);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable Long variantId) {
        productStockLinkService.deactivate(variantId);
    }
}
