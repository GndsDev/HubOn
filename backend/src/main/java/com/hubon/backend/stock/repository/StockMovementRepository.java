package com.hubon.backend.stock.repository;

import com.hubon.backend.sale.domain.SaleItem;
import com.hubon.backend.stock.domain.StockMovement;
import com.hubon.backend.stock.domain.StockMovementType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {
    List<StockMovement> findAllByOrderByCreatedAtDesc(Pageable pageable);
    List<StockMovement> findAllByStockItemIdOrderByCreatedAtDesc(Long stockItemId, Pageable pageable);
    Optional<StockMovement> findFirstBySaleItemIdAndType(Long saleItemId, StockMovementType type);
    boolean existsByReversedMovementId(Long movementId);
    boolean existsByStockItemId(Long stockItemId);
}
