package com.hubon.backend.stock.controller;

import com.hubon.backend.stock.dto.ProductStockLinkRequest;
import com.hubon.backend.stock.dto.ProductStockLinkResponse;
import com.hubon.backend.stock.service.ProductStockLinkService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products/{productId}/stock-link")
@RequiredArgsConstructor
public class ProductStockLinkController {
    private final ProductStockLinkService service;
    @GetMapping public ProductStockLinkResponse get(@PathVariable Long productId) { return service.getByProduct(productId); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public ProductStockLinkResponse create(@PathVariable Long productId, @Valid @RequestBody ProductStockLinkRequest request) { return service.create(productId, request); }
    @PutMapping public ProductStockLinkResponse update(@PathVariable Long productId, @Valid @RequestBody ProductStockLinkRequest request) { return service.update(productId, request); }
    @DeleteMapping @ResponseStatus(HttpStatus.NO_CONTENT) public void deactivate(@PathVariable Long productId) { service.deactivate(productId); }
}
