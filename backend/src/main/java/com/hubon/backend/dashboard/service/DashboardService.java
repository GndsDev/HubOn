package com.hubon.backend.dashboard.service;

import com.hubon.backend.dashboard.dto.DashboardSummaryResponse;
import com.hubon.backend.order.domain.OrderItem;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.domain.RestaurantOrder;
import com.hubon.backend.order.repository.OrderItemRepository;
import com.hubon.backend.order.repository.RestaurantOrderRepository;
import com.hubon.backend.payment.domain.Payment;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.repository.TabRepository;
import com.hubon.backend.table.domain.RestaurantTable;
import com.hubon.backend.table.domain.TableStatus;
import com.hubon.backend.table.repository.RestaurantTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
        List<Tab> tabs = tabRepository.findAll();
        List<RestaurantOrder> orders = orderRepository.findAllByOrderByCreatedAtDesc();
        List<OrderItem> items = orderItemRepository.findAll();
        List<Payment> payments = paymentRepository.findAll();
        List<RestaurantTable> tables = tableRepository.findAll();

        List<Tab> closedToday = tabs.stream()
                .filter(tab -> tab.getStatus() == TabStatus.CLOSED)
                .filter(tab -> tab.getClosedAt() != null && tab.getClosedAt().toLocalDate().equals(today))
                .toList();

        BigDecimal todaySales = closedToday.stream()
                .map(Tab::getFinalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal averageTicket = closedToday.isEmpty()
                ? BigDecimal.ZERO
                : todaySales.divide(BigDecimal.valueOf(closedToday.size()), 2, RoundingMode.HALF_UP);

        long ordersInPreparation = orders.stream()
                .filter(order -> order.getStatus() == OrderStatus.SENT_TO_KITCHEN
                        || order.getStatus() == OrderStatus.PREPARING)
                .count();

        BigDecimal openAmount = tabs.stream()
                .filter(tab -> tab.getStatus() == TabStatus.OPEN)
                .map(Tab::getFinalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal receivedToday = payments.stream()
                .filter(payment -> payment.getPaidAt().toLocalDate().equals(today))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal cancelledAmount = items.stream()
                .filter(item -> item.getOrder().getStatus() == OrderStatus.CANCELLED)
                .filter(item -> item.getOrder().getUpdatedAt().toLocalDate().equals(today))
                .map(OrderItem::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new DashboardSummaryResponse(
                todaySales,
                tabs.stream().filter(tab -> tab.getStatus() == TabStatus.OPEN).count(),
                ordersInPreparation,
                averageTicket,
                bestSellingProducts(items),
                tableSummary(tables),
                new DashboardSummaryResponse.CashSummary(receivedToday, openAmount, cancelledAmount),
                recentOrders(orders)
        );
    }

    private List<DashboardSummaryResponse.BestSellingProduct> bestSellingProducts(List<OrderItem> items) {
        Map<Long, ProductAggregate> aggregates = new LinkedHashMap<>();
        items.stream()
                .filter(item -> item.getStatus() == OrderItemStatus.ACTIVE)
                .filter(item -> item.getOrder().getStatus() != OrderStatus.CANCELLED)
                .forEach(item -> aggregates.merge(
                        item.getProduct().getId(),
                        new ProductAggregate(
                                item.getProductNameSnapshot(),
                                item.getProduct().getCategory().getName(),
                                item.getQuantity(),
                                item.getSubtotal()
                        ),
                        ProductAggregate::merge
                ));

        return aggregates.values().stream()
                .sorted(Comparator.comparingLong(ProductAggregate::quantity).reversed())
                .limit(5)
                .map(value -> new DashboardSummaryResponse.BestSellingProduct(
                        value.name(),
                        value.category(),
                        value.quantity(),
                        value.revenue()
                ))
                .toList();
    }

    private DashboardSummaryResponse.TableSummary tableSummary(List<RestaurantTable> tables) {
        return new DashboardSummaryResponse.TableSummary(
                countTables(tables, TableStatus.AVAILABLE),
                countTables(tables, TableStatus.OCCUPIED),
                countTables(tables, TableStatus.RESERVED),
                countTables(tables, TableStatus.DISABLED),
                tables.size()
        );
    }

    private long countTables(List<RestaurantTable> tables, TableStatus status) {
        return tables.stream().filter(table -> table.getStatus() == status).count();
    }

    private List<DashboardSummaryResponse.RecentOrder> recentOrders(List<RestaurantOrder> orders) {
        return orders.stream()
                .limit(5)
                .map(order -> {
                    BigDecimal amount = orderItemRepository.findAllByOrderId(order.getId()).stream()
                            .filter(item -> item.getStatus() == OrderItemStatus.ACTIVE)
                            .map(OrderItem::getSubtotal)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    return new DashboardSummaryResponse.RecentOrder(
                            order.getId(),
                            order.getTab().getRestaurantTable().getNumber(),
                            order.getStatus().name(),
                            amount,
                            order.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                    );
                })
                .toList();
    }

    private record ProductAggregate(String name, String category, long quantity, BigDecimal revenue) {
        private ProductAggregate merge(ProductAggregate other) {
            return new ProductAggregate(name, category, quantity + other.quantity, revenue.add(other.revenue));
        }
    }
}
