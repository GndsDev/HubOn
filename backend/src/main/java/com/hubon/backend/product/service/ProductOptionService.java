package com.hubon.backend.product.service;

import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.domain.ProductOption;
import com.hubon.backend.product.domain.ProductOptionGroup;
import com.hubon.backend.product.dto.ProductOptionGroupRequest;
import com.hubon.backend.product.dto.ProductOptionGroupResponse;
import com.hubon.backend.product.dto.ProductOptionRequest;
import com.hubon.backend.product.dto.ProductOptionResponse;
import com.hubon.backend.product.repository.ProductOptionGroupRepository;
import com.hubon.backend.product.repository.ProductOptionRepository;
import com.hubon.backend.product.repository.ProductRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ProductOptionService {

    private final ProductRepository productRepository;
    private final ProductOptionGroupRepository groupRepository;
    private final ProductOptionRepository optionRepository;

    @Transactional(readOnly = true)
    public List<ProductOptionGroupResponse> listByProduct(Long productId) {
        ensureProductExists(productId);
        return groupRepository.findAllByProductIdOrderByDisplayOrderAscNameAsc(productId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ProductOptionGroupResponse createGroup(Long productId, ProductOptionGroupRequest request) {
        Product product = findProduct(productId);
        String name = normalizeName(request.name(), "Nome do grupo de escolhas e obrigatorio");
        validateGroup(productId, null, name, request);

        ProductOptionGroup group = buildGroup(product, request, name);
        return toResponse(groupRepository.save(group));
    }

    @Transactional
    public ProductOptionGroupResponse updateGroup(Long productId, Long groupId, ProductOptionGroupRequest request) {
        ProductOptionGroup group = findGroup(productId, groupId);
        String name = normalizeName(request.name(), "Nome do grupo de escolhas e obrigatorio");
        validateGroup(productId, groupId, name, request);

        group.setName(name);
        group.setRequired(Boolean.TRUE.equals(request.required()));
        group.setMinimumSelections(request.minimumSelections());
        group.setMaximumSelections(request.maximumSelections());
        group.setDisplayOrder(valueOrZero(request.displayOrder()));
        group.setActive(request.active() == null ? group.getActive() : request.active());
        return toResponse(group);
    }

    @Transactional
    public ProductOptionGroupResponse setGroupActive(Long productId, Long groupId, boolean active) {
        ProductOptionGroup group = findGroup(productId, groupId);
        group.setActive(active);
        return toResponse(group);
    }

    @Transactional
    public ProductOptionResponse createOption(Long productId, Long groupId, ProductOptionRequest request) {
        ProductOptionGroup group = findGroup(productId, groupId);
        String name = normalizeName(request.name(), "Nome da opcao e obrigatorio");
        validateOption(groupId, null, name, request);
        ProductOption option = buildOption(group, request, name);
        return toResponse(optionRepository.save(option));
    }

    @Transactional
    public ProductOptionResponse updateOption(
            Long productId,
            Long groupId,
            Long optionId,
            ProductOptionRequest request
    ) {
        findGroup(productId, groupId);
        ProductOption option = findOption(groupId, optionId);
        String name = normalizeName(request.name(), "Nome da opcao e obrigatorio");
        validateOption(groupId, optionId, name, request);

        option.setName(name);
        option.setAdditionalPrice(valueOrZero(request.additionalPrice()));
        option.setDisplayOrder(valueOrZero(request.displayOrder()));
        option.setActive(request.active() == null ? option.getActive() : request.active());
        return toResponse(option);
    }

    @Transactional
    public ProductOptionResponse setOptionActive(
            Long productId,
            Long groupId,
            Long optionId,
            boolean active
    ) {
        findGroup(productId, groupId);
        ProductOption option = findOption(groupId, optionId);
        option.setActive(active);
        return toResponse(option);
    }

    @Transactional(readOnly = true)
    public List<ProductOption> validateSelections(Long productId, List<Long> requestedOptionIds) {
        List<Long> optionIds = requestedOptionIds == null ? List.of() : requestedOptionIds;
        if (new HashSet<>(optionIds).size() != optionIds.size()) {
            throw new BusinessException("A mesma escolha nao pode ser selecionada duas vezes");
        }

        List<ProductOptionGroup> groups = groupRepository.findAllByProductIdOrderByDisplayOrderAscNameAsc(productId);
        List<ProductOption> selectedOptions = optionIds.isEmpty()
                ? List.of()
                : optionRepository.findAllByIdIn(optionIds);
        if (selectedOptions.size() != optionIds.size()) {
            throw new BusinessException("Uma das escolhas informadas nao existe");
        }

        Map<Long, List<ProductOption>> selectedByGroup = new LinkedHashMap<>();
        for (ProductOption option : selectedOptions) {
            ProductOptionGroup group = option.getGroup();
            if (!group.getProduct().getId().equals(productId)) {
                throw new BusinessException("Escolha nao pertence ao produto informado");
            }
            if (!Boolean.TRUE.equals(group.getActive()) || !Boolean.TRUE.equals(option.getActive())) {
                throw new BusinessException("Escolha inativa nao pode ser utilizada");
            }
            selectedByGroup.computeIfAbsent(group.getId(), ignored -> new ArrayList<>()).add(option);
        }

        for (ProductOptionGroup group : groups) {
            if (!Boolean.TRUE.equals(group.getActive())) continue;
            int selectedCount = selectedByGroup.getOrDefault(group.getId(), List.of()).size();
            int minimum = group.getMinimumSelections();
            if (Boolean.TRUE.equals(group.getRequired()) && selectedCount < minimum) {
                throw new BusinessException("Preencha a escolha obrigatoria: " + group.getName());
            }
            if (selectedCount > 0 && selectedCount < minimum) {
                throw new BusinessException("Selecione pelo menos %d opcao(oes) em %s".formatted(minimum, group.getName()));
            }
            if (selectedCount > group.getMaximumSelections()) {
                throw new BusinessException("Selecione no maximo %d opcao(oes) em %s"
                        .formatted(group.getMaximumSelections(), group.getName()));
            }
        }

        return selectedOptions;
    }

    ProductOptionGroup buildGroup(Product product, ProductOptionGroupRequest request, String normalizedName) {
        ProductOptionGroup group = ProductOptionGroup.builder()
                .product(product)
                .name(normalizedName)
                .required(Boolean.TRUE.equals(request.required()))
                .minimumSelections(request.minimumSelections())
                .maximumSelections(request.maximumSelections())
                .displayOrder(valueOrZero(request.displayOrder()))
                .active(request.active())
                .build();

        Set<String> names = new HashSet<>();
        for (ProductOptionRequest optionRequest : optionsOrEmpty(request.options())) {
            String optionName = normalizeName(optionRequest.name(), "Nome da opcao e obrigatorio");
            if (!names.add(optionName.toLowerCase())) {
                throw new BusinessException("Nao repita opcoes no mesmo grupo");
            }
            validateOptionValues(optionRequest);
            group.addOption(buildOption(group, optionRequest, optionName));
        }
        return group;
    }

    ProductOptionGroupResponse toResponse(ProductOptionGroup group) {
        return new ProductOptionGroupResponse(
                group.getId(),
                group.getProduct().getId(),
                group.getName(),
                group.getRequired(),
                group.getMinimumSelections(),
                group.getMaximumSelections(),
                group.getDisplayOrder(),
                group.getActive(),
                group.getOptions().stream().map(this::toResponse).toList(),
                group.getCreatedAt(),
                group.getUpdatedAt()
        );
    }

    private ProductOptionResponse toResponse(ProductOption option) {
        return new ProductOptionResponse(
                option.getId(),
                option.getGroup().getId(),
                option.getName(),
                option.getAdditionalPrice(),
                option.getDisplayOrder(),
                option.getActive(),
                option.getCreatedAt(),
                option.getUpdatedAt()
        );
    }

    private ProductOptionGroup findGroup(Long productId, Long groupId) {
        return groupRepository.findByIdAndProductId(groupId, productId)
                .orElseThrow(() -> new ResourceNotFoundException("Grupo de escolhas nao encontrado"));
    }

    private ProductOption findOption(Long groupId, Long optionId) {
        return optionRepository.findByIdAndGroupId(optionId, groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Opcao nao encontrada"));
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

    private void validateGroup(Long productId, Long currentId, String name, ProductOptionGroupRequest request) {
        boolean duplicate = currentId == null
                ? groupRepository.existsByProductIdAndNameIgnoreCase(productId, name)
                : groupRepository.existsByProductIdAndNameIgnoreCaseAndIdNot(productId, name, currentId);
        if (duplicate) throw new BusinessException("Ja existe um grupo de escolhas com este nome");
        if (request.maximumSelections() < request.minimumSelections()) {
            throw new BusinessException("Maximo de escolhas nao pode ser menor que o minimo");
        }
        if (Boolean.TRUE.equals(request.required()) && request.minimumSelections() < 1) {
            throw new BusinessException("Grupo obrigatorio deve exigir pelo menos uma escolha");
        }
    }

    private void validateOption(Long groupId, Long currentId, String name, ProductOptionRequest request) {
        boolean duplicate = currentId == null
                ? optionRepository.existsByGroupIdAndNameIgnoreCase(groupId, name)
                : optionRepository.existsByGroupIdAndNameIgnoreCaseAndIdNot(groupId, name, currentId);
        if (duplicate) throw new BusinessException("Ja existe uma opcao com este nome no grupo");
        validateOptionValues(request);
    }

    private void validateOptionValues(ProductOptionRequest request) {
        if (valueOrZero(request.additionalPrice()).compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("Preco adicional nao pode ser negativo");
        }
    }

    private ProductOption buildOption(ProductOptionGroup group, ProductOptionRequest request, String name) {
        return ProductOption.builder()
                .group(group)
                .name(name)
                .additionalPrice(valueOrZero(request.additionalPrice()))
                .displayOrder(valueOrZero(request.displayOrder()))
                .active(request.active())
                .build();
    }

    private List<ProductOptionRequest> optionsOrEmpty(List<ProductOptionRequest> options) {
        return options == null ? List.of() : options;
    }

    private String normalizeName(String value, String message) {
        if (value == null || value.trim().isBlank()) throw new BusinessException(message);
        return value.trim();
    }

    private int valueOrZero(Integer value) {
        return value == null ? 0 : value;
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
