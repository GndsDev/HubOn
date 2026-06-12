package com.hubon.backend.dashboard.service;

import com.hubon.backend.dashboard.dto.DashboardSummaryResponse;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.domain.RestaurantOrder;
import com.hubon.backend.order.repository.OrderItemRepository;
import com.hubon.backend.order.repository.RestaurantOrderRepository;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.repository.TabRepository;
import com.hubon.backend.table.domain.TableStatus;
import com.hubon.backend.table.repository.RestaurantTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final TabRepository tabRepository;
    private final RestaurantOrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final PaymentRepository paymentRepository;
    private final RestaurantTableRepository tableRepository;

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary() {
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay();
        long closedToday = tabRepository
                .countByStatusAndClosedAtGreaterThanEqualAndClosedAtLessThan(
                        TabStatus.CLOSED,
                        start,
                        end
                );
        BigDecimal todaySales = tabRepository.sumFinalAmountByStatusAndClosedAtBetween(
                TabStatus.CLOSED,
                start,
                end
        );
        BigDecimal averageTicket = closedToday == 0
                ? BigDecimal.ZERO
                : todaySales.divide(BigDecimal.valueOf(closedToday), 2, RoundingMode.HALF_UP);
        long openTabs = tabRepository.countByStatus(TabStatus.OPEN);
        long ordersInPreparation = orderRepository.countByStatusIn(
                List.of(OrderStatus.SENT_TO_KITCHEN, OrderStatus.PREPARING)
        );
        BigDecimal openAmount = tabRepository.sumFinalAmountByStatus(TabStatus.OPEN);
        BigDecimal receivedToday = paymentRepository.sumAmountBetween(start, end);
        BigDecimal cancelledAmount = orderItemRepository.sumCancelledSubtotalBetween(
                OrderStatus.CANCELLED,
                start,
                end
        );

        return new DashboardSummaryResponse(
                todaySales,
                openTabs,
                ordersInPreparation,
                averageTicket,
                bestSellingProducts(),
                tableSummary(),
                new DashboardSummaryResponse.CashSummary(receivedToday, openAmount, cancelledAmount),
                recentOrders()
        );
    }

    private List<DashboardSummaryResponse.BestSellingProduct> bestSellingProducts() {
        return orderItemRepository.findBestSellingProducts(
                        OrderItemStatus.ACTIVE,
                        OrderStatus.CANCELLED,
                        PageRequest.of(0, 5)
                )
                .stream()
                .map(product -> new DashboardSummaryResponse.BestSellingProduct(
                        product.getName(),
                        product.getCategory(),
                        product.getQuantity(),
                        product.getRevenue()
                ))
                .toList();
    }

    private DashboardSummaryResponse.TableSummary tableSummary() {
        long available = tableRepository.countByActiveTrueAndStatus(TableStatus.AVAILABLE);
        long occupied = tableRepository.countByActiveTrueAndStatus(TableStatus.OCCUPIED);
        long reserved = tableRepository.countByActiveTrueAndStatus(TableStatus.RESERVED);
        long disabled = tableRepository.countDisabled(TableStatus.DISABLED);
        return new DashboardSummaryResponse.TableSummary(
                available,
                occupied,
                reserved,
                disabled,
                available + occupied + reserved + disabled
        );
    }

    private List<DashboardSummaryResponse.RecentOrder> recentOrders() {
        List<RestaurantOrder> orders = orderRepository.findAllByOrderByCreatedAtDesc(
                PageRequest.of(0, 5)
        );
        if (orders.isEmpty()) {
            return List.of();
        }
        Map<Long, BigDecimal> amountByOrder = orderItemRepository
                .findAllByOrderIdIn(orders.stream().map(RestaurantOrder::getId).toList())
                .stream()
                .filter(item -> item.getStatus() == OrderItemStatus.ACTIVE)
                .collect(Collectors.groupingBy(
                        item -> item.getOrder().getId(),
                        Collectors.reducing(
                                BigDecimal.ZERO,
                                item -> item.getSubtotal(),
                                BigDecimal::add
                        )
                ));

        return orders.stream()
                .map(order -> new DashboardSummaryResponse.RecentOrder(
                        order.getId(),
                        order.getTab().getRestaurantTable().getNumber(),
                        order.getStatus().name(),
                        amountByOrder.getOrDefault(order.getId(), BigDecimal.ZERO),
                        order.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                ))
                .toList();
    }
}
