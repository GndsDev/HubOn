package com.hubon.backend.order.service;

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
import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.repository.ProductRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.repository.TabRepository;
import com.hubon.backend.tab.service.TabAccountingService;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RestaurantOrderService {

    private final RestaurantOrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final TabRepository tabRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final TabAccountingService accountingService;

    @Transactional(readOnly = true)
    public List<RestaurantOrderResponse> listAll() {
        return orderRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(order -> toResponse(order, orderItemRepository.findAllByOrderId(order.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public RestaurantOrderResponse getById(Long id) {
        RestaurantOrder order = findEntityById(id);
        return toResponse(order, orderItemRepository.findAllByOrderId(order.getId()));
    }

    @Transactional
    public RestaurantOrderResponse create(RestaurantOrderRequest request) {
        Tab tab = tabRepository.findById(request.tabId())
                .orElseThrow(() -> new ResourceNotFoundException("Comanda não encontrada"));
        User createdByUser = userRepository.findById(request.createdByUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));

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

        accountingService.refreshAmounts(tab);

        return toResponse(savedOrder, savedItems);
    }

    @Transactional
    public RestaurantOrderResponse sendToKitchen(Long id) {
        RestaurantOrder order = findEntityById(id);
        ensureOrderTabOpen(order);
        if (order.getStatus() != OrderStatus.CREATED) {
            throw new BusinessException("Somente pedidos criados podem ser enviados à cozinha");
        }

        order.setStatus(OrderStatus.SENT_TO_KITCHEN);
        return toResponse(order, orderItemRepository.findAllByOrderId(order.getId()));
    }

    @Transactional
    public RestaurantOrderResponse updateStatus(Long id, OrderStatusRequest request) {
        RestaurantOrder order = findEntityById(id);
        ensureOrderTabOpen(order);

        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new BusinessException("Pedido cancelado não pode ter status alterado");
        }

        if (request.status() == OrderStatus.CANCELLED) {
            return cancel(id);
        }

        OrderStatus expectedNextStatus = switch (order.getStatus()) {
            case SENT_TO_KITCHEN -> OrderStatus.PREPARING;
            case PREPARING -> OrderStatus.READY;
            case READY -> OrderStatus.DELIVERED;
            default -> null;
        };

        if (expectedNextStatus == null || request.status() != expectedNextStatus) {
            throw new BusinessException("Transição de status do pedido não permitida");
        }

        order.setStatus(request.status());
        return toResponse(order, orderItemRepository.findAllByOrderId(order.getId()));
    }

    @Transactional
    public RestaurantOrderResponse cancel(Long id) {
        RestaurantOrder order = findEntityById(id);
        ensureOrderTabOpen(order);

        if (order.getStatus() == OrderStatus.DELIVERED) {
            throw new BusinessException("Pedido entregue não pode ser cancelado");
        }
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new BusinessException("Pedido já está cancelado");
        }

        order.setStatus(OrderStatus.CANCELLED);
        accountingService.refreshAmounts(order.getTab());

        return toResponse(order, orderItemRepository.findAllByOrderId(order.getId()));
    }

    private OrderItem buildOrderItem(RestaurantOrder order, OrderItemRequest itemRequest) {
        Product product = productRepository.findById(itemRequest.productId())
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado"));

        if (!Boolean.TRUE.equals(product.getActive())) {
            throw new BusinessException("Produto inativo não pode ser vendido");
        }

        BigDecimal unitPrice = product.getPrice();
        BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(itemRequest.quantity()));

        return OrderItem.builder()
                .order(order)
                .product(product)
                .productNameSnapshot(product.getName())
                .unitPriceSnapshot(unitPrice)
                .quantity(itemRequest.quantity())
                .notes(itemRequest.notes())
                .status(OrderItemStatus.ACTIVE)
                .subtotal(subtotal)
                .build();
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

    private RestaurantOrderResponse toResponse(RestaurantOrder order, List<OrderItem> items) {
        return new RestaurantOrderResponse(
                order.getId(),
                order.getTab().getId(),
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
        return new OrderItemResponse(
                item.getId(),
                item.getProduct().getId(),
                item.getProductNameSnapshot(),
                item.getUnitPriceSnapshot(),
                item.getQuantity(),
                item.getNotes(),
                item.getStatus(),
                item.getSubtotal()
        );
    }
}
