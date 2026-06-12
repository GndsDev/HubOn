package com.hubon.backend.table.repository;

import com.hubon.backend.table.domain.RestaurantTable;
import com.hubon.backend.table.domain.TableStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, Long> {

    List<RestaurantTable> findAllByOrderByNumberAsc();

    Optional<RestaurantTable> findByNumber(Integer number);

    boolean existsByNumber(Integer number);

    long countByActiveTrueAndStatus(TableStatus status);

    @Query("""
            select count(table)
            from RestaurantTable table
            where table.active = false
               or table.status = :disabledStatus
            """)
    long countDisabled(@Param("disabledStatus") TableStatus disabledStatus);
}
