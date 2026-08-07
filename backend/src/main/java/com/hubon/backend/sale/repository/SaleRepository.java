package com.hubon.backend.sale.repository;

import com.hubon.backend.sale.domain.Sale;
import com.hubon.backend.sale.domain.SaleStatus;
import com.hubon.backend.sale.domain.SaleType;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SaleRepository extends JpaRepository<Sale, Long> {
    List<Sale> findAllByOrderByOpenedAtDesc();
    List<Sale> findAllByStatusOrderByOpenedAtDesc(SaleStatus status);
    List<Sale> findAllByTypeOrderByOpenedAtDesc(SaleType type);
    List<Sale> findAllByTypeAndStatusOrderByOpenedAtDesc(SaleType type, SaleStatus status);
    Optional<Sale> findFirstByRestaurantTableIdAndStatus(Long tableId, SaleStatus status);
    boolean existsByRestaurantTableIdAndStatus(Long tableId, SaleStatus status);
    long countByStatus(SaleStatus status);
    long countByTypeAndStatus(SaleType type, SaleStatus status);
    long countByStatusAndClosedBusinessDate(SaleStatus status, LocalDate date);
    List<Sale> findAllByStatusAndClosedAtGreaterThanEqualAndClosedAtLessThanOrderByClosedAtAscIdAsc(
            SaleStatus status, LocalDateTime start, LocalDateTime end);
    List<Sale> findAllByStatusAndTypeAndClosedAtGreaterThanEqualAndClosedAtLessThanOrderByClosedAtAscIdAsc(
            SaleStatus status, SaleType type, LocalDateTime start, LocalDateTime end);
    List<Sale> findAllByStatusAndCancelledAtGreaterThanEqualAndCancelledAtLessThanOrderByCancelledAtAscIdAsc(
            SaleStatus status, LocalDateTime start, LocalDateTime end);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select sale from Sale sale where sale.id = :id")
    Optional<Sale> findByIdForUpdate(@Param("id") Long id);

    @Query("select sale from Sale sale where sale.status = :status order by sale.openedAt desc")
    List<Sale> findRecentByStatus(@Param("status") SaleStatus status, Pageable pageable);

}
