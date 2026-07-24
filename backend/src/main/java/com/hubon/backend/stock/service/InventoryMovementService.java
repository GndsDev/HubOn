package com.hubon.backend.stock.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.order.domain.OrderItem;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.RestaurantOrder;
import com.hubon.backend.product.domain.PreparationFlow;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.Ingredient;
import com.hubon.backend.stock.domain.InventoryMovement;
import com.hubon.backend.stock.domain.InventoryMovementOriginType;
import com.hubon.backend.stock.domain.InventoryMovementType;
import com.hubon.backend.stock.domain.ProductStockLink;
import com.hubon.backend.stock.domain.StockControlMode;
import com.hubon.backend.stock.dto.InventoryMovementResponse;
import com.hubon.backend.stock.dto.StockAdjustmentRequest;
import com.hubon.backend.stock.dto.StockEntryRequest;
import com.hubon.backend.stock.dto.StockExitRequest;
import com.hubon.backend.stock.dto.StockLossRequest;
import com.hubon.backend.stock.repository.IngredientRepository;
import com.hubon.backend.stock.repository.InventoryMovementRepository;
import com.hubon.backend.stock.repository.ProductStockLinkRepository;
import com.hubon.backend.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InventoryMovementService {

    private static final int RECENT_LIMIT = 100;

    private final InventoryMovementRepository movementRepository;
    private final IngredientRepository ingredientRepository;
    private final ProductStockLinkRepository productStockLinkRepository;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    @Transactional
    public InventoryMovementResponse registerEntry(StockEntryRequest request) {
        return registerMovement(
                request.ingredientId(),
                InventoryMovementType.ENTRY,
                request.quantity(),
                request.reason()
        );
    }

    @Transactional
    public InventoryMovementResponse registerExit(StockExitRequest request) {
        return registerMovement(
                request.ingredientId(),
                InventoryMovementType.EXIT,
                request.quantity(),
                request.reason()
        );
    }

    @Transactional
    public InventoryMovementResponse registerLoss(StockLossRequest request) {
        requireReason(request.reason(), "Motivo da perda e obrigatorio");
        return registerMovement(
                request.ingredientId(),
                InventoryMovementType.LOSS,
                request.quantity(),
                request.reason()
        );
    }

    @Transactional
    public InventoryMovementResponse registerAdjustment(StockAdjustmentRequest request) {
        requireReason(request.reason(), "Motivo do ajuste e obrigatorio");
        validateNonNegative(request.newStock(), "Novo saldo nao pode ser negativo");

        Ingredient ingredient = findIngredientForUpdate(request.ingredientId());
        ensureActive(ingredient);

        BigDecimal previousStock = valueOrZero(ingredient.getCurrentStock());
        BigDecimal resultingStock = request.newStock();
        BigDecimal quantity = resultingStock.subtract(previousStock).abs();
        if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Ajuste deve alterar o saldo atual");
        }

        ingredient.setCurrentStock(resultingStock);

        InventoryMovement movement = InventoryMovement.builder()
                .ingredient(ingredient)
                .type(InventoryMovementType.ADJUSTMENT)
                .quantity(quantity)
                .previousStock(previousStock)
                .resultingStock(resultingStock)
                .reason(request.reason())
                .originType(InventoryMovementOriginType.MANUAL)
                .user(currentUser())
                .build();

        return toResponse(movementRepository.save(movement));
    }

    @Transactional
    public void applyAutomaticSaleMovements(RestaurantOrder order, List<OrderItem> items, PreparationFlow preparationFlow) {
        List<OrderItem> activeItems = items.stream()
                .filter(item -> item.getStatus() == OrderItemStatus.ACTIVE)
                .filter(item -> item.getProductVariant() != null)
                .filter(item -> item.getProductVariant().getProduct().getPreparationFlow() == preparationFlow)
                .toList();
        if (activeItems.isEmpty()) {
            return;
        }

        Map<Long, ProductStockLink> linksByVariantId = productStockLinkRepository
                .findAllByProductVariantIdInAndActiveTrue(
                        activeItems.stream().map(item -> item.getProductVariant().getId()).toList()
                )
                .stream()
                .collect(Collectors.toMap(link -> link.getProductVariant().getId(), link -> link));
        if (linksByVariantId.isEmpty()) {
            return;
        }

        User user = orderActor(order);
        for (OrderItem item : activeItems) {
            ProductStockLink link = linksByVariantId.get(item.getProductVariant().getId());
            if (link == null) {
                continue;
            }
            Long stockItemId = link.getStockItem().getId();
            if (movementRepository.existsByIngredientIdAndOrderItemIdAndOriginTypeAndType(
                    stockItemId,
                    item.getId(),
                    InventoryMovementOriginType.ORDER_ITEM,
                    InventoryMovementType.EXIT
            )) {
                continue;
            }

            Ingredient stockItem = findIngredientForUpdate(stockItemId);
            ensureActive(stockItem);
            ensureDirectSale(stockItem);

            BigDecimal quantity = link.getQuantityPerSale().multiply(BigDecimal.valueOf(item.getQuantity()));
            BigDecimal previousStock = valueOrZero(stockItem.getCurrentStock());
            BigDecimal resultingStock = previousStock.subtract(quantity);
            if (resultingStock.compareTo(BigDecimal.ZERO) < 0) {
                throw new BusinessException(insufficientStockMessage(stockItem, previousStock, quantity));
            }

            stockItem.setCurrentStock(resultingStock);
            movementRepository.save(InventoryMovement.builder()
                    .ingredient(stockItem)
                    .type(InventoryMovementType.EXIT)
                    .quantity(quantity)
                    .previousStock(previousStock)
                    .resultingStock(resultingStock)
                    .reason("Baixa automatica do pedido #" + order.getId())
                    .originType(InventoryMovementOriginType.ORDER_ITEM)
                    .originReference("ORDER-" + order.getId() + "/ITEM-" + item.getId())
                    .order(order)
                    .orderItem(item)
                    .user(user)
                    .build());
        }
    }

    @Transactional
    public void reverseAutomaticSaleMovements(RestaurantOrder order) {
        List<InventoryMovement> automaticExits = movementRepository
                .findAllByOrderIdAndOriginTypeAndTypeOrderByCreatedAtAsc(
                        order.getId(),
                        InventoryMovementOriginType.ORDER_ITEM,
                        InventoryMovementType.EXIT
                );
        if (automaticExits.isEmpty()) {
            return;
        }

        User user = orderActor(order);
        for (InventoryMovement exit : automaticExits) {
            Long orderItemId = exit.getOrderItem() == null ? null : exit.getOrderItem().getId();
            if (orderItemId == null || movementRepository.existsByIngredientIdAndOrderItemIdAndOriginTypeAndType(
                    exit.getIngredient().getId(),
                    orderItemId,
                    InventoryMovementOriginType.ORDER_CANCELLATION,
                    InventoryMovementType.REVERSAL
            )) {
                continue;
            }

            Ingredient stockItem = findIngredientForUpdate(exit.getIngredient().getId());
            BigDecimal previousStock = valueOrZero(stockItem.getCurrentStock());
            BigDecimal resultingStock = previousStock.add(exit.getQuantity());
            stockItem.setCurrentStock(resultingStock);

            movementRepository.save(InventoryMovement.builder()
                    .ingredient(stockItem)
                    .type(InventoryMovementType.REVERSAL)
                    .quantity(exit.getQuantity())
                    .previousStock(previousStock)
                    .resultingStock(resultingStock)
                    .reason("Estorno automatico do pedido #" + order.getId())
                    .originType(InventoryMovementOriginType.ORDER_CANCELLATION)
                    .originReference("ORDER-" + order.getId() + "/ITEM-" + orderItemId)
                    .order(order)
                    .orderItem(exit.getOrderItem())
                    .user(user)
                    .build());
        }
    }

    @Transactional(readOnly = true)
    public List<InventoryMovementResponse> listRecent() {
        return movementRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, RECENT_LIMIT))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<InventoryMovementResponse> listByIngredient(Long ingredientId) {
        if (!ingredientRepository.existsById(ingredientId)) {
            throw new ResourceNotFoundException("Ingrediente nao encontrado");
        }
        return movementRepository
                .findAllByIngredientIdOrderByCreatedAtDesc(ingredientId, PageRequest.of(0, RECENT_LIMIT))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private InventoryMovementResponse registerMovement(
            Long ingredientId,
            InventoryMovementType type,
            BigDecimal quantity,
            String reason
    ) {
        validatePositive(quantity, "Quantidade deve ser maior que zero");

        Ingredient ingredient = findIngredientForUpdate(ingredientId);
        ensureActive(ingredient);

        BigDecimal previousStock = valueOrZero(ingredient.getCurrentStock());
        BigDecimal resultingStock = switch (type) {
            case ENTRY -> previousStock.add(quantity);
            case EXIT, LOSS -> previousStock.subtract(quantity);
            case ADJUSTMENT, REVERSAL -> throw new BusinessException("Tipo de movimentacao nao suportado neste fluxo");
        };
        validateNonNegative(resultingStock, "Estoque nao pode ficar negativo");

        ingredient.setCurrentStock(resultingStock);

        InventoryMovement movement = InventoryMovement.builder()
                .ingredient(ingredient)
                .type(type)
                .quantity(quantity)
                .previousStock(previousStock)
                .resultingStock(resultingStock)
                .reason(reason)
                .originType(InventoryMovementOriginType.MANUAL)
                .user(currentUser())
                .build();

        return toResponse(movementRepository.save(movement));
    }

    private Ingredient findIngredientForUpdate(Long ingredientId) {
        return ingredientRepository.findByIdForUpdate(ingredientId)
                .orElseThrow(() -> new ResourceNotFoundException("Ingrediente nao encontrado"));
    }

    private void ensureActive(Ingredient ingredient) {
        if (!Boolean.TRUE.equals(ingredient.getActive())) {
            throw new BusinessException("Ingrediente inativo nao pode movimentar estoque");
        }
    }

    private void ensureDirectSale(Ingredient ingredient) {
        if (ingredient.getControlMode() != StockControlMode.DIRECT_SALE) {
            throw new BusinessException("Item de estoque manual nao pode sofrer baixa automatica por pedido");
        }
    }

    private User currentUser() {
        return authenticatedUserProvider.currentUser()
                .orElseThrow(() -> new BusinessException("Usuario autenticado e obrigatorio para movimentar estoque"));
    }

    private User orderActor(RestaurantOrder order) {
        return authenticatedUserProvider.currentUser().orElse(order.getCreatedByUser());
    }

    private void validatePositive(BigDecimal value, String message) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(message);
        }
    }

    private void validateNonNegative(BigDecimal value, String message) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(message);
        }
    }

    private void requireReason(String reason, String message) {
        if (!StringUtils.hasText(reason)) {
            throw new BusinessException(message);
        }
    }

    private InventoryMovementResponse toResponse(InventoryMovement movement) {
        return new InventoryMovementResponse(
                movement.getId(),
                movement.getIngredient().getId(),
                movement.getIngredient().getName(),
                movement.getType(),
                movement.getQuantity(),
                movement.getPreviousStock(),
                movement.getResultingStock(),
                movement.getReason(),
                movement.getOriginType(),
                movement.getOrder() == null ? null : movement.getOrder().getId(),
                movement.getOrderItem() == null ? null : movement.getOrderItem().getId(),
                movement.getOriginReference(),
                movement.getUser().getId(),
                movement.getUser().getName(),
                movement.getCreatedAt()
        );
    }

    private String insufficientStockMessage(Ingredient ingredient, BigDecimal available, BigDecimal required) {
        return "Estoque insuficiente para %s. Disponivel: %s %s. Necessario: %s %s."
                .formatted(
                        ingredient.getName(),
                        formatQuantity(available),
                        StockUnitFormatter.label(ingredient.getUnit()),
                        formatQuantity(required),
                        StockUnitFormatter.label(ingredient.getUnit())
                );
    }

    private String formatQuantity(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
