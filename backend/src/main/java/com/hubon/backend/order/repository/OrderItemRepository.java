package com.hubon.backend.order.repository;

import com.hubon.backend.order.domain.OrderItem;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    List<OrderItem> findAllByOrderId(Long orderId);

    List<OrderItem> findAllByOrderIdIn(Collection<Long> orderIds);

    @Query("""
            select coalesce(sum(item.subtotal), 0)
            from OrderItem item
            where item.order.tab.id = :tabId
              and item.order.status <> :cancelledOrderStatus
              and item.status = :activeItemStatus
            """)
    BigDecimal sumActiveSubtotalByTabId(
            @Param("tabId") Long tabId,
            @Param("cancelledOrderStatus") OrderStatus cancelledOrderStatus,
            @Param("activeItemStatus") OrderItemStatus activeItemStatus
    );
}
