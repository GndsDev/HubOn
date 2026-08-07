package com.hubon.backend.table.repository;

import com.hubon.backend.table.domain.RestaurantTable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, Long> {
    List<RestaurantTable> findAllByOrderByNumberAsc();
    Optional<RestaurantTable> findByNumber(Integer number);
    boolean existsByNumber(Integer number);
    long countByActiveTrue();
    long countByActiveFalse();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select table from RestaurantTable table where table.id = :id")
    Optional<RestaurantTable> findByIdForUpdate(@Param("id") Long id);
}
