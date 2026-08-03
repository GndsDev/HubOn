package com.hubon.backend.order.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.order.domain.OrderItem;
import com.hubon.backend.order.domain.OrderItemOption;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.domain.OrderType;
import com.hubon.backend.order.domain.RestaurantOrder;
import com.hubon.backend.order.dto.OrderCancellationRequest;
import com.hubon.backend.order.dto.OrderItemOptionResponse;
import com.hubon.backend.order.dto.OrderItemRequest;
import com.hubon.backend.order.dto.OrderItemResponse;
import com.hubon.backend.order.dto.OrderItemStatusRequest;
import com.hubon.backend.order.dto.OrderStatusRequest;
import com.hubon.backend.order.dto.RestaurantOrderRequest;
import com.hubon.backend.order.dto.RestaurantOrderResponse;
import com.hubon.backend.order.repository.OrderItemRepository;
import com.hubon.backend.order.repository.RestaurantOrderRepository;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.product.domain.PreparationFlow;
import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.domain.ProductOption;
import com.hubon.backend.product.domain.ProductVariant;
import com.hubon.backend.product.service.ProductOptionService;
import com.hubon.backend.product.service.ProductVariantService;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.service.InventoryMovementService;
import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.domain.TabType;
import com.hubon.backend.tab.repository.TabRepository;
import com.hubon.backend.tab.service.TabAccountingService;
import com.hubon.backend.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RestaurantOrderService {

    private final RestaurantOrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final TabRepository tabRepository;
    private final ProductVariantService productVariantService;
    private final ProductOptionService productOptionService;
    private final PaymentRepository paymentRepository;
    private final TabAccountingService accountingService;
    private final AuthenticatedUserProvider authenticatedUserProvider;
    private final InventoryMovementService inventoryMovementService;
    private final OrderPreparationWorkflowService preparationWorkflowService;

    @Transactional(readOnly = true)
    public List<RestaurantOrderResponse> listAll() {
        List<RestaurantOrder> orders = orderRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 100))
                .stream()
                .filter(this::canCurrentUserAccess)
                .toList();
        if (orders.isEmpty()) return List.of();
        Map<Long, List<OrderItem>> itemsByOrder = orderItemRepository
                .findAllByOrderIdIn(orders.stream().map(RestaurantOrder::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(item -> item.getOrder().getId()));
        return orders.stream()
                .map(order -> toResponse(order, itemsByOrder.getOrDefault(order.getId(), Collections.emptyList())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RestaurantOrderResponse> listByTabId(Long tabId) {
        List<RestaurantOrder> orders = orderRepository.findAllByTabIdOrderByCreatedAtAsc(tabId);
        if (orders.isEmpty()) return List.of();
        Map<Long, List<OrderItem>> itemsByOrder = orderItemRepository
                .findAllByOrderIdIn(orders.stream().map(RestaurantOrder::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(item -> item.getOrder().getId()));
        return orders.stream()
                .map(order -> toResponse(order, itemsByOrder.getOrDefault(order.getId(), Collections.emptyList())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RestaurantOrderResponse> listPreparationQueue() {
        List<OrderItem> queueItems = orderItemRepository
                .findAllByPreparationFlowSnapshotAndStatusInOrderByCreatedAtAsc(
                        PreparationFlow.REQUIRES_PREPARATION,
                        List.of(
                                OrderItemStatus.WAITING_PREPARATION,
                                OrderItemStatus.IN_PREPARATION,
                                OrderItemStatus.READY
                        )
                );
        Map<Long, List<OrderItem>> itemsByOrder = queueItems.stream()
                .collect(Collectors.groupingBy(
                        item -> item.getOrder().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        return itemsByOrder.values().stream()
                .map(items -> toResponse(items.get(0).getOrder(), items))
                .toList();
    }

    @Transactional(readOnly = true)
    public RestaurantOrderResponse getById(Long id) {
        RestaurantOrder order = findEntityById(id);
        ensureCounterOperatorAccess(order.getTab());
        return toResponse(order, orderItemRepository.findAllByOrderId(order.getId()));
    }

    @Transactional
    public RestaurantOrderResponse create(RestaurantOrderRequest request) {
        Tab tab = tabRepository.findByIdForUpdate(request.tabId())
                .orElseThrow(() -> new ResourceNotFoundException("Comanda não encontrada"));
        ensureCounterOperatorAccess(tab);
        ensureTabCanReceiveOrder(tab);
        User createdByUser = currentUser();

        RestaurantOrder order = orderRepository.save(RestaurantOrder.builder()
                .tab(tab)
                .createdByUser(createdByUser)
                .status(OrderStatus.CREATED)
                .type(orderTypeFor(tab))
                .notes(normalizeOptional(request.notes()))
                .build());
        List<OrderItem> items = saveRequestedItems(order, request.items());
        accountingService.refreshAmounts(tab);
        return toResponse(order, items);
    }

    @Transactional
    public RestaurantOrderResponse updateDraft(Long id, RestaurantOrderRequest request) {
        RestaurantOrder order = findEntityByIdForUpdate(id);
        ensureCounterOperatorAccess(order.getTab());
        ensureOrderTabOpen(order);
        if (order.getStatus() != OrderStatus.CREATED) {
            throw new BusinessException("Somente pedido em rascunho pode ser editado");
        }
        if (!order.getTab().getId().equals(request.tabId())) {
            throw new BusinessException("Pedido não pode ser movido para outra comanda");
        }

        List<OrderItem> previousItems = orderItemRepository.findAllByOrderId(order.getId());
        orderItemRepository.deleteAll(previousItems);
        orderItemRepository.flush();
        order.setType(orderTypeFor(order.getTab()));
        order.setNotes(normalizeOptional(request.notes()));
        List<OrderItem> items = saveRequestedItems(order, request.items());
        accountingService.refreshAmounts(order.getTab());
        return toResponse(order, items);
    }

    @Transactional
    public RestaurantOrderResponse confirm(Long id) {
        RestaurantOrder order = findEntityByIdForUpdate(id);
        ensureCounterOperatorAccess(order.getTab());
        ensureOrderTabOpen(order);
        List<OrderItem> items = orderItemRepository.findAllByOrderId(order.getId());

        if (order.getStatus() != OrderStatus.CREATED) {
            if (order.getStatus() == OrderStatus.CANCELLED) {
                throw new BusinessException("Pedido cancelado não pode ser confirmado");
            }
            return toResponse(order, items);
        }
        List<OrderItem> draftItems = items.stream()
                .filter(item -> item.getStatus() == OrderItemStatus.DRAFT)
                .toList();
        if (draftItems.isEmpty()) throw new BusinessException("Pedido precisa de pelo menos um item para ser confirmado");

        for (OrderItem item : draftItems) {
            productVariantService.findSellableVariant(item.getProduct().getId(), item.getProductVariant().getId());
            productOptionService.validateSelections(
                    item.getProduct().getId(),
                    item.getOptions().stream()
                            .map(OrderItemOption::getProductOption)
                            .map(option -> option == null ? null : option.getId())
                            .filter(java.util.Objects::nonNull)
                            .toList()
            );
        }

        inventoryMovementService.applyAutomaticSaleMovements(order, draftItems);
        draftItems.forEach(item -> item.setStatus(
                item.getPreparationFlowSnapshot() == PreparationFlow.DIRECT_SERVICE
                        ? OrderItemStatus.READY
                        : OrderItemStatus.WAITING_PREPARATION
        ));
        order.setConfirmedAt(LocalDateTime.now());
        preparationWorkflowService.refreshOrderStatus(order, items);
        accountingService.refreshAmounts(order.getTab());
        return toResponse(order, items);
    }

    @Transactional
    public RestaurantOrderResponse sendToKitchen(Long id) {
        return confirm(id);
    }

    @Transactional
    public RestaurantOrderResponse updateItemStatus(Long orderId, Long itemId, OrderItemStatusRequest request) {
        RestaurantOrder order = findEntityByIdForUpdate(orderId);
        ensureOrderTabOpen(order);
        OrderItem item = orderItemRepository.findByIdAndOrderId(itemId, orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Item do pedido não encontrado"));
        OrderItemStatus expected = switch (item.getStatus()) {
            case WAITING_PREPARATION -> OrderItemStatus.IN_PREPARATION;
            case IN_PREPARATION -> OrderItemStatus.READY;
            case READY -> OrderItemStatus.DELIVERED;
            default -> null;
        };
        if (expected == null || request.status() != expected) {
            throw new BusinessException("Transição de preparo do item não permitida");
        }
        if ((request.status() == OrderItemStatus.IN_PREPARATION || request.status() == OrderItemStatus.READY)
                && item.getPreparationFlowSnapshot() != PreparationFlow.REQUIRES_PREPARATION) {
            throw new BusinessException("Item de entrega direta não pertence à fila de preparo");
        }
        if (order.getTab().getType() == TabType.COUNTER
                && request.status() == OrderItemStatus.IN_PREPARATION) {
            throw new BusinessException("No balcão, o preparo começa automaticamente após o pagamento integral");
        }
        ensureItemTransitionAccess(order, request.status());
        if (request.status() == OrderItemStatus.DELIVERED) {
            ensureCounterPaidBeforeDelivery(order.getTab());
        }
        item.setStatus(request.status());
        List<OrderItem> items = orderItemRepository.findAllByOrderId(orderId);
        preparationWorkflowService.refreshOrderStatus(order, items);
        return toResponse(order, items);
    }

    @Transactional
    public RestaurantOrderResponse updateStatus(Long id, OrderStatusRequest request) {
        if (request.status() == OrderStatus.CANCELLED) {
            throw new BusinessException("Use o cancelamento com motivo obrigatório");
        }
        if (request.status() == OrderStatus.SENT_TO_KITCHEN) return confirm(id);

        RestaurantOrder order = findEntityByIdForUpdate(id);
        ensureCounterOperatorAccess(order.getTab());
        ensureOrderTabOpen(order);
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new BusinessException("Pedido cancelado não pode ter status alterado");
        }
        if (order.getTab().getType() == TabType.COUNTER && request.status() == OrderStatus.PREPARING) {
            throw new BusinessException("No balcão, o preparo começa automaticamente após o pagamento integral");
        }
        List<OrderItem> items = orderItemRepository.findAllByOrderId(order.getId());
        switch (request.status()) {
            case PREPARING -> transitionAll(items, OrderItemStatus.WAITING_PREPARATION, OrderItemStatus.IN_PREPARATION);
            case READY -> transitionAll(items, OrderItemStatus.IN_PREPARATION, OrderItemStatus.READY);
            case DELIVERED -> {
                ensureCounterPaidBeforeDelivery(order.getTab());
                if (items.stream().anyMatch(item -> item.getStatus() == OrderItemStatus.WAITING_PREPARATION
                        || item.getStatus() == OrderItemStatus.IN_PREPARATION
                        || item.getStatus() == OrderItemStatus.DRAFT)) {
                    throw new BusinessException("Pedido ainda possui itens pendentes");
                }
                transitionAll(items, OrderItemStatus.READY, OrderItemStatus.DELIVERED);
            }
            default -> throw new BusinessException("Transição de status do pedido não permitida");
        }
        preparationWorkflowService.refreshOrderStatus(order, items);
        return toResponse(order, items);
    }

    @Transactional
    public RestaurantOrderResponse cancel(Long id, OrderCancellationRequest request) {
        RestaurantOrder order = findEntityByIdForUpdate(id);
        ensureCounterOperatorAccess(order.getTab());
        Tab tab = tabRepository.findByIdForUpdate(order.getTab().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Comanda não encontrada"));
        ensureCancelable(order, tab);
        String reason = request.reason().trim();
        User actor = currentUser();

        if (order.getStatus() == OrderStatus.CANCELLED) {
            inventoryMovementService.reverseAutomaticSaleMovements(order, reason);
            return toResponse(order, orderItemRepository.findAllByOrderId(order.getId()));
        }

        List<OrderItem> items = orderItemRepository.findAllByOrderId(order.getId());
        inventoryMovementService.reverseAutomaticSaleMovements(order, reason);
        for (OrderItem item : items) {
            if (item.getStatus() == OrderItemStatus.CANCELED) continue;
            cancelItemState(item, reason, actor);
        }
        order.setStatus(OrderStatus.CANCELLED);
        order.setCancellationReason(reason);
        order.setCancelledByUser(actor);
        accountingService.refreshAmounts(tab);
        return toResponse(order, items);
    }

    @Transactional
    public RestaurantOrderResponse cancelItem(Long orderId, Long itemId, OrderCancellationRequest request) {
        RestaurantOrder order = findEntityByIdForUpdate(orderId);
        ensureCounterOperatorAccess(order.getTab());
        Tab tab = tabRepository.findByIdForUpdate(order.getTab().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Comanda não encontrada"));
        ensureCancelable(order, tab);
        OrderItem item = orderItemRepository.findByIdAndOrderId(itemId, orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Item do pedido não encontrado"));
        String reason = request.reason().trim();

        if (item.getStatus() != OrderItemStatus.CANCELED) {
            inventoryMovementService.reverseAutomaticSaleMovements(order, item, reason);
            cancelItemState(item, reason, currentUser());
        }
        List<OrderItem> items = orderItemRepository.findAllByOrderId(orderId);
        preparationWorkflowService.refreshOrderStatus(order, items);
        if (order.getStatus() == OrderStatus.CANCELLED) {
            order.setCancellationReason(reason);
            order.setCancelledByUser(currentUser());
        }
        accountingService.refreshAmounts(tab);
        return toResponse(order, items);
    }

    private List<OrderItem> saveRequestedItems(RestaurantOrder order, List<OrderItemRequest> requests) {
        return requests.stream()
                .map(request -> buildOrderItem(order, request))
                .map(orderItemRepository::save)
                .toList();
    }

    private OrderItem buildOrderItem(RestaurantOrder order, OrderItemRequest request) {
        ProductVariant variant = productVariantService.findSellableVariant(request.productId(), request.variantId());
        Product product = variant.getProduct();
        List<ProductOption> selectedOptions = productOptionService.validateSelections(product.getId(), request.optionIds());
        BigDecimal additionalPrice = selectedOptions.stream()
                .map(ProductOption::getAdditionalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal unitPrice = variant.getPrice().add(additionalPrice);

        OrderItem item = OrderItem.builder()
                .order(order)
                .product(product)
                .productVariant(variant)
                .productNameSnapshot(product.getName())
                .productVariantNameSnapshot(variant.getName())
                .categoryNameSnapshot(product.getCategory().getName())
                .preparationFlowSnapshot(product.getPreparationFlow())
                .unitPriceSnapshot(unitPrice)
                .quantity(request.quantity())
                .notes(normalizeOptional(request.notes()))
                .status(OrderItemStatus.DRAFT)
                .subtotal(unitPrice.multiply(BigDecimal.valueOf(request.quantity())))
                .build();
        selectedOptions.forEach(option -> item.addOption(OrderItemOption.builder()
                .productOption(option)
                .groupNameSnapshot(option.getGroup().getName())
                .optionNameSnapshot(option.getName())
                .additionalPriceSnapshot(option.getAdditionalPrice())
                .build()));
        return item;
    }

    private void transitionAll(List<OrderItem> items, OrderItemStatus current, OrderItemStatus next) {
        List<OrderItem> applicable = items.stream().filter(item -> item.getStatus() == current).toList();
        if (applicable.isEmpty()) throw new BusinessException("Pedido não possui itens nesta etapa");
        applicable.forEach(item -> item.setStatus(next));
    }

    private void cancelItemState(OrderItem item, String reason, User actor) {
        item.setStatus(OrderItemStatus.CANCELED);
        item.setCancellationReason(reason);
        item.setCancelledAt(LocalDateTime.now());
        item.setCancelledByUser(actor);
    }

    private void ensureCancelable(RestaurantOrder order, Tab tab) {
        if (order.getStatus() == OrderStatus.DELIVERED) {
            throw new BusinessException("Pedido entregue n\u00e3o pode ser cancelado");
        }
        if (tab.getStatus() == TabStatus.CLOSED) {
            throw new BusinessException("Pedido de comanda fechada não pode ser cancelado");
        }
        if (paymentRepository.existsByTabId(tab.getId())) {
            throw new BusinessException("N\u00e3o \u00e9 poss\u00edvel cancelar um pedido de uma comanda com pagamentos registrados");
        }
    }

    private void ensureTabCanReceiveOrder(Tab tab) {
        if (tab.getStatus() != TabStatus.OPEN) {
            throw new BusinessException("Comanda fechada ou cancelada não pode receber pedido");
        }
    }

    private void ensureOrderTabOpen(RestaurantOrder order) {
        ensureTabCanReceiveOrder(order.getTab());
    }

    private RestaurantOrder findEntityById(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido não encontrado"));
    }

    private RestaurantOrder findEntityByIdForUpdate(Long id) {
        return orderRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido não encontrado"));
    }

    private User currentUser() {
        return authenticatedUserProvider.currentUser()
                .orElseThrow(() -> new BusinessException("Usuário autenticado é obrigatório"));
    }

    private boolean canCurrentUserAccess(RestaurantOrder order) {
        return order.getTab().getType() != TabType.COUNTER
                || authenticatedUserProvider.currentUser().isEmpty()
                || authenticatedUserProvider.currentUserHasAnyRole("OWNER", "ADMIN", "CASHIER");
    }

    private void ensureCounterOperatorAccess(Tab tab) {
        if (tab.getType() == TabType.COUNTER
                && authenticatedUserProvider.currentUser().isPresent()
                && !authenticatedUserProvider.currentUserHasAnyRole("OWNER", "ADMIN", "CASHIER")) {
            throw new AccessDeniedException("Acesso ao atendimento de balcão não permitido");
        }
    }

    private void ensureItemTransitionAccess(RestaurantOrder order, OrderItemStatus target) {
        boolean kitchenOnly = authenticatedUserProvider.currentUserHasAnyRole("KITCHEN")
                && !authenticatedUserProvider.currentUserHasAnyRole("OWNER", "ADMIN");
        if (kitchenOnly && target != OrderItemStatus.READY) {
            throw new AccessDeniedException("O perfil de preparo pode somente marcar itens em preparo como prontos");
        }
        if (order.getTab().getType() == TabType.COUNTER
                && !kitchenOnly
                && authenticatedUserProvider.currentUser().isPresent()
                && !authenticatedUserProvider.currentUserHasAnyRole("OWNER", "ADMIN", "CASHIER")) {
            throw new AccessDeniedException("Acesso ao atendimento de balcão não permitido");
        }
    }

    private void ensureCounterPaidBeforeDelivery(Tab tab) {
        if (tab.getType() != TabType.COUNTER) return;
        accountingService.refreshAmounts(tab);
        if (accountingService.remainingAmount(tab).signum() > 0) {
            throw new BusinessException("Quite a venda de balcão antes de marcar itens como entregues");
        }
    }

    private RestaurantOrderResponse toResponse(RestaurantOrder order, List<OrderItem> items) {
        return new RestaurantOrderResponse(
                order.getId(),
                order.getTab().getId(),
                order.getTab().getStatus(),
                order.getTab().getType(),
                tabDisplayLabel(order.getTab()),
                order.getTab().getRestaurantTable() == null ? null : order.getTab().getRestaurantTable().getId(),
                order.getTab().getRestaurantTable() == null ? null : order.getTab().getRestaurantTable().getNumber(),
                order.getStatus(),
                order.getType(),
                order.getCreatedByUser().getId(),
                order.getCreatedByUser().getName(),
                order.getNotes(),
                order.getConfirmedAt(),
                order.getCancellationReason(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                items.stream().map(this::toItemResponse).toList()
        );
    }

    private OrderType orderTypeFor(Tab tab) {
        return tab.getType() == TabType.COUNTER ? OrderType.COUNTER : OrderType.TABLE;
    }

    private String tabDisplayLabel(Tab tab) {
        if (tab.getType() == TabType.COUNTER) {
            String customer = normalizeOptional(tab.getCustomerName());
            return customer == null ? "Balcão #" + tab.getId() : "Balcão #" + tab.getId() + " - " + customer;
        }
        return "Mesa " + tab.getRestaurantTable().getNumber();
    }

    private OrderItemResponse toItemResponse(OrderItem item) {
        ProductVariant variant = item.getProductVariant();
        return new OrderItemResponse(
                item.getId(),
                item.getProduct().getId(),
                variant == null ? null : variant.getId(),
                item.getProductNameSnapshot(),
                item.getProductVariantNameSnapshot(),
                displayName(item),
                item.getCategoryNameSnapshot(),
                item.getPreparationFlowSnapshot(),
                item.getUnitPriceSnapshot(),
                item.getQuantity(),
                item.getNotes(),
                item.getStatus(),
                item.getSubtotal(),
                item.getOptions().stream().map(option -> new OrderItemOptionResponse(
                        option.getId(),
                        option.getProductOption() == null ? null : option.getProductOption().getId(),
                        option.getGroupNameSnapshot(),
                        option.getOptionNameSnapshot(),
                        option.getAdditionalPriceSnapshot()
                )).toList(),
                item.getCancellationReason()
        );
    }

    private String displayName(OrderItem item) {
        String variantName = item.getProductVariantNameSnapshot();
        if (variantName == null || "Padrao".equalsIgnoreCase(variantName) || "Padrão".equalsIgnoreCase(variantName)) {
            return item.getProductNameSnapshot();
        }
        return item.getProductNameSnapshot() + " - " + variantName;
    }

    private String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
