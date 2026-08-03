package com.hubon.backend.order.repository;

import com.hubon.backend.order.domain.OrderItem;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.product.domain.PreparationFlow;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    @EntityGraph(attributePaths = {"product", "product.category", "productVariant", "productVariant.product", "options", "options.productOption"})
    List<OrderItem> findAllByOrderId(Long orderId);

    @EntityGraph(attributePaths = {"product", "product.category", "productVariant", "productVariant.product", "options", "options.productOption"})
    List<OrderItem> findAllByOrderIdIn(Collection<Long> orderIds);

    @EntityGraph(attributePaths = {"product", "product.category", "productVariant", "productVariant.product", "options", "options.productOption"})
    Optional<OrderItem> findByIdAndOrderId(Long id, Long orderId);

    @EntityGraph(attributePaths = {
            "order", "order.tab", "order.tab.restaurantTable", "cancelledByUser"
    })
    List<OrderItem> findAllByStatusAndCancelledAtGreaterThanEqualAndCancelledAtLessThanEqualOrderByCancelledAtAsc(
            OrderItemStatus status,
            java.time.LocalDateTime start,
            java.time.LocalDateTime end
    );

    @EntityGraph(attributePaths = {"order", "order.tab", "order.tab.restaurantTable", "order.createdByUser", "product", "productVariant", "options"})
    List<OrderItem> findAllByPreparationFlowSnapshotAndStatusInOrderByCreatedAtAsc(
            PreparationFlow preparationFlow,
            Collection<OrderItemStatus> statuses
    );

    @Query("""
            select coalesce(sum(item.subtotal), 0)
            from OrderItem item
            where item.order.tab.id = :tabId
              and item.order.status <> :cancelledOrderStatus
              and item.status not in :excludedItemStatuses
            """)
    BigDecimal sumBillableSubtotalByTabId(
            @Param("tabId") Long tabId,
            @Param("cancelledOrderStatus") OrderStatus cancelledOrderStatus,
            @Param("excludedItemStatuses") Collection<OrderItemStatus> excludedItemStatuses
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
            select case
                     when item.productVariantNameSnapshot = 'Padrão' then item.productNameSnapshot
                     else concat(item.productNameSnapshot, ' - ', item.productVariantNameSnapshot)
                   end as name,
                   item.categoryNameSnapshot as category,
                   sum(item.quantity) as quantity,
                   sum(item.subtotal) as revenue
            from OrderItem item
            where item.status not in :excludedItemStatuses
              and item.order.status <> :cancelledOrderStatus
            group by item.productNameSnapshot, item.productVariantNameSnapshot, item.categoryNameSnapshot
            order by sum(item.quantity) desc
            """)
    List<BestSellingProductProjection> findBestSellingProducts(
            @Param("excludedItemStatuses") Collection<OrderItemStatus> excludedItemStatuses,
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
