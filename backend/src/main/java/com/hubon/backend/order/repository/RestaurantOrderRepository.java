package com.hubon.backend.order.repository;

import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.domain.RestaurantOrder;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RestaurantOrderRepository extends JpaRepository<RestaurantOrder, Long> {

    @EntityGraph(attributePaths = {"tab", "tab.restaurantTable", "createdByUser"})
    List<RestaurantOrder> findAllByOrderByCreatedAtDesc(Pageable pageable);

    boolean existsByTabIdAndStatusNotIn(Long tabId, Collection<OrderStatus> statuses);

    boolean existsByTabIdAndStatus(Long tabId, OrderStatus status);

    long countByStatusIn(Collection<OrderStatus> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000"))
    @Query("select order from RestaurantOrder order where order.id = :id")
    Optional<RestaurantOrder> findByIdForUpdate(@Param("id") Long id);
}
