package com.hubon.backend.stock.service;

import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.repository.ProductRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.ProductStockLink;
import com.hubon.backend.stock.domain.StockItem;
import com.hubon.backend.stock.dto.ProductStockLinkRequest;
import com.hubon.backend.stock.dto.ProductStockLinkResponse;
import com.hubon.backend.stock.repository.ProductStockLinkRepository;
import com.hubon.backend.stock.repository.StockItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductStockLinkService {
    private final ProductStockLinkRepository repository;
    private final ProductRepository productRepository;
    private final StockItemRepository stockItemRepository;

    @Transactional(readOnly = true)
    public ProductStockLinkResponse getByProduct(Long productId) { return toResponse(findActive(productId)); }

    @Transactional
    public ProductStockLinkResponse create(Long productId, ProductStockLinkRequest request) {
        if (repository.existsByProductIdAndActiveTrue(productId)) throw new BusinessException("Produto ja possui vinculo automatico ativo");
        Product product = findProduct(productId);
        StockItem item = findStockItem(request.stockItemId());
        if (!Boolean.TRUE.equals(item.getActive())) throw new BusinessException("Item de estoque inativo nao pode ser vinculado");
        return toResponse(repository.save(ProductStockLink.builder().product(product).stockItem(item)
                .quantityPerSale(request.quantityPerSale()).active(true).build()));
    }

    @Transactional
    public ProductStockLinkResponse update(Long productId, ProductStockLinkRequest request) {
        ProductStockLink link = findActive(productId);
        StockItem item = findStockItem(request.stockItemId());
        if (!Boolean.TRUE.equals(item.getActive())) throw new BusinessException("Item de estoque inativo nao pode ser vinculado");
        link.setStockItem(item);
        link.setQuantityPerSale(request.quantityPerSale());
        return toResponse(link);
    }

    @Transactional public void deactivate(Long productId) { findActive(productId).setActive(false); }

    private ProductStockLink findActive(Long productId) { return repository.findByProductIdAndActiveTrue(productId)
            .orElseThrow(() -> new ResourceNotFoundException("Vinculo de estoque nao encontrado")); }
    private Product findProduct(Long id) { return productRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Produto nao encontrado")); }
    private StockItem findStockItem(Long id) { return stockItemRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Item de estoque nao encontrado")); }

    private ProductStockLinkResponse toResponse(ProductStockLink link) {
        return new ProductStockLinkResponse(link.getId(), link.getProduct().getId(), link.getProduct().getName(),
                link.getStockItem().getId(), link.getStockItem().getName(), link.getStockItem().getUnit(),
                link.getQuantityPerSale(), link.getActive(), link.getCreatedAt(), link.getUpdatedAt());
    }
}
