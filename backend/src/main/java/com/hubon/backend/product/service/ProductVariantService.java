package com.hubon.backend.product.service;

import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.domain.ProductVariant;
import com.hubon.backend.product.dto.ProductVariantRequest;
import com.hubon.backend.product.dto.ProductVariantResponse;
import com.hubon.backend.product.repository.ProductRepository;
import com.hubon.backend.product.repository.ProductVariantRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.ProductStockLink;
import com.hubon.backend.stock.repository.ProductStockLinkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductVariantService {

    private final ProductVariantRepository variantRepository;
    private final ProductRepository productRepository;
    private final ProductStockLinkRepository productStockLinkRepository;

    @Transactional(readOnly = true)
    public List<ProductVariantResponse> listByProduct(Long productId) {
        ensureProductExists(productId);
        List<ProductVariant> variants = variantRepository.findAllByProductIdOrderByNameAsc(productId);
        Map<Long, ProductStockLink> linksByVariantId = linksByVariantId(variants);
        return variants.stream()
                .map(variant -> toResponse(variant, linksByVariantId.get(variant.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductVariantResponse getByProduct(Long productId, Long variantId) {
        ProductVariant variant = findByProduct(productId, variantId);
        ProductStockLink link = productStockLinkRepository.findByProductVariantIdAndActiveTrue(variant.getId()).orElse(null);
        return toResponse(variant, link);
    }

    @Transactional
    public ProductVariantResponse create(Long productId, ProductVariantRequest request) {
        Product product = findProduct(productId);
        String name = normalizeName(request.name());
        validatePrice(request.price());
        validateUniqueName(productId, name, null);

        ProductVariant variant = ProductVariant.builder()
                .product(product)
                .name(name)
                .sku(normalizeOptional(request.sku()))
                .price(request.price())
                .active(request.active())
                .build();

        return toResponse(variantRepository.save(variant), null);
    }

    @Transactional
    public ProductVariantResponse update(Long productId, Long variantId, ProductVariantRequest request) {
        ProductVariant variant = findByProduct(productId, variantId);
        String name = normalizeName(request.name());
        validatePrice(request.price());
        validateUniqueName(productId, name, variantId);

        variant.setName(name);
        variant.setSku(normalizeOptional(request.sku()));
        variant.setPrice(request.price());
        variant.setActive(request.active() == null ? variant.getActive() : request.active());

        ProductStockLink link = productStockLinkRepository.findByProductVariantIdAndActiveTrue(variant.getId()).orElse(null);
        return toResponse(variant, link);
    }

    @Transactional
    public ProductVariantResponse activate(Long productId, Long variantId) {
        ProductVariant variant = findByProduct(productId, variantId);
        variant.setActive(true);
        ProductStockLink link = productStockLinkRepository.findByProductVariantIdAndActiveTrue(variant.getId()).orElse(null);
        return toResponse(variant, link);
    }

    @Transactional
    public ProductVariantResponse deactivate(Long productId, Long variantId) {
        ProductVariant variant = findByProduct(productId, variantId);
        variant.setActive(false);
        ProductStockLink link = productStockLinkRepository.findByProductVariantIdAndActiveTrue(variant.getId()).orElse(null);
        return toResponse(variant, link);
    }

    @Transactional(readOnly = true)
    public ProductVariant findSellableVariant(Long productId, Long variantId) {
        ProductVariant variant = resolveRequestedVariant(productId, variantId);
        Product product = variant.getProduct();

        if (!Boolean.TRUE.equals(product.getActive())) {
            throw new BusinessException("Produto inativo nao pode ser vendido");
        }
        if (!Boolean.TRUE.equals(product.getCategory().getActive())) {
            throw new BusinessException("Produto pertence a uma categoria inativa.");
        }
        if (!Boolean.TRUE.equals(variant.getActive())) {
            throw new BusinessException("Variacao inativa nao pode ser vendida");
        }
        return variant;
    }

    @Transactional(readOnly = true)
    public ProductVariant findEntityById(Long variantId) {
        return variantRepository.findById(variantId)
                .orElseThrow(() -> new ResourceNotFoundException("Variacao de produto nao encontrada"));
    }

    private ProductVariant resolveRequestedVariant(Long productId, Long variantId) {
        if (variantId != null) {
            ProductVariant variant = findEntityById(variantId);
            if (productId != null && !variant.getProduct().getId().equals(productId)) {
                throw new BusinessException("Variacao nao pertence ao produto informado");
            }
            return variant;
        }

        if (productId == null) {
            throw new BusinessException("Produto ou variacao e obrigatorio");
        }

        List<ProductVariant> activeVariants = variantRepository.findAllByProductIdAndActiveTrueOrderByNameAsc(productId);
        if (activeVariants.isEmpty()) {
            throw new BusinessException("Produto precisa de pelo menos uma variacao ativa para ser vendido");
        }
        if (activeVariants.size() > 1) {
            throw new BusinessException("Escolha a variacao do produto");
        }
        return activeVariants.get(0);
    }

    private ProductVariant findByProduct(Long productId, Long variantId) {
        return variantRepository.findByIdAndProductId(variantId, productId)
                .orElseThrow(() -> new ResourceNotFoundException("Variacao de produto nao encontrada"));
    }

    private Product findProduct(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Produto nao encontrado"));
    }

    private void ensureProductExists(Long productId) {
        if (!productRepository.existsById(productId)) {
            throw new ResourceNotFoundException("Produto nao encontrado");
        }
    }

    private void validateUniqueName(Long productId, String name, Long currentVariantId) {
        boolean exists = currentVariantId == null
                ? variantRepository.existsByProductIdAndNameIgnoreCase(productId, name)
                : variantRepository.existsByProductIdAndNameIgnoreCaseAndIdNot(productId, name, currentVariantId);
        if (exists) {
            throw new BusinessException("Ja existe uma variacao com este nome para o produto");
        }
    }

    private void validatePrice(BigDecimal price) {
        if (price == null || price.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("Preco da variacao nao pode ser negativo");
        }
    }

    private Map<Long, ProductStockLink> linksByVariantId(List<ProductVariant> variants) {
        if (variants.isEmpty()) {
            return Map.of();
        }
        return productStockLinkRepository
                .findAllByProductVariantIdInAndActiveTrue(variants.stream().map(ProductVariant::getId).toList())
                .stream()
                .collect(Collectors.toMap(link -> link.getProductVariant().getId(), link -> link));
    }

    private ProductVariantResponse toResponse(ProductVariant variant, ProductStockLink stockLink) {
        return new ProductVariantResponse(
                variant.getId(),
                variant.getProduct().getId(),
                variant.getProduct().getName(),
                variant.getName(),
                variant.getSku(),
                variant.getPrice(),
                variant.getActive(),
                stockLink != null && Boolean.TRUE.equals(stockLink.getActive()),
                stockLink == null ? null : stockLink.getId(),
                stockLink == null ? null : stockLink.getStockItem().getId(),
                stockLink == null ? null : stockLink.getStockItem().getName(),
                stockLink == null ? null : stockLink.getQuantityPerSale(),
                variant.getCreatedAt(),
                variant.getUpdatedAt()
        );
    }

    private String normalizeName(String name) {
        return name == null ? "" : name.trim();
    }

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
