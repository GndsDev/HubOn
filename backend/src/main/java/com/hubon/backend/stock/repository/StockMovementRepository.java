package com.hubon.backend.stock.repository;

import com.hubon.backend.stock.domain.StockMovement;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {
    List<StockMovement> findAllByOrderByCreatedAtDesc(Pageable pageable);
    List<StockMovement> findAllByStockItemIdOrderByCreatedAtDesc(Long stockItemId, Pageable pageable);
    List<StockMovement> findAllBySaleItemIdOrderByCreatedAtAscIdAsc(Long saleItemId);
    boolean existsByStockItemId(Long stockItemId);
}
