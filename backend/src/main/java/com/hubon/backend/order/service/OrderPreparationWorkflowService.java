package com.hubon.backend.order.service;

import com.hubon.backend.order.domain.OrderItem;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.domain.RestaurantOrder;
import com.hubon.backend.order.repository.OrderItemRepository;
import com.hubon.backend.order.repository.RestaurantOrderRepository;
import com.hubon.backend.product.domain.PreparationFlow;
import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderPreparationWorkflowService {

    private final RestaurantOrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    public boolean startEligibleCounterItems(Tab tab) {
        if (tab.getType() != TabType.COUNTER) return false;

        boolean changed = false;
        for (RestaurantOrder order : orderRepository.findAllByTabIdForUpdate(tab.getId())) {
            List<OrderItem> items = orderItemRepository.findAllByOrderId(order.getId());
            boolean orderChanged = false;
            for (OrderItem item : items) {
                if (item.getPreparationFlowSnapshot() == PreparationFlow.REQUIRES_PREPARATION
                        && item.getStatus() == OrderItemStatus.WAITING_PREPARATION) {
                    item.setStatus(OrderItemStatus.IN_PREPARATION);
                    orderChanged = true;
                    changed = true;
                }
            }
            if (orderChanged) refreshOrderStatus(order, items);
        }
        orderItemRepository.flush();
        return changed;
    }

    public void refreshOrderStatus(RestaurantOrder order, List<OrderItem> items) {
        List<OrderItemStatus> statuses = items.stream().map(OrderItem::getStatus).toList();
        if (statuses.isEmpty() || statuses.stream().allMatch(status -> status == OrderItemStatus.CANCELED)) {
            order.setStatus(OrderStatus.CANCELLED);
        } else if (statuses.stream().anyMatch(status -> status == OrderItemStatus.DRAFT)) {
            order.setStatus(OrderStatus.CREATED);
        } else if (statuses.stream().anyMatch(status -> status == OrderItemStatus.IN_PREPARATION)) {
            order.setStatus(OrderStatus.PREPARING);
        } else if (statuses.stream().anyMatch(status -> status == OrderItemStatus.WAITING_PREPARATION)) {
            order.setStatus(OrderStatus.SENT_TO_KITCHEN);
        } else if (statuses.stream().filter(status -> status != OrderItemStatus.CANCELED)
                .allMatch(status -> status == OrderItemStatus.DELIVERED)) {
            order.setStatus(OrderStatus.DELIVERED);
        } else {
            order.setStatus(OrderStatus.READY);
        }
    }
}
