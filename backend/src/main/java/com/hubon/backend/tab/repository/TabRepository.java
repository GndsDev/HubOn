package com.hubon.backend.tab.repository;

import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TabRepository extends JpaRepository<Tab, Long> {

    List<Tab> findAllByStatusOrderByOpenedAtDesc(TabStatus status);

    boolean existsByRestaurantTableIdAndStatus(Long restaurantTableId, TabStatus status);

    Optional<Tab> findFirstByRestaurantTableIdAndStatus(Long restaurantTableId, TabStatus status);
}
