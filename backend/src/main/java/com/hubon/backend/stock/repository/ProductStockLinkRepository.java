package com.hubon.backend.stock.repository;

import com.hubon.backend.stock.domain.ProductStockLink;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductStockLinkRepository extends JpaRepository<ProductStockLink, Long> {

    @EntityGraph(attributePaths = {"productVariant", "productVariant.product", "productVariant.product.category", "stockItem"})
    Optional<ProductStockLink> findByProductVariantIdAndActiveTrue(Long productVariantId);

    @EntityGraph(attributePaths = {"productVariant", "productVariant.product", "productVariant.product.category", "stockItem"})
    List<ProductStockLink> findAllByProductVariantIdInAndActiveTrue(Collection<Long> productVariantIds);

    boolean existsByProductVariantIdAndActiveTrue(Long productVariantId);
}
