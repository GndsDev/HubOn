package com.hubon.backend.table.repository;

import com.hubon.backend.table.domain.RestaurantTable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, Long> {

    List<RestaurantTable> findAllByOrderByNumberAsc();

    Optional<RestaurantTable> findByNumber(Integer number);

    boolean existsByNumber(Integer number);
}
