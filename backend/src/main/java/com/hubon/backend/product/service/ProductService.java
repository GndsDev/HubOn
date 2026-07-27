package com.hubon.backend.product.service;

import com.hubon.backend.category.domain.Category;
import com.hubon.backend.category.repository.CategoryRepository;
import com.hubon.backend.product.domain.PreparationFlow;
import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.domain.ProductOptionGroup;
import com.hubon.backend.product.domain.ProductVariant;
import com.hubon.backend.product.dto.ProductRegistrationRequest;
import com.hubon.backend.product.dto.ProductRequest;
import com.hubon.backend.product.dto.ProductResponse;
import com.hubon.backend.product.dto.ProductVariantRegistrationRequest;
import com.hubon.backend.product.dto.ProductVariantResponse;
import com.hubon.backend.product.repository.ProductOptionGroupRepository;
import com.hubon.backend.product.repository.ProductRepository;
import com.hubon.backend.product.repository.ProductVariantRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.ProductStockLink;
import com.hubon.backend.stock.dto.ProductStockLinkRequest;
import com.hubon.backend.stock.repository.ProductStockLinkRepository;
import com.hubon.backend.stock.service.ProductStockLinkService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final ProductOptionGroupRepository optionGroupRepository;
    private final CategoryRepository categoryRepository;
    private final ProductStockLinkRepository productStockLinkRepository;
    private final ProductVariantService productVariantService;
    private final ProductOptionService productOptionService;
    private final ProductStockLinkService productStockLinkService;

    @Transactional(readOnly = true)
    public List<ProductResponse> listAll() {
        List<Product> products = productRepository.findAllByOrderByDisplayOrderAscNameAsc();
        if (products.isEmpty()) return List.of();

        List<Long> productIds = products.stream().map(Product::getId).toList();
        Map<Long, List<ProductVariant>> variantsByProductId = productVariantRepository
                .findAllByProductIdInOrderByDisplayOrderAscNameAsc(productIds)
                .stream()
                .collect(Collectors.groupingBy(variant -> variant.getProduct().getId()));
        Map<Long, List<ProductOptionGroup>> groupsByProductId = optionGroupRepository
                .findAllByProductIdInOrderByDisplayOrderAscNameAsc(productIds)
                .stream()
                .collect(Collectors.groupingBy(group -> group.getProduct().getId()));
        Map<Long, ProductStockLink> linksByVariantId = linksByVariantId(
                variantsByProductId.values().stream().flatMap(List::stream).toList()
        );

        return products.stream()
                .map(product -> toResponse(
                        product,
                        variantsByProductId.getOrDefault(product.getId(), List.of()),
                        groupsByProductId.getOrDefault(product.getId(), List.of()),
                        linksByVariantId
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse getById(Long id) {
        Product product = findEntityById(id);
        List<ProductVariant> variants = productVariantRepository
                .findAllByProductIdOrderByDisplayOrderAscNameAsc(product.getId());
        List<ProductOptionGroup> groups = optionGroupRepository
                .findAllByProductIdOrderByDisplayOrderAscNameAsc(product.getId());
        return toResponse(product, variants, groups, linksByVariantId(variants));
    }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        Product product = createEntity(request);
        return toResponse(product, List.of(), List.of(), Map.of());
    }

    @Transactional
    public ProductResponse register(ProductRegistrationRequest request) {
        validateRegistrationVariants(request.variants());
        Product product = createEntity(request.product());

        for (ProductVariantRegistrationRequest variantRegistration : request.variants()) {
            ProductVariantResponse variant = productVariantService.create(product.getId(), variantRegistration.variant());
            boolean hasStockItem = variantRegistration.stockItemId() != null;
            boolean hasQuantity = variantRegistration.quantityPerSale() != null;
            if (hasStockItem != hasQuantity) {
                throw new BusinessException("Informe o item e a quantidade do vinculo de estoque");
            }
            if (hasStockItem) {
                productStockLinkService.create(
                        variant.id(),
                        new ProductStockLinkRequest(
                                variantRegistration.stockItemId(),
                                variantRegistration.quantityPerSale()
                        )
                );
            }
        }

        if (request.optionGroups() != null) {
            request.optionGroups().forEach(group -> productOptionService.createGroup(product.getId(), group));
        }
        return getById(product.getId());
    }

    @Transactional
    public ProductResponse update(Long id, ProductRequest request) {
        Product product = findEntityById(id);
        Category category = findCategory(request.categoryId());
        String name = normalizeName(request.name());
        validateUniqueName(category.getId(), name, id);

        product.setCategory(category);
        product.setName(name);
        product.setDescription(normalizeOptional(request.description()));
        product.setPreparationFlow(request.preparationFlow());
        product.setActive(request.active() == null ? product.getActive() : request.active());
        product.setAvailable(request.available() == null ? product.getAvailable() : request.available());
        product.setDisplayOrder(valueOrZero(request.displayOrder()));
        product.setImageUrl(normalizeOptional(request.imageUrl()));
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

    @Transactional
    public ProductResponse setAvailable(Long id, boolean available) {
        Product product = findEntityById(id);
        product.setAvailable(available);
        return getById(product.getId());
    }

    @Transactional(readOnly = true)
    public Product findEntityById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Produto nao encontrado"));
    }

    private Product createEntity(ProductRequest request) {
        Category category = findCategory(request.categoryId());
        String name = normalizeName(request.name());
        validateUniqueName(category.getId(), name, null);
        Product product = Product.builder()
                .category(category)
                .name(name)
                .description(normalizeOptional(request.description()))
                .preparationFlow(request.preparationFlow() == null
                        ? PreparationFlow.REQUIRES_PREPARATION
                        : request.preparationFlow())
                .active(request.active())
                .available(request.available())
                .displayOrder(valueOrZero(request.displayOrder()))
                .imageUrl(normalizeOptional(request.imageUrl()))
                .build();
        return productRepository.save(product);
    }

    private Category findCategory(Long categoryId) {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria nao encontrada"));
    }

    private void validateUniqueName(Long categoryId, String name, Long currentProductId) {
        boolean exists = currentProductId == null
                ? productRepository.existsByCategoryIdAndNameIgnoreCase(categoryId, name)
                : productRepository.existsByCategoryIdAndNameIgnoreCaseAndIdNot(categoryId, name, currentProductId);
        if (exists) throw new BusinessException("Ja existe um produto com este nome nesta categoria");
    }

    private void validateRegistrationVariants(List<ProductVariantRegistrationRequest> variants) {
        Set<String> names = new HashSet<>();
        for (ProductVariantRegistrationRequest registration : variants) {
            String name = normalizeName(registration.variant().name()).toLowerCase();
            if (!names.add(name)) {
                throw new BusinessException("Nao repita variacoes no cadastro do produto");
            }
        }
    }

    private ProductResponse toResponse(
            Product product,
            List<ProductVariant> variants,
            List<ProductOptionGroup> groups,
            Map<Long, ProductStockLink> linksByVariantId
    ) {
        List<ProductVariantResponse> variantResponses = variants.stream()
                .map(variant -> toVariantResponse(variant, linksByVariantId.get(variant.getId())))
                .toList();
        List<ProductVariant> activeVariants = variants.stream()
                .filter(variant -> Boolean.TRUE.equals(variant.getActive()))
                .toList();
        List<ProductVariant> sellableVariants = activeVariants.stream()
                .filter(variant -> Boolean.TRUE.equals(variant.getAvailable()))
                .toList();
        BigDecimal minimumPrice = activeVariants.stream()
                .map(ProductVariant::getPrice)
                .min(BigDecimal::compareTo)
                .orElse(null);
        BigDecimal maximumPrice = activeVariants.stream()
                .map(ProductVariant::getPrice)
                .max(BigDecimal::compareTo)
                .orElse(null);
        boolean linked = variants.stream()
                .map(ProductVariant::getId)
                .map(linksByVariantId::get)
                .anyMatch(link -> link != null && Boolean.TRUE.equals(link.getActive()));
        boolean complete = !sellableVariants.isEmpty();

        return new ProductResponse(
                product.getId(),
                product.getCategory().getId(),
                product.getCategory().getName(),
                product.getCategory().getActive(),
                product.getName(),
                product.getDescription(),
                product.getPreparationFlow(),
                product.getActive(),
                product.getAvailable(),
                product.getDisplayOrder(),
                product.getImageUrl(),
                variants.size(),
                activeVariants.size(),
                sellableVariants.size(),
                minimumPrice,
                maximumPrice,
                linked,
                complete,
                variantResponses,
                groups.stream().map(productOptionService::toResponse).toList(),
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
                variant.getAvailable(),
                variant.getDisplayOrder(),
                stockLink != null && Boolean.TRUE.equals(stockLink.getActive()),
                stockLink == null ? null : stockLink.getId(),
                stockLink == null ? null : stockLink.getStockItem().getId(),
                stockLink == null ? null : stockLink.getStockItem().getName(),
                stockLink == null ? null : stockLink.getQuantityPerSale(),
                variant.getCreatedAt(),
                variant.getUpdatedAt()
        );
    }

    private Map<Long, ProductStockLink> linksByVariantId(List<ProductVariant> variants) {
        if (variants.isEmpty()) return Map.of();
        return productStockLinkRepository
                .findAllByProductVariantIdInAndActiveTrue(variants.stream().map(ProductVariant::getId).toList())
                .stream()
                .collect(Collectors.toMap(link -> link.getProductVariant().getId(), Function.identity()));
    }

    private String normalizeName(String name) {
        if (name == null || name.trim().isBlank()) throw new BusinessException("Nome do produto e obrigatorio");
        return name.trim();
    }

    private String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private int valueOrZero(Integer value) {
        return value == null ? 0 : value;
    }
}
