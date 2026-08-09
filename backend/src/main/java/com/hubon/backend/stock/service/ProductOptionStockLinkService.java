package com.hubon.backend.stock.service;

import com.hubon.backend.product.domain.ProductOption;
import com.hubon.backend.product.repository.ProductOptionRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.ProductOptionStockLink;
import com.hubon.backend.stock.domain.StockItem;
import com.hubon.backend.stock.dto.ProductOptionStockLinkRequest;
import com.hubon.backend.stock.dto.ProductOptionStockLinkResponse;
import com.hubon.backend.stock.repository.ProductOptionStockLinkRepository;
import com.hubon.backend.stock.repository.StockItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductOptionStockLinkService {
    private final ProductOptionStockLinkRepository repository;
    private final ProductOptionRepository optionRepository;
    private final StockItemRepository stockItemRepository;

    @Transactional(readOnly = true)
    public ProductOptionStockLinkResponse get(Long productId, Long groupId, Long optionId) {
        validateOption(productId, groupId, optionId);
        return toResponse(findActive(optionId));
    }

    @Transactional
    public ProductOptionStockLinkResponse create(
            Long productId,
            Long groupId,
            Long optionId,
            ProductOptionStockLinkRequest request
    ) {
        ProductOption option = validateOption(productId, groupId, optionId);
        if (repository.existsByProductOptionIdAndActiveTrue(optionId)) {
            throw new BusinessException("Escolha ja possui controle automatico de estoque");
        }
        StockItem stockItem = findActiveStockItem(request.stockItemId());
        return toResponse(repository.save(ProductOptionStockLink.builder()
                .productOption(option)
                .stockItem(stockItem)
                .quantityPerSelection(request.quantityPerSelection())
                .active(true)
                .build()));
    }

    @Transactional
    public ProductOptionStockLinkResponse update(
            Long productId,
            Long groupId,
            Long optionId,
            ProductOptionStockLinkRequest request
    ) {
        validateOption(productId, groupId, optionId);
        ProductOptionStockLink link = findActive(optionId);
        link.setStockItem(findActiveStockItem(request.stockItemId()));
        link.setQuantityPerSelection(request.quantityPerSelection());
        return toResponse(link);
    }

    @Transactional
    public void deactivate(Long productId, Long groupId, Long optionId) {
        validateOption(productId, groupId, optionId);
        findActive(optionId).setActive(false);
    }

    private ProductOption validateOption(Long productId, Long groupId, Long optionId) {
        ProductOption option = optionRepository.findByIdAndGroupId(optionId, groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Escolha nao encontrada"));
        if (!option.getGroup().getProduct().getId().equals(productId)) {
            throw new ResourceNotFoundException("Escolha nao encontrada");
        }
        return option;
    }

    private ProductOptionStockLink findActive(Long optionId) {
        return repository.findByProductOptionIdAndActiveTrue(optionId)
                .orElseThrow(() -> new ResourceNotFoundException("Controle de estoque da escolha nao encontrado"));
    }

    private StockItem findActiveStockItem(Long stockItemId) {
        StockItem item = stockItemRepository.findById(stockItemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item de estoque nao encontrado"));
        if (!Boolean.TRUE.equals(item.getActive())) {
            throw new BusinessException("Item de estoque inativo nao pode ser vinculado");
        }
        return item;
    }

    public ProductOptionStockLinkResponse toResponse(ProductOptionStockLink link) {
        return new ProductOptionStockLinkResponse(
                link.getId(),
                link.getProductOption().getId(),
                link.getStockItem().getId(),
                link.getStockItem().getName(),
                link.getStockItem().getUnit(),
                link.getQuantityPerSelection(),
                link.getActive(),
                link.getCreatedAt(),
                link.getUpdatedAt()
        );
    }
}
