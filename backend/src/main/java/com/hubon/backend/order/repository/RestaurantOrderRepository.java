package com.hubon.backend.order.repository;

import com.hubon.backend.order.domain.RestaurantOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RestaurantOrderRepository extends JpaRepository<RestaurantOrder, Long> {

    List<RestaurantOrder> findAllByOrderByCreatedAtDesc();
}
