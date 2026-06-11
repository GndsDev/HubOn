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

public interface TabRepository extends JpaRepository<Tab, Long> {

    List<Tab> findAllByStatusOrderByOpenedAtDesc(TabStatus status);

    boolean existsByRestaurantTableIdAndStatus(Long restaurantTableId, TabStatus status);

    Optional<Tab> findFirstByRestaurantTableIdAndStatus(Long restaurantTableId, TabStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000"))
    @Query("select tab from Tab tab where tab.id = :id")
    Optional<Tab> findByIdForUpdate(@Param("id") Long id);
}
