package com.hubon.backend.stock.controller;

import com.hubon.backend.stock.dto.ProductOptionStockLinkRequest;
import com.hubon.backend.stock.dto.ProductOptionStockLinkResponse;
import com.hubon.backend.stock.service.ProductOptionStockLinkService;
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
@RequestMapping("/api/products/{productId}/option-groups/{groupId}/options/{optionId}/stock-link")
@RequiredArgsConstructor
public class ProductOptionStockLinkController {
    private final ProductOptionStockLinkService service;

    @GetMapping
    public ProductOptionStockLinkResponse get(
            @PathVariable Long productId,
            @PathVariable Long groupId,
            @PathVariable Long optionId
    ) {
        return service.get(productId, groupId, optionId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductOptionStockLinkResponse create(
            @PathVariable Long productId,
            @PathVariable Long groupId,
            @PathVariable Long optionId,
            @Valid @RequestBody ProductOptionStockLinkRequest request
    ) {
        return service.create(productId, groupId, optionId, request);
    }

    @PutMapping
    public ProductOptionStockLinkResponse update(
            @PathVariable Long productId,
            @PathVariable Long groupId,
            @PathVariable Long optionId,
            @Valid @RequestBody ProductOptionStockLinkRequest request
    ) {
        return service.update(productId, groupId, optionId, request);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(
            @PathVariable Long productId,
            @PathVariable Long groupId,
            @PathVariable Long optionId
    ) {
        service.deactivate(productId, groupId, optionId);
    }
}
