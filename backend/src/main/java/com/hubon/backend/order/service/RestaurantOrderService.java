package com.hubon.backend.order.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.order.domain.OrderItem;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.domain.OrderType;
import com.hubon.backend.order.domain.RestaurantOrder;
import com.hubon.backend.order.dto.OrderItemRequest;
import com.hubon.backend.order.dto.OrderItemResponse;
import com.hubon.backend.order.dto.OrderStatusRequest;
import com.hubon.backend.order.dto.RestaurantOrderRequest;
import com.hubon.backend.order.dto.RestaurantOrderResponse;
import com.hubon.backend.order.repository.OrderItemRepository;
import com.hubon.backend.order.repository.RestaurantOrderRepository;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.product.domain.PreparationFlow;
import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.domain.ProductVariant;
import com.hubon.backend.product.service.ProductVariantService;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.service.InventoryMovementService;
import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.repository.TabRepository;
import com.hubon.backend.tab.service.TabAccountingService;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collections;
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
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final TabAccountingService accountingService;
    private final AuthenticatedUserProvider authenticatedUserProvider;
    private final InventoryMovementService inventoryMovementService;

    @Transactional(readOnly = true)
    public List<RestaurantOrderResponse> listAll() {
        List<RestaurantOrder> orders = orderRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 100));
        if (orders.isEmpty()) {
            return List.of();
        }

        Map<Long, List<OrderItem>> itemsByOrder = orderItemRepository
                .findAllByOrderIdIn(orders.stream().map(RestaurantOrder::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(item -> item.getOrder().getId()));

        return orders.stream()
                .map(order -> toResponse(order, itemsByOrder.getOrDefault(order.getId(), Collections.emptyList())))
                .toList();
    }

    @Transactional(readOnly = true)
    public RestaurantOrderResponse getById(Long id) {
        RestaurantOrder order = findEntityById(id);
        return toResponse(order, orderItemRepository.findAllByOrderId(order.getId()));
    }

    @Transactional
    public RestaurantOrderResponse create(RestaurantOrderRequest request) {
        Tab tab = tabRepository.findByIdForUpdate(request.tabId())
                .orElseThrow(() -> new ResourceNotFoundException("Comanda nao encontrada"));
        User createdByUser = authenticatedUserProvider.currentUser()
                .orElseGet(() -> findRequestedUser(request.createdByUserId()));

        ensureTabCanReceiveOrder(tab);

        RestaurantOrder order = RestaurantOrder.builder()
                .tab(tab)
                .createdByUser(createdByUser)
                .status(OrderStatus.CREATED)
                .type(request.type() == null ? OrderType.TABLE : request.type())
                .notes(request.notes())
                .build();

        RestaurantOrder savedOrder = orderRepository.save(order);
        List<OrderItem> savedItems = request.items()
                .stream()
                .map(itemRequest -> buildOrderItem(savedOrder, itemRequest))
                .map(orderItemRepository::save)
                .toList();

        inventoryMovementService.applyAutomaticSaleMovements(savedOrder, savedItems, PreparationFlow.DIRECT_SERVICE);
        if (hasActiveItems(savedItems) && !hasKitchenItems(savedItems)) {
            savedOrder.setStatus(OrderStatus.READY);
        }

        accountingService.refreshAmounts(tab);

        return toResponse(savedOrder, savedItems);
    }

    @Transactional
    public RestaurantOrderResponse sendToKitchen(Long id) {
        RestaurantOrder order = findEntityByIdForUpdate(id);
        ensureOrderTabOpen(order);
        List<OrderItem> items = orderItemRepository.findAllByOrderId(order.getId());
        if (order.getStatus() == OrderStatus.SENT_TO_KITCHEN) {
            return toResponse(order, items);
        }
        if (order.getStatus() != OrderStatus.CREATED) {
            throw new BusinessException("Somente pedidos criados podem ser enviados a cozinha");
        }

        if (!hasKitchenItems(items)) {
            order.setStatus(OrderStatus.READY);
            return toResponse(order, items);
        }

        inventoryMovementService.applyAutomaticSaleMovements(order, items, PreparationFlow.KITCHEN);
        order.setStatus(OrderStatus.SENT_TO_KITCHEN);
        return toResponse(order, items);
    }

    @Transactional
    public RestaurantOrderResponse updateStatus(Long id, OrderStatusRequest request) {
        RestaurantOrder order = findEntityById(id);
        ensureOrderTabOpen(order);

        if (request.status() == OrderStatus.CANCELLED) {
            return cancel(id);
        }

        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new BusinessException("Pedido cancelado nao pode ter status alterado");
        }

        OrderStatus expectedNextStatus = switch (order.getStatus()) {
            case SENT_TO_KITCHEN -> OrderStatus.PREPARING;
            case PREPARING -> OrderStatus.READY;
            case READY -> OrderStatus.DELIVERED;
            default -> null;
        };

        if (expectedNextStatus == null || request.status() != expectedNextStatus) {
            throw new BusinessException("Transicao de status do pedido nao permitida");
        }

        order.setStatus(request.status());
        return toResponse(order, orderItemRepository.findAllByOrderId(order.getId()));
    }

    @Transactional
    public RestaurantOrderResponse cancel(Long id) {
        RestaurantOrder order = findEntityByIdForUpdate(id);
        Tab tab = tabRepository.findByIdForUpdate(order.getTab().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Comanda nao encontrada"));

        if (order.getStatus() == OrderStatus.DELIVERED) {
            throw new BusinessException("Pedido entregue não pode ser cancelado");
        }
        if (order.getStatus() == OrderStatus.CANCELLED) {
            inventoryMovementService.reverseAutomaticSaleMovements(order);
            return toResponse(order, orderItemRepository.findAllByOrderId(order.getId()));
        }
        if (tab.getStatus() == TabStatus.CLOSED) {
            throw new BusinessException("Pedido de comanda fechada nao pode ser cancelado");
        }
        if (paymentRepository.existsByTabId(tab.getId())) {
            throw new BusinessException("Não é possível cancelar um pedido de uma comanda com pagamentos registrados");
        }

        inventoryMovementService.reverseAutomaticSaleMovements(order);
        order.setStatus(OrderStatus.CANCELLED);
        accountingService.refreshAmounts(tab);

        return toResponse(order, orderItemRepository.findAllByOrderId(order.getId()));
    }

    private OrderItem buildOrderItem(RestaurantOrder order, OrderItemRequest itemRequest) {
        ProductVariant variant = productVariantService.findSellableVariant(itemRequest.productId(), itemRequest.variantId());
        Product product = variant.getProduct();

        BigDecimal unitPrice = variant.getPrice();
        BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(itemRequest.quantity()));

        return OrderItem.builder()
                .order(order)
                .product(product)
                .productVariant(variant)
                .productNameSnapshot(product.getName())
                .productVariantNameSnapshot(variant.getName())
                .unitPriceSnapshot(unitPrice)
                .quantity(itemRequest.quantity())
                .notes(itemRequest.notes())
                .status(OrderItemStatus.ACTIVE)
                .subtotal(subtotal)
                .build();
    }

    private void ensureTabCanReceiveOrder(Tab tab) {
        if (tab.getStatus() != TabStatus.OPEN) {
            throw new BusinessException("Comanda fechada ou cancelada nao pode receber pedido");
        }
    }

    private void ensureOrderTabOpen(RestaurantOrder order) {
        ensureTabCanReceiveOrder(order.getTab());
    }

    private RestaurantOrder findEntityById(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido nao encontrado"));
    }

    private RestaurantOrder findEntityByIdForUpdate(Long id) {
        return orderRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido nao encontrado"));
    }

    private User findRequestedUser(Long userId) {
        if (userId == null) {
            throw new BusinessException("Usuario responsavel e obrigatorio");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario nao encontrado"));
    }

    private RestaurantOrderResponse toResponse(RestaurantOrder order, List<OrderItem> items) {
        return new RestaurantOrderResponse(
                order.getId(),
                order.getTab().getId(),
                order.getTab().getStatus(),
                order.getTab().getRestaurantTable().getId(),
                order.getTab().getRestaurantTable().getNumber(),
                order.getStatus(),
                order.getType(),
                order.getCreatedByUser().getId(),
                order.getCreatedByUser().getName(),
                order.getNotes(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                items.stream().map(this::toItemResponse).toList()
        );
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
                item.getProduct().getPreparationFlow(),
                item.getUnitPriceSnapshot(),
                item.getQuantity(),
                item.getNotes(),
                item.getStatus(),
                item.getSubtotal()
        );
    }

    private boolean hasActiveItems(List<OrderItem> items) {
        return items.stream().anyMatch(item -> item.getStatus() == OrderItemStatus.ACTIVE);
    }

    private boolean hasKitchenItems(List<OrderItem> items) {
        return items.stream()
                .filter(item -> item.getStatus() == OrderItemStatus.ACTIVE)
                .anyMatch(item -> item.getProduct().getPreparationFlow() == PreparationFlow.KITCHEN);
    }

    private String displayName(OrderItem item) {
        String variantName = item.getProductVariantNameSnapshot();
        if (variantName == null || "Padrao".equalsIgnoreCase(variantName) || "Padrão".equalsIgnoreCase(variantName)) {
            return item.getProductNameSnapshot();
        }
        return item.getProductNameSnapshot() + " - " + variantName;
    }
}
