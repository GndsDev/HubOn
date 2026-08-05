package com.hubon.backend.tab.service;

import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.dto.OrderItemResponse;
import com.hubon.backend.order.dto.RestaurantOrderResponse;
import com.hubon.backend.order.service.RestaurantOrderService;
import com.hubon.backend.product.domain.PreparationFlow;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.domain.TabType;
import com.hubon.backend.tab.dto.CounterAttendanceState;
import com.hubon.backend.tab.dto.CounterFinancialState;
import com.hubon.backend.tab.dto.CounterNextAction;
import com.hubon.backend.tab.dto.CounterPreparationState;
import com.hubon.backend.tab.dto.CounterSaleDetailResponse;
import com.hubon.backend.tab.dto.CounterSaleSummaryResponse;
import com.hubon.backend.tab.dto.TabResponse;
import com.hubon.backend.tab.dto.UpdateCounterTabRequest;
import com.hubon.backend.tab.repository.TabRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class CounterSaleService {

    private final TabRepository tabRepository;
    private final TabService tabService;
    private final TabAccountingService accountingService;
    private final RestaurantOrderService orderService;
    private final Clock businessClock;

    @Transactional(readOnly = true)
    public List<CounterSaleSummaryResponse> listActive() {
        return tabRepository.findAllByTypeAndStatusOrderByOpenedAtDesc(TabType.COUNTER, TabStatus.OPEN)
                .stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CounterSaleSummaryResponse> listFinishedToday() {
        LocalDate today = LocalDate.now(businessClock);
        return tabRepository.findAllByTypeOrderByOpenedAtDesc(TabType.COUNTER)
                .stream()
                .filter(tab -> tab.getStatus() == TabStatus.CLOSED)
                .filter(tab -> today.equals(businessDate(tab)))
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CounterSaleSummaryResponse> searchHistory(
            LocalDate from,
            LocalDate to,
            Long number,
            String customer,
            TabStatus status,
            String operator
    ) {
        String customerFilter = normalizedFilter(customer);
        String operatorFilter = normalizedFilter(operator);
        return tabRepository.findAllByTypeOrderByOpenedAtDesc(TabType.COUNTER)
                .stream()
                .filter(tab -> status == null ? tab.getStatus() != TabStatus.OPEN : tab.getStatus() == status)
                .filter(tab -> number == null || tab.getId().equals(number))
                .filter(tab -> from == null || !businessDate(tab).isBefore(from))
                .filter(tab -> to == null || !businessDate(tab).isAfter(to))
                .filter(tab -> customerFilter == null || normalizedValue(tab.getCustomerName()).contains(customerFilter))
                .filter(tab -> operatorFilter == null || normalizedValue(tab.getOpenedByUser().getName()).contains(operatorFilter))
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public CounterSaleDetailResponse getById(Long id) {
        return toDetail(findCounter(id));
    }

    @Transactional
    public CounterSaleDetailResponse update(Long id, UpdateCounterTabRequest request) {
        tabService.updateCounter(id, request);
        return toDetail(findCounter(id));
    }

    @Transactional
    public CounterSaleDetailResponse finish(Long id) {
        tabService.closeCounter(id);
        return toDetail(findCounter(id));
    }

    private CounterSaleDetailResponse toDetail(Tab tab) {
        List<RestaurantOrderResponse> orders = orderService.listByTabId(tab.getId());
        return new CounterSaleDetailResponse(
                toSummary(tab, orders),
                tab.getCustomerPhone(),
                tab.getIdentificationNote(),
                orders
        );
    }

    private CounterSaleSummaryResponse toSummary(Tab tab) {
        return toSummary(tab, orderService.listByTabId(tab.getId()));
    }

    private CounterSaleSummaryResponse toSummary(Tab tab, List<RestaurantOrderResponse> orders) {
        accountingService.refreshAmounts(tab);
        TabResponse response = tabService.toResponse(tab);
        List<OrderItemResponse> items = orders.stream()
                .flatMap(order -> order.items().stream())
                .filter(item -> item.status() != OrderItemStatus.CANCELED)
                .toList();

        int draft = quantity(items, OrderItemStatus.DRAFT);
        int waiting = quantity(items, OrderItemStatus.WAITING_PREPARATION);
        int preparing = quantity(items, OrderItemStatus.IN_PREPARATION);
        int ready = quantity(items, OrderItemStatus.READY);
        int delivered = quantity(items, OrderItemStatus.DELIVERED);
        int itemCount = items.stream().mapToInt(this::quantity).sum();
        int confirmed = itemCount - draft;
        int pendingPreparation = waiting + preparing;
        List<OrderItemResponse> preparationItems = items.stream()
                .filter(item -> item.status() != OrderItemStatus.DRAFT)
                .filter(item -> item.preparationFlow() == PreparationFlow.REQUIRES_PREPARATION)
                .toList();
        int preparationWaiting = quantity(preparationItems, OrderItemStatus.WAITING_PREPARATION);
        int preparationPreparing = quantity(preparationItems, OrderItemStatus.IN_PREPARATION);
        int preparationReady = quantity(preparationItems, OrderItemStatus.READY);
        int preparationDelivered = quantity(preparationItems, OrderItemStatus.DELIVERED);
        int preparationConfirmed = preparationItems.stream().mapToInt(this::quantity).sum();
        boolean hasPreparation = preparationConfirmed > 0;
        boolean allConfirmedDelivered = confirmed > 0 && delivered == confirmed;
        BigDecimal displayTotal = response.finalAmount();
        BigDecimal displayRemaining = response.remainingAmount();
        if (confirmed == 0 && draft > 0) {
            displayTotal = items.stream()
                    .filter(item -> item.status() == OrderItemStatus.DRAFT)
                    .map(OrderItemResponse::subtotal)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .add(response.serviceFee())
                    .subtract(response.discountAmount())
                    .max(BigDecimal.ZERO);
            displayRemaining = displayTotal;
        }

        CounterFinancialState financialState = financialState(response);
        CounterPreparationState preparationState = preparationState(
                hasPreparation,
                response.remainingAmount(),
                preparationConfirmed,
                preparationWaiting,
                preparationPreparing,
                preparationReady,
                preparationDelivered
        );
        CounterAttendanceState attendanceState = attendanceState(
                response,
                draft,
                confirmed,
                pendingPreparation,
                delivered,
                allConfirmedDelivered
        );
        CounterNextAction nextAction = nextAction(
                response,
                itemCount,
                draft,
                confirmed,
                pendingPreparation,
                ready,
                allConfirmedDelivered,
                response.paidAmount()
        );

        return new CounterSaleSummaryResponse(
                response.id(),
                response.id(),
                response.displayLabel(),
                response.customerName(),
                response.openedAt(),
                response.closedAt(),
                response.openedByUserName(),
                response.status(),
                displayTotal,
                response.paidAmount(),
                displayRemaining,
                itemCount,
                draft,
                waiting,
                preparing,
                ready,
                delivered,
                attendanceState,
                preparationState,
                financialState,
                nextAction,
                response.status() == TabStatus.OPEN
                        && response.paidAmount().signum() == 0
                        && delivered == 0
        );
    }

    private CounterFinancialState financialState(TabResponse tab) {
        if (tab.status() == TabStatus.CANCELLED) return CounterFinancialState.CANCELLED;
        if (tab.paidAmount().signum() == 0) return CounterFinancialState.UNPAID;
        if (tab.remainingAmount().signum() > 0) return CounterFinancialState.PARTIALLY_PAID;
        return CounterFinancialState.PAID;
    }

    private CounterPreparationState preparationState(
            boolean hasPreparation,
            BigDecimal remainingAmount,
            int preparationConfirmed,
            int waiting,
            int preparing,
            int ready,
            int delivered
    ) {
        if (!hasPreparation) return CounterPreparationState.NOT_APPLICABLE;
        if (preparationConfirmed > 0 && delivered == preparationConfirmed) return CounterPreparationState.DELIVERED;
        if (remainingAmount.signum() > 0 && waiting > 0 && preparing == 0) {
            return CounterPreparationState.WAITING_PAYMENT;
        }
        if (waiting + preparing > 0 && ready + delivered > 0) return CounterPreparationState.PARTIALLY_READY;
        if (preparing > 0) return CounterPreparationState.IN_PREPARATION;
        if (waiting > 0) return CounterPreparationState.WAITING;
        return CounterPreparationState.READY;
    }

    private CounterAttendanceState attendanceState(
            TabResponse tab,
            int draft,
            int confirmed,
            int pendingPreparation,
            int delivered,
            boolean allConfirmedDelivered
    ) {
        if (tab.status() == TabStatus.CLOSED) return CounterAttendanceState.FINISHED;
        if (tab.status() == TabStatus.CANCELLED) return CounterAttendanceState.CANCELLED;
        if (draft > 0 || confirmed == 0) return CounterAttendanceState.ASSEMBLING;
        if (allConfirmedDelivered && tab.remainingAmount().signum() == 0) {
            return CounterAttendanceState.READY_TO_FINISH;
        }
        if (pendingPreparation > 0 || delivered > 0 || tab.paidAmount().signum() > 0) {
            return CounterAttendanceState.IN_PROGRESS;
        }
        return CounterAttendanceState.CONFIRMED;
    }

    private CounterNextAction nextAction(
            TabResponse tab,
            int itemCount,
            int draft,
            int confirmed,
            int pendingPreparation,
            int ready,
            boolean allConfirmedDelivered,
            BigDecimal paidAmount
    ) {
        if (tab.status() != TabStatus.OPEN) return CounterNextAction.VIEW;
        if (itemCount == 0) return CounterNextAction.ADD_ITEMS;
        if (draft > 0) return CounterNextAction.CONFIRM_ORDER;
        if (tab.remainingAmount().signum() > 0) {
            return paidAmount.signum() > 0
                    ? CounterNextAction.COMPLETE_PAYMENT
                    : CounterNextAction.REGISTER_PAYMENT;
        }
        if (pendingPreparation > 0) return CounterNextAction.FOLLOW_PREPARATION;
        if (allConfirmedDelivered) {
            return CounterNextAction.FINALIZE;
        }
        if (confirmed > 0 && ready > 0) {
            return CounterNextAction.DELIVER;
        }
        return CounterNextAction.VIEW;
    }

    private int quantity(List<OrderItemResponse> items, OrderItemStatus status) {
        return items.stream()
                .filter(item -> item.status() == status)
                .mapToInt(this::quantity)
                .sum();
    }

    private int quantity(OrderItemResponse item) {
        return item.quantity() == null ? 0 : item.quantity();
    }

    private Tab findCounter(Long id) {
        Tab tab = tabService.findEntityById(id);
        if (tab.getType() != TabType.COUNTER) {
            throw new ResourceNotFoundException("Atendimento de balcão não encontrado");
        }
        return tab;
    }

    private LocalDate businessDate(Tab tab) {
        if (tab.getClosedBusinessDate() != null) return tab.getClosedBusinessDate();
        if (tab.getClosedAt() != null) return tab.getClosedAt().toLocalDate();
        return tab.getOpenedAt().toLocalDate();
    }

    private String normalizedFilter(String value) {
        return value == null || value.isBlank() ? null : normalizedValue(value);
    }

    private String normalizedValue(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.forLanguageTag("pt-BR"));
    }
}
