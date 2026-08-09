package com.hubon.backend.product.service;

import com.hubon.backend.category.domain.Category;
import com.hubon.backend.category.repository.CategoryRepository;
import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.domain.ProductOptionGroup;
import com.hubon.backend.product.dto.ProductRegistrationRequest;
import com.hubon.backend.product.dto.ProductRequest;
import com.hubon.backend.product.dto.ProductResponse;
import com.hubon.backend.product.repository.ProductOptionGroupRepository;
import com.hubon.backend.product.repository.ProductRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {
    private final ProductRepository productRepository;
    private final ProductOptionGroupRepository optionGroupRepository;
    private final CategoryRepository categoryRepository;
    private final ProductOptionService productOptionService;

    @Transactional(readOnly = true)
    public List<ProductResponse> listAll() {
        List<Product> products = productRepository.findAllByOrderByDisplayOrderAscNameAsc();
        Map<Long, List<ProductOptionGroup>> groups = optionGroupRepository
                .findAllByProductIdInOrderByDisplayOrderAscNameAsc(products.stream().map(Product::getId).toList())
                .stream().collect(Collectors.groupingBy(group -> group.getProduct().getId()));
        return products.stream().map(product -> toResponse(product, groups.getOrDefault(product.getId(), List.of()))).toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse getById(Long id) {
        Product product = findEntityById(id);
        return toResponse(product, optionGroupRepository.findAllByProductIdOrderByDisplayOrderAscNameAsc(id));
    }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        return toResponse(createEntity(request), List.of());
    }

    @Transactional
    public ProductResponse register(ProductRegistrationRequest request) {
        Product product = createEntity(request.product());
        if (request.optionGroups() != null) request.optionGroups().forEach(group -> productOptionService.createGroup(product.getId(), group));
        return getById(product.getId());
    }

    @Transactional
    public ProductResponse update(Long id, ProductRequest request) {
        Product product = findEntityById(id);
        Category category = findCategory(request.categoryId());
        String name = request.name().trim();
        validateUniqueName(category, name, id);
        product.setCategory(category);
        product.setName(name);
        product.setDescription(normalizeOptional(request.description()));
        product.setPrice(request.price());
        product.setActive(request.active() == null ? product.getActive() : request.active());
        product.setAvailable(request.available() == null ? product.getAvailable() : request.available());
        product.setDisplayOrder(request.displayOrder() == null ? 0 : request.displayOrder());
        return getById(id);
    }

    @Transactional public ProductResponse activate(Long id) { findEntityById(id).setActive(true); return getById(id); }
    @Transactional public ProductResponse deactivate(Long id) { findEntityById(id).setActive(false); return getById(id); }
    @Transactional public ProductResponse setAvailable(Long id, boolean available) { findEntityById(id).setAvailable(available); return getById(id); }

    @Transactional(readOnly = true)
    public Product findEntityById(Long id) {
        return productRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Produto nao encontrado"));
    }

    private Product createEntity(ProductRequest request) {
        Category category = findCategory(request.categoryId());
        String name = request.name().trim();
        validateUniqueName(category, name, null);
        return productRepository.save(Product.builder().category(category).name(name)
                .description(normalizeOptional(request.description())).price(request.price())
                .active(request.active()).available(request.available())
                .displayOrder(request.displayOrder() == null ? 0 : request.displayOrder()).build());
    }

    private Category findCategory(Long categoryId) {
        if (categoryId == null) return null;
        return categoryRepository.findById(categoryId).orElseThrow(() -> new ResourceNotFoundException("Categoria nao encontrada"));
    }

    private void validateUniqueName(Category category, String name, Long currentId) {
        boolean duplicate = category == null
                ? (currentId == null ? productRepository.existsByCategoryIsNullAndNameIgnoreCase(name)
                    : productRepository.existsByCategoryIsNullAndNameIgnoreCaseAndIdNot(name, currentId))
                : (currentId == null ? productRepository.existsByCategoryIdAndNameIgnoreCase(category.getId(), name)
                    : productRepository.existsByCategoryIdAndNameIgnoreCaseAndIdNot(category.getId(), name, currentId));
        if (duplicate) throw new BusinessException("Ja existe um produto com este nome nesta categoria");
    }

    private ProductResponse toResponse(Product product, List<ProductOptionGroup> groups) {
        Category category = product.getCategory();
        return new ProductResponse(product.getId(), category == null ? null : category.getId(),
                category == null ? null : category.getName(), product.getName(), product.getDescription(),
                product.getPrice(), product.getActive(), product.getAvailable(), product.getDisplayOrder(),
                groups.stream().map(productOptionService::toResponse).toList(), product.getCreatedAt(), product.getUpdatedAt());
    }

    private String normalizeOptional(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
