package com.hubon.backend.tab.repository;

import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabStatus;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public interface TabRepository extends JpaRepository<Tab, Long> {

    List<Tab> findAllByStatusOrderByOpenedAtDesc(TabStatus status);

    boolean existsByRestaurantTableIdAndStatus(Long restaurantTableId, TabStatus status);

    Optional<Tab> findFirstByRestaurantTableIdAndStatus(Long restaurantTableId, TabStatus status);

    long countByStatus(TabStatus status);

    @Query("""
            select coalesce(sum(tab.finalAmount), 0)
            from Tab tab
            where tab.status = :status
            """)
    BigDecimal sumFinalAmountByStatus(@Param("status") TabStatus status);

    @Query("""
            select coalesce(sum(tab.finalAmount), 0)
            from Tab tab
            where tab.status = :status
              and tab.closedAt >= :start
              and tab.closedAt < :end
            """)
    BigDecimal sumFinalAmountByStatusAndClosedAtBetween(
            @Param("status") TabStatus status,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    long countByStatusAndClosedAtGreaterThanEqualAndClosedAtLessThan(
            TabStatus status,
            LocalDateTime start,
            LocalDateTime end
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000"))
    @Query("select tab from Tab tab where tab.id = :id")
    Optional<Tab> findByIdForUpdate(@Param("id") Long id);
}
