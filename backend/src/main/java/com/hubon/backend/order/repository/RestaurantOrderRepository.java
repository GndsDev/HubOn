package com.hubon.backend.order.repository;

import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.domain.RestaurantOrder;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface RestaurantOrderRepository extends JpaRepository<RestaurantOrder, Long> {

    @EntityGraph(attributePaths = {"tab", "tab.restaurantTable", "createdByUser"})
    List<RestaurantOrder> findAllByOrderByCreatedAtDesc(Pageable pageable);

    boolean existsByTabIdAndStatusNotIn(Long tabId, Collection<OrderStatus> statuses);

    boolean existsByTabIdAndStatus(Long tabId, OrderStatus status);

    long countByStatusIn(Collection<OrderStatus> statuses);
}
