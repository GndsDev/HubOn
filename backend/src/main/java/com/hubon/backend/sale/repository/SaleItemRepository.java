package com.hubon.backend.sale.repository;

import com.hubon.backend.sale.domain.SaleItem;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SaleItemRepository extends JpaRepository<SaleItem, Long> {
    List<SaleItem> findAllBySaleIdOrderByCreatedAtAscIdAsc(Long saleId);
    List<SaleItem> findAllBySaleIdIn(Collection<Long> saleIds);
    List<SaleItem> findAllByCancelledAtGreaterThanEqualAndCancelledAtLessThanOrderByCancelledAtAsc(
            LocalDateTime start, LocalDateTime end);
    long countBySaleIdAndCancelledAtIsNull(Long saleId);

    @Query("select coalesce(sum(item.subtotal), 0) from SaleItem item where item.sale.id = :saleId and item.cancelledAt is null")
    BigDecimal sumActiveSubtotal(@Param("saleId") Long saleId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select item from SaleItem item where item.id = :itemId and item.sale.id = :saleId")
    Optional<SaleItem> findByIdAndSaleIdForUpdate(@Param("itemId") Long itemId, @Param("saleId") Long saleId);
}
