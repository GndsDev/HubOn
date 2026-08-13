package com.hubon.backend.stock.repository;

import com.hubon.backend.stock.domain.ProductOptionStockLink;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductOptionStockLinkRepository extends JpaRepository<ProductOptionStockLink, Long> {
    @EntityGraph(attributePaths = {"productOption", "productOption.group", "productOption.group.product", "stockItem"})
    Optional<ProductOptionStockLink> findByProductOptionIdAndActiveTrue(Long productOptionId);

    @EntityGraph(attributePaths = {"productOption", "stockItem"})
    List<ProductOptionStockLink> findAllByProductOptionIdInAndActiveTrue(Collection<Long> productOptionIds);

    @Query("""
            select link.stockItem.id as stockItemId,
                   link.quantityPerSelection as quantityPerSelection
            from ProductOptionStockLink link
            where link.productOption.id in :productOptionIds and link.active = true
            """)
    List<ActiveOptionStockConsumption> findActiveConsumptionsByProductOptionIdIn(
            @Param("productOptionIds") Collection<Long> productOptionIds
    );

    boolean existsByProductOptionIdAndActiveTrue(Long productOptionId);

    boolean existsByStockItemIdAndActiveTrue(Long stockItemId);

    interface ActiveOptionStockConsumption {
        Long getStockItemId();
        BigDecimal getQuantityPerSelection();
    }
}
