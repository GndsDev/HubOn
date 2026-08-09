package com.hubon.backend.stock.repository;

import com.hubon.backend.stock.domain.ProductOptionStockLink;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductOptionStockLinkRepository extends JpaRepository<ProductOptionStockLink, Long> {
    @EntityGraph(attributePaths = {"productOption", "productOption.group", "productOption.group.product", "stockItem"})
    Optional<ProductOptionStockLink> findByProductOptionIdAndActiveTrue(Long productOptionId);

    @EntityGraph(attributePaths = {"productOption", "stockItem"})
    List<ProductOptionStockLink> findAllByProductOptionIdInAndActiveTrue(Collection<Long> productOptionIds);

    boolean existsByProductOptionIdAndActiveTrue(Long productOptionId);

    boolean existsByStockItemIdAndActiveTrue(Long stockItemId);
}
