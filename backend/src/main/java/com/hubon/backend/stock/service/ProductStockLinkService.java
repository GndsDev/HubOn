package com.hubon.backend.stock.service;

import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.domain.ProductVariant;
import com.hubon.backend.product.repository.ProductVariantRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.Ingredient;
import com.hubon.backend.stock.domain.ProductStockLink;
import com.hubon.backend.stock.domain.StockControlMode;
import com.hubon.backend.stock.dto.ProductStockLinkRequest;
import com.hubon.backend.stock.dto.ProductStockLinkResponse;
import com.hubon.backend.stock.repository.IngredientRepository;
import com.hubon.backend.stock.repository.ProductStockLinkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class ProductStockLinkService {

    private final ProductStockLinkRepository linkRepository;
    private final ProductVariantRepository productVariantRepository;
    private final IngredientRepository ingredientRepository;

    @Transactional(readOnly = true)
    public ProductStockLinkResponse getByVariant(Long variantId) {
        return linkRepository.findByProductVariantIdAndActiveTrue(variantId)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Vinculo de estoque nao encontrado"));
    }

    @Transactional
    public ProductStockLinkResponse create(Long variantId, ProductStockLinkRequest request) {
        ProductVariant variant = findVariant(variantId);
        Ingredient stockItem = findStockItem(request.stockItemId());
        ensureVariantCanLink(variant);
        ensureStockItemCanLink(stockItem);
        validateQuantity(request.quantityPerSale());
        if (linkRepository.existsByProductVariantIdAndActiveTrue(variantId)) {
            throw new BusinessException("Variacao ja possui vinculo ativo de estoque");
        }

        ProductStockLink link = ProductStockLink.builder()
                .productVariant(variant)
                .stockItem(stockItem)
                .quantityPerSale(request.quantityPerSale())
                .active(true)
                .build();

        return toResponse(linkRepository.save(link));
    }

    @Transactional
    public ProductStockLinkResponse update(Long variantId, ProductStockLinkRequest request) {
        ProductStockLink link = findActiveLink(variantId);
        ProductVariant variant = findVariant(variantId);
        Ingredient stockItem = findStockItem(request.stockItemId());
        ensureVariantCanLink(variant);
        ensureStockItemCanLink(stockItem);
        validateQuantity(request.quantityPerSale());

        link.setProductVariant(variant);
        link.setStockItem(stockItem);
        link.setQuantityPerSale(request.quantityPerSale());
        link.setActive(true);

        return toResponse(link);
    }

    @Transactional
    public void deactivate(Long variantId) {
        ProductStockLink link = findActiveLink(variantId);
        link.setActive(false);
    }

    private ProductStockLink findActiveLink(Long variantId) {
        return linkRepository.findByProductVariantIdAndActiveTrue(variantId)
                .orElseThrow(() -> new ResourceNotFoundException("Vinculo de estoque nao encontrado"));
    }

    private ProductVariant findVariant(Long variantId) {
        return productVariantRepository.findById(variantId)
                .orElseThrow(() -> new ResourceNotFoundException("Variacao de produto nao encontrada"));
    }

    private Ingredient findStockItem(Long stockItemId) {
        return ingredientRepository.findById(stockItemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item de estoque nao encontrado"));
    }

    private void ensureVariantCanLink(ProductVariant variant) {
        Product product = variant.getProduct();
        if (!Boolean.TRUE.equals(variant.getActive())) {
            throw new BusinessException("Variacao inativa nao pode ser vinculada ao estoque");
        }
        if (!Boolean.TRUE.equals(product.getActive())) {
            throw new BusinessException("Produto inativo nao pode ser vinculado ao estoque");
        }
        if (!Boolean.TRUE.equals(product.getCategory().getActive())) {
            throw new BusinessException("Produto pertence a uma categoria inativa.");
        }
    }

    private void ensureStockItemCanLink(Ingredient stockItem) {
        if (!Boolean.TRUE.equals(stockItem.getActive())) {
            throw new BusinessException("Item de estoque inativo nao pode ser vinculado");
        }
        if (stockItem.getControlMode() != StockControlMode.DIRECT_SALE) {
            throw new BusinessException("Somente itens com baixa automatica podem ser vinculados a produtos");
        }
    }

    private void validateQuantity(BigDecimal quantity) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Quantidade por venda deve ser maior que zero");
        }
    }

    private ProductStockLinkResponse toResponse(ProductStockLink link) {
        ProductVariant variant = link.getProductVariant();
        Product product = variant.getProduct();
        return new ProductStockLinkResponse(
                link.getId(),
                variant.getId(),
                variant.getName(),
                product.getId(),
                product.getName(),
                link.getStockItem().getId(),
                link.getStockItem().getName(),
                link.getStockItem().getUnit(),
                link.getQuantityPerSale(),
                link.getActive(),
                link.getCreatedAt(),
                link.getUpdatedAt()
        );
    }
}
