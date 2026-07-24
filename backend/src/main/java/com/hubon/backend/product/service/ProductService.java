package com.hubon.backend.product.service;

import com.hubon.backend.category.domain.Category;
import com.hubon.backend.category.repository.CategoryRepository;
import com.hubon.backend.product.domain.PreparationFlow;
import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.domain.ProductVariant;
import com.hubon.backend.product.dto.ProductRequest;
import com.hubon.backend.product.dto.ProductResponse;
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
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final CategoryRepository categoryRepository;
    private final ProductStockLinkRepository productStockLinkRepository;

    @Transactional(readOnly = true)
    public List<ProductResponse> listAll() {
        List<Product> products = productRepository.findAllByOrderByNameAsc();
        if (products.isEmpty()) {
            return List.of();
        }

        Map<Long, List<ProductVariant>> variantsByProductId = productVariantRepository
                .findAllByProductIdInOrderByNameAsc(products.stream().map(Product::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(variant -> variant.getProduct().getId()));

        List<Long> variantIds = variantsByProductId.values()
                .stream()
                .flatMap(List::stream)
                .map(ProductVariant::getId)
                .toList();
        Map<Long, ProductStockLink> linksByVariantId = variantIds.isEmpty()
                ? Map.of()
                : productStockLinkRepository
                        .findAllByProductVariantIdInAndActiveTrue(variantIds)
                        .stream()
                        .collect(Collectors.toMap(link -> link.getProductVariant().getId(), link -> link));

        return products.stream()
                .map(product -> toResponse(
                        product,
                        variantsByProductId.getOrDefault(product.getId(), List.of()),
                        linksByVariantId
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse getById(Long id) {
        Product product = findEntityById(id);
        List<ProductVariant> variants = productVariantRepository.findAllByProductIdOrderByNameAsc(product.getId());
        Map<Long, ProductStockLink> linksByVariantId = variants.isEmpty()
                ? Map.of()
                : productStockLinkRepository
                        .findAllByProductVariantIdInAndActiveTrue(variants.stream().map(ProductVariant::getId).toList())
                        .stream()
                        .collect(Collectors.toMap(link -> link.getProductVariant().getId(), link -> link));
        return toResponse(product, variants, linksByVariantId);
    }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        Category category = findCategory(request.categoryId());
        String name = normalizeName(request.name());
        validateUniqueName(category.getId(), name, null);

        Product product = Product.builder()
                .category(category)
                .name(name)
                .description(request.description())
                .preparationFlow(resolvePreparationFlow(request.preparationFlow()))
                .active(request.active())
                .imageUrl(request.imageUrl())
                .build();

        return toResponse(productRepository.save(product), List.of(), Map.of());
    }

    @Transactional
    public ProductResponse update(Long id, ProductRequest request) {
        Product product = findEntityById(id);
        Category category = findCategory(request.categoryId());
        String name = normalizeName(request.name());
        validateUniqueName(category.getId(), name, id);

        product.setCategory(category);
        product.setName(name);
        product.setDescription(request.description());
        product.setPreparationFlow(resolvePreparationFlow(request.preparationFlow()));
        product.setActive(request.active() == null ? product.getActive() : request.active());
        product.setImageUrl(request.imageUrl());

        return getById(product.getId());
    }

    @Transactional
    public ProductResponse activate(Long id) {
        Product product = findEntityById(id);
        product.setActive(true);
        return getById(product.getId());
    }

    @Transactional
    public ProductResponse deactivate(Long id) {
        Product product = findEntityById(id);
        product.setActive(false);
        return getById(product.getId());
    }

    @Transactional(readOnly = true)
    public Product findEntityById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Produto nao encontrado"));
    }

    private Category findCategory(Long categoryId) {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria nao encontrada"));
    }

    private void validateUniqueName(Long categoryId, String name, Long currentProductId) {
        boolean exists = currentProductId == null
                ? productRepository.existsByCategoryIdAndNameIgnoreCase(categoryId, name)
                : productRepository.existsByCategoryIdAndNameIgnoreCaseAndIdNot(categoryId, name, currentProductId);
        if (exists) {
            throw new BusinessException("Ja existe um produto com este nome nesta categoria");
        }
    }

    private ProductResponse toResponse(
            Product product,
            List<ProductVariant> variants,
            Map<Long, ProductStockLink> linksByVariantId
    ) {
        List<ProductVariantResponse> variantResponses = variants.stream()
                .sorted(Comparator.comparing(ProductVariant::getName, String.CASE_INSENSITIVE_ORDER))
                .map(variant -> toVariantResponse(variant, linksByVariantId.get(variant.getId())))
                .toList();

        Integer activeVariantCount = (int) variants.stream()
                .filter(variant -> Boolean.TRUE.equals(variant.getActive()))
                .count();
        BigDecimal minimumVariantPrice = variants.stream()
                .filter(variant -> Boolean.TRUE.equals(variant.getActive()))
                .map(ProductVariant::getPrice)
                .min(BigDecimal::compareTo)
                .orElse(null);
        Boolean hasAutomaticStockLink = variants.stream()
                .map(variant -> linksByVariantId.get(variant.getId()))
                .anyMatch(link -> link != null && Boolean.TRUE.equals(link.getActive()));

        return new ProductResponse(
                product.getId(),
                product.getCategory().getId(),
                product.getCategory().getName(),
                product.getCategory().getActive(),
                product.getName(),
                product.getDescription(),
                product.getPreparationFlow(),
                product.getActive(),
                product.getImageUrl(),
                activeVariantCount,
                minimumVariantPrice,
                hasAutomaticStockLink,
                variantResponses,
                product.getCreatedAt(),
                product.getUpdatedAt()
        );
    }

    private ProductVariantResponse toVariantResponse(ProductVariant variant, ProductStockLink stockLink) {
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

    private PreparationFlow resolvePreparationFlow(PreparationFlow preparationFlow) {
        return preparationFlow == null ? PreparationFlow.KITCHEN : preparationFlow;
    }

    private String normalizeName(String name) {
        return name == null ? "" : name.trim();
    }
}
