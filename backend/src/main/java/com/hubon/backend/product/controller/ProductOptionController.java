package com.hubon.backend.product.controller;

import com.hubon.backend.product.dto.ProductOptionGroupRequest;
import com.hubon.backend.product.dto.ProductOptionGroupResponse;
import com.hubon.backend.product.dto.ProductOptionRequest;
import com.hubon.backend.product.dto.ProductOptionResponse;
import com.hubon.backend.product.service.ProductOptionService;
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
@RequestMapping("/api/products/{productId}/option-groups")
@RequiredArgsConstructor
public class ProductOptionController {

    private final ProductOptionService productOptionService;

    @GetMapping
    public List<ProductOptionGroupResponse> list(@PathVariable Long productId) {
        return productOptionService.listByProduct(productId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductOptionGroupResponse create(
            @PathVariable Long productId,
            @Valid @RequestBody ProductOptionGroupRequest request
    ) {
        return productOptionService.createGroup(productId, request);
    }

    @PutMapping("/{groupId}")
    public ProductOptionGroupResponse update(
            @PathVariable Long productId,
            @PathVariable Long groupId,
            @Valid @RequestBody ProductOptionGroupRequest request
    ) {
        return productOptionService.updateGroup(productId, groupId, request);
    }

    @PatchMapping("/{groupId}/activate")
    public ProductOptionGroupResponse activate(@PathVariable Long productId, @PathVariable Long groupId) {
        return productOptionService.setGroupActive(productId, groupId, true);
    }

    @PatchMapping("/{groupId}/deactivate")
    public ProductOptionGroupResponse deactivate(@PathVariable Long productId, @PathVariable Long groupId) {
        return productOptionService.setGroupActive(productId, groupId, false);
    }

    @PostMapping("/{groupId}/options")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductOptionResponse createOption(
            @PathVariable Long productId,
            @PathVariable Long groupId,
            @Valid @RequestBody ProductOptionRequest request
    ) {
        return productOptionService.createOption(productId, groupId, request);
    }

    @PutMapping("/{groupId}/options/{optionId}")
    public ProductOptionResponse updateOption(
            @PathVariable Long productId,
            @PathVariable Long groupId,
            @PathVariable Long optionId,
            @Valid @RequestBody ProductOptionRequest request
    ) {
        return productOptionService.updateOption(productId, groupId, optionId, request);
    }

    @PatchMapping("/{groupId}/options/{optionId}/activate")
    public ProductOptionResponse activateOption(
            @PathVariable Long productId,
            @PathVariable Long groupId,
            @PathVariable Long optionId
    ) {
        return productOptionService.setOptionActive(productId, groupId, optionId, true);
    }

    @PatchMapping("/{groupId}/options/{optionId}/deactivate")
    public ProductOptionResponse deactivateOption(
            @PathVariable Long productId,
            @PathVariable Long groupId,
            @PathVariable Long optionId
    ) {
        return productOptionService.setOptionActive(productId, groupId, optionId, false);
    }
}
