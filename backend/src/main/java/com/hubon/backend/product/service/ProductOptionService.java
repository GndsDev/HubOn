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
import com.hubon.backend.stock.domain.ProductOptionStockLink;
import com.hubon.backend.stock.repository.ProductOptionStockLinkRepository;
import com.hubon.backend.stock.service.ProductOptionStockLinkService;
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
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductOptionService {

    private final ProductRepository productRepository;
    private final ProductOptionGroupRepository groupRepository;
    private final ProductOptionRepository optionRepository;
    private final ProductOptionStockLinkRepository optionStockLinkRepository;
    private final ProductOptionStockLinkService optionStockLinkService;

    @Transactional(readOnly = true)
    public List<ProductOptionGroupResponse> listByProduct(Long productId) {
        ensureProductExists(productId);
        return groupRepository.findAllByProductIdOrderByDisplayOrderAscNameAsc(productId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public ProductOptionGroupResponse createGroup(Long productId, ProductOptionGroupRequest request) {
        Product product = findProduct(productId);
        String name = normalizeName(request.name(), "Nome do grupo de escolhas e obrigatorio");
        validateGroup(productId, null, name, request);
        return toResponse(groupRepository.save(buildGroup(product, request, name)));
    }

    @Transactional
    public ProductOptionGroupResponse updateGroup(Long productId, Long groupId, ProductOptionGroupRequest request) {
        ProductOptionGroup group = findGroup(productId, groupId);
        String name = normalizeName(request.name(), "Nome do grupo de escolhas e obrigatorio");
        validateGroup(productId, groupId, name, request);
        group.setName(name);
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
        return toResponse(optionRepository.save(buildOption(group, request, name)));
    }

    @Transactional
    public ProductOptionResponse updateOption(Long productId, Long groupId, Long optionId, ProductOptionRequest request) {
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
    public ProductOptionResponse setOptionActive(Long productId, Long groupId, Long optionId, boolean active) {
        findGroup(productId, groupId);
        ProductOption option = findOption(groupId, optionId);
        option.setActive(active);
        return toResponse(option);
    }

    @Transactional(readOnly = true)
    public List<ProductOption> validateSelections(Long productId, List<Long> requestedOptionIds) {
        List<Long> optionIds = requestedOptionIds == null ? List.of() : requestedOptionIds;
        if (new HashSet<>(optionIds).size() != optionIds.size()) {
            throw new BusinessException("A mesma opcao nao pode ser selecionada duas vezes");
        }
        List<ProductOptionGroup> groups = groupRepository.findAllByProductIdOrderByDisplayOrderAscNameAsc(productId);
        List<ProductOption> selected = optionIds.isEmpty() ? List.of() : optionRepository.findAllByIdIn(optionIds);
        if (selected.size() != optionIds.size()) throw new BusinessException("Uma das opcoes informadas nao existe");

        Map<Long, List<ProductOption>> selectedByGroup = new LinkedHashMap<>();
        for (ProductOption option : selected) {
            ProductOptionGroup group = option.getGroup();
            if (!group.getProduct().getId().equals(productId)) {
                throw new BusinessException("Opcao nao pertence ao produto informado");
            }
            if (!Boolean.TRUE.equals(group.getActive()) || !Boolean.TRUE.equals(option.getActive())) {
                throw new BusinessException("Opcao inativa nao pode ser utilizada");
            }
            selectedByGroup.computeIfAbsent(group.getId(), ignored -> new ArrayList<>()).add(option);
        }

        for (ProductOptionGroup group : groups) {
            if (!Boolean.TRUE.equals(group.getActive())) continue;
            int count = selectedByGroup.getOrDefault(group.getId(), List.of()).size();
            if (count < group.getMinimumSelections()) {
                throw new BusinessException("Selecione pelo menos %d opcao(oes) em %s"
                        .formatted(group.getMinimumSelections(), group.getName()));
            }
            if (count > group.getMaximumSelections()) {
                throw new BusinessException("Selecione no maximo %d opcao(oes) em %s"
                        .formatted(group.getMaximumSelections(), group.getName()));
            }
        }
        return selected;
    }

    ProductOptionGroupResponse toResponse(ProductOptionGroup group) {
        Map<Long, ProductOptionStockLink> links = activeStockLinks(group.getOptions());
        return new ProductOptionGroupResponse(
                group.getId(), group.getProduct().getId(), group.getName(),
                group.getMinimumSelections(), group.getMaximumSelections(),
                group.getDisplayOrder(), group.getActive(),
                group.getOptions().stream().map(option -> toResponse(option, links.get(option.getId()))).toList(),
                group.getCreatedAt(), group.getUpdatedAt()
        );
    }

    private ProductOptionGroup buildGroup(Product product, ProductOptionGroupRequest request, String name) {
        ProductOptionGroup group = ProductOptionGroup.builder()
                .product(product).name(name)
                .minimumSelections(request.minimumSelections())
                .maximumSelections(request.maximumSelections())
                .displayOrder(valueOrZero(request.displayOrder()))
                .active(request.active()).build();
        Set<String> names = new HashSet<>();
        for (ProductOptionRequest optionRequest : request.options() == null ? List.<ProductOptionRequest>of() : request.options()) {
            String optionName = normalizeName(optionRequest.name(), "Nome da opcao e obrigatorio");
            if (!names.add(optionName.toLowerCase())) throw new BusinessException("Nao repita opcoes no mesmo grupo");
            validateOptionValues(optionRequest);
            group.addOption(buildOption(group, optionRequest, optionName));
        }
        return group;
    }

    private ProductOption buildOption(ProductOptionGroup group, ProductOptionRequest request, String name) {
        return ProductOption.builder().group(group).name(name)
                .additionalPrice(valueOrZero(request.additionalPrice()))
                .displayOrder(valueOrZero(request.displayOrder()))
                .active(request.active()).build();
    }

    private ProductOptionResponse toResponse(ProductOption option) {
        ProductOptionStockLink link = optionStockLinkRepository
                .findByProductOptionIdAndActiveTrue(option.getId())
                .orElse(null);
        return toResponse(option, link);
    }

    private ProductOptionResponse toResponse(ProductOption option, ProductOptionStockLink link) {
        return new ProductOptionResponse(option.getId(), option.getGroup().getId(), option.getName(),
                option.getAdditionalPrice(), option.getDisplayOrder(), option.getActive(),
                link == null ? null : optionStockLinkService.toResponse(link),
                option.getCreatedAt(), option.getUpdatedAt());
    }

    private Map<Long, ProductOptionStockLink> activeStockLinks(List<ProductOption> options) {
        if (options.isEmpty()) return Map.of();
        return optionStockLinkRepository.findAllByProductOptionIdInAndActiveTrue(
                        options.stream().map(ProductOption::getId).toList())
                .stream()
                .collect(Collectors.toMap(link -> link.getProductOption().getId(), Function.identity()));
    }

    private void validateGroup(Long productId, Long currentId, String name, ProductOptionGroupRequest request) {
        boolean duplicate = currentId == null
                ? groupRepository.existsByProductIdAndNameIgnoreCase(productId, name)
                : groupRepository.existsByProductIdAndNameIgnoreCaseAndIdNot(productId, name, currentId);
        if (duplicate) throw new BusinessException("Ja existe um grupo de escolhas com este nome");
        if (request.maximumSelections() < request.minimumSelections()) {
            throw new BusinessException("Maximo de escolhas nao pode ser menor que o minimo");
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
        if (valueOrZero(request.additionalPrice()).signum() < 0) {
            throw new BusinessException("Preco adicional nao pode ser negativo");
        }
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
        if (!productRepository.existsById(productId)) throw new ResourceNotFoundException("Produto nao encontrado");
    }

    private String normalizeName(String value, String message) {
        if (value == null || value.isBlank()) throw new BusinessException(message);
        return value.trim();
    }

    private int valueOrZero(Integer value) {
        return value == null ? 0 : value;
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
