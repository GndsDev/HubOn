package com.hubon.backend.order.repository;

import com.hubon.backend.order.domain.OrderItem;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.OrderStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    @EntityGraph(attributePaths = {"product"})
    List<OrderItem> findAllByOrderId(Long orderId);

    @EntityGraph(attributePaths = {"product"})
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

    @Query("""
            select coalesce(sum(item.subtotal), 0)
            from OrderItem item
            where item.order.status = :cancelledStatus
              and item.order.updatedAt >= :start
              and item.order.updatedAt < :end
            """)
    BigDecimal sumCancelledSubtotalBetween(
            @Param("cancelledStatus") OrderStatus cancelledStatus,
            @Param("start") java.time.LocalDateTime start,
            @Param("end") java.time.LocalDateTime end
    );

    @Query("""
            select item.productNameSnapshot as name,
                   item.product.category.name as category,
                   sum(item.quantity) as quantity,
                   sum(item.subtotal) as revenue
            from OrderItem item
            where item.status = :activeItemStatus
              and item.order.status <> :cancelledOrderStatus
            group by item.productNameSnapshot, item.product.category.name
            order by sum(item.quantity) desc
            """)
    List<BestSellingProductProjection> findBestSellingProducts(
            @Param("activeItemStatus") OrderItemStatus activeItemStatus,
            @Param("cancelledOrderStatus") OrderStatus cancelledOrderStatus,
            Pageable pageable
    );

    interface BestSellingProductProjection {
        String getName();

        String getCategory();

        Long getQuantity();

        BigDecimal getRevenue();
    }
}
