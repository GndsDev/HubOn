package com.hubon.backend.stock.repository;

import com.hubon.backend.stock.domain.ProductStockLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProductStockLinkRepository extends JpaRepository<ProductStockLink, Long> {
    Optional<ProductStockLink> findByProductIdAndActiveTrue(Long productId);
    boolean existsByProductIdAndActiveTrue(Long productId);
    boolean existsByStockItemIdAndActiveTrue(Long stockItemId);
}
