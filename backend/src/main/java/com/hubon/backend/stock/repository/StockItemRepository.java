package com.hubon.backend.stock.repository;

import com.hubon.backend.stock.domain.StockItem;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StockItemRepository extends JpaRepository<StockItem, Long> {
    List<StockItem> findAllByOrderByNameAsc();
    List<StockItem> findAllByActiveTrueOrderByNameAsc();
    boolean existsByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);

    @Query("select item from StockItem item where item.active = true and item.currentStock <= item.minimumStock order by item.name")
    List<StockItem> findAlerts();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select item from StockItem item where item.id = :id")
    Optional<StockItem> findByIdForUpdate(@Param("id") Long id);
}
