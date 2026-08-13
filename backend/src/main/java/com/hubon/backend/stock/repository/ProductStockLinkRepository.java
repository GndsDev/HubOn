package com.hubon.backend.stock.repository;

import com.hubon.backend.stock.domain.ProductStockLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Optional;

public interface ProductStockLinkRepository extends JpaRepository<ProductStockLink, Long> {
    Optional<ProductStockLink> findByProductIdAndActiveTrue(Long productId);

    @Query("""
            select link.stockItem.id as stockItemId, link.quantityPerSale as quantityPerSale
            from ProductStockLink link
            where link.product.id = :productId and link.active = true
            """)
    Optional<ActiveProductStockConsumption> findActiveConsumptionByProductId(
            @Param("productId") Long productId
    );

    boolean existsByProductIdAndActiveTrue(Long productId);
    boolean existsByStockItemIdAndActiveTrue(Long stockItemId);

    interface ActiveProductStockConsumption {
        Long getStockItemId();
        BigDecimal getQuantityPerSale();
    }
}
