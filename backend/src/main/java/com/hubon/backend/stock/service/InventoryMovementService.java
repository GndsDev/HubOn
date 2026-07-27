package com.hubon.backend.stock.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.order.domain.OrderItem;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.RestaurantOrder;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
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
        return registerMovement(request.ingredientId(), InventoryMovementType.ENTRY, request.quantity(), request.reason());
    }

    @Transactional
    public InventoryMovementResponse registerExit(StockExitRequest request) {
        return registerMovement(request.ingredientId(), InventoryMovementType.EXIT, request.quantity(), request.reason());
    }

    @Transactional
    public InventoryMovementResponse registerLoss(StockLossRequest request) {
        requireReason(request.reason(), "Motivo da perda e obrigatorio");
        return registerMovement(request.ingredientId(), InventoryMovementType.LOSS, request.quantity(), request.reason());
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
                .reason(request.reason().trim())
                .originType(InventoryMovementOriginType.MANUAL)
                .user(currentUser())
                .build();
        return toResponse(movementRepository.save(movement));
    }

    @Transactional
    public void applyAutomaticSaleMovements(RestaurantOrder order, List<OrderItem> items) {
        List<OrderItem> candidates = items.stream()
                .filter(item -> item.getStatus() == OrderItemStatus.DRAFT)
                .filter(item -> item.getProductVariant() != null)
                .toList();
        if (candidates.isEmpty()) return;

        Map<Long, ProductStockLink> linksByVariantId = productStockLinkRepository
                .findAllByProductVariantIdInAndActiveTrue(
                        candidates.stream().map(item -> item.getProductVariant().getId()).toList()
                )
                .stream()
                .collect(Collectors.toMap(link -> link.getProductVariant().getId(), link -> link));

        List<PendingSale> pendingSales = new ArrayList<>();
        for (OrderItem item : candidates) {
            ProductStockLink link = linksByVariantId.get(item.getProductVariant().getId());
            if (link == null) continue;
            Long stockItemId = link.getStockItem().getId();
            if (movementRepository.existsByIngredientIdAndOrderItemIdAndOriginTypeAndType(
                    stockItemId,
                    item.getId(),
                    InventoryMovementOriginType.ORDER_ITEM,
                    InventoryMovementType.SALE
            )) {
                continue;
            }
            pendingSales.add(new PendingSale(
                    item,
                    stockItemId,
                    link.getQuantityPerSale().multiply(BigDecimal.valueOf(item.getQuantity()))
            ));
        }
        if (pendingSales.isEmpty()) return;

        Map<Long, BigDecimal> requiredByStockItem = pendingSales.stream()
                .collect(Collectors.groupingBy(
                        PendingSale::stockItemId,
                        LinkedHashMap::new,
                        Collectors.reducing(BigDecimal.ZERO, PendingSale::quantity, BigDecimal::add)
                ));
        Map<Long, Ingredient> lockedItems = new LinkedHashMap<>();
        List<String> shortages = new ArrayList<>();

        requiredByStockItem.keySet().stream().sorted().forEach(stockItemId -> {
            Ingredient stockItem = findIngredientForUpdate(stockItemId);
            ensureActive(stockItem);
            ensureDirectSale(stockItem);
            lockedItems.put(stockItemId, stockItem);

            BigDecimal required = requiredByStockItem.get(stockItemId);
            BigDecimal available = valueOrZero(stockItem.getCurrentStock());
            if (available.compareTo(required) < 0) {
                String products = pendingSales.stream()
                        .filter(pending -> pending.stockItemId().equals(stockItemId))
                        .map(pending -> displayName(pending.item()))
                        .distinct()
                        .collect(Collectors.joining(", "));
                shortages.add(insufficientStockMessage(products, stockItem, available, required));
            }
        });

        if (!shortages.isEmpty()) {
            throw new BusinessException(String.join("\n", shortages));
        }

        User user = orderActor(order);
        pendingSales.stream()
                .sorted(Comparator.comparing(PendingSale::stockItemId).thenComparing(pending -> pending.item().getId()))
                .forEach(pending -> {
                    Ingredient stockItem = lockedItems.get(pending.stockItemId());
                    BigDecimal previousStock = valueOrZero(stockItem.getCurrentStock());
                    BigDecimal resultingStock = previousStock.subtract(pending.quantity());
                    stockItem.setCurrentStock(resultingStock);
                    movementRepository.save(InventoryMovement.builder()
                            .ingredient(stockItem)
                            .type(InventoryMovementType.SALE)
                            .quantity(pending.quantity())
                            .previousStock(previousStock)
                            .resultingStock(resultingStock)
                            .reason("Baixa automatica na confirmacao do pedido #" + order.getId())
                            .originType(InventoryMovementOriginType.ORDER_ITEM)
                            .originReference("ORDER-" + order.getId() + "/ITEM-" + pending.item().getId())
                            .order(order)
                            .orderItem(pending.item())
                            .user(user)
                            .build());
                });
    }

    @Transactional
    public void reverseAutomaticSaleMovements(RestaurantOrder order, String reason) {
        List<InventoryMovement> sales = movementRepository
                .findAllByOrderIdAndOriginTypeAndTypeOrderByCreatedAtAsc(
                        order.getId(),
                        InventoryMovementOriginType.ORDER_ITEM,
                        InventoryMovementType.SALE
                );
        reverseSales(order, sales, reason);
    }

    @Transactional
    public void reverseAutomaticSaleMovements(RestaurantOrder order, OrderItem item, String reason) {
        List<InventoryMovement> sales = movementRepository
                .findAllByOrderItemIdAndOriginTypeAndTypeOrderByCreatedAtAsc(
                        item.getId(),
                        InventoryMovementOriginType.ORDER_ITEM,
                        InventoryMovementType.SALE
                );
        reverseSales(order, sales, reason);
    }

    @Transactional(readOnly = true)
    public List<InventoryMovementResponse> listRecent() {
        return movementRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, RECENT_LIMIT))
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<InventoryMovementResponse> listByIngredient(Long ingredientId) {
        if (!ingredientRepository.existsById(ingredientId)) {
            throw new ResourceNotFoundException("Ingrediente nao encontrado");
        }
        return movementRepository
                .findAllByIngredientIdOrderByCreatedAtDesc(ingredientId, PageRequest.of(0, RECENT_LIMIT))
                .stream().map(this::toResponse).toList();
    }

    private void reverseSales(RestaurantOrder order, List<InventoryMovement> sales, String reason) {
        if (sales.isEmpty()) return;
        User user = orderActor(order);
        List<InventoryMovement> orderedSales = sales.stream()
                .sorted(Comparator.comparing((InventoryMovement sale) -> sale.getIngredient().getId())
                        .thenComparing(sale -> sale.getOrderItem().getId()))
                .toList();
        for (InventoryMovement sale : orderedSales) {
            Long orderItemId = sale.getOrderItem() == null ? null : sale.getOrderItem().getId();
            if (orderItemId == null || movementRepository.existsByIngredientIdAndOrderItemIdAndOriginTypeAndType(
                    sale.getIngredient().getId(),
                    orderItemId,
                    InventoryMovementOriginType.ORDER_CANCELLATION,
                    InventoryMovementType.REVERSAL
            )) {
                continue;
            }

            Ingredient stockItem = findIngredientForUpdate(sale.getIngredient().getId());
            BigDecimal previousStock = valueOrZero(stockItem.getCurrentStock());
            BigDecimal resultingStock = previousStock.add(sale.getQuantity());
            stockItem.setCurrentStock(resultingStock);
            movementRepository.save(InventoryMovement.builder()
                    .ingredient(stockItem)
                    .type(InventoryMovementType.REVERSAL)
                    .quantity(sale.getQuantity())
                    .previousStock(previousStock)
                    .resultingStock(resultingStock)
                    .reason("Estorno do pedido #" + order.getId() + ": " + reason.trim())
                    .originType(InventoryMovementOriginType.ORDER_CANCELLATION)
                    .originReference("ORDER-" + order.getId() + "/ITEM-" + orderItemId)
                    .order(order)
                    .orderItem(sale.getOrderItem())
                    .user(user)
                    .build());
        }
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
            case ADJUSTMENT, SALE, REVERSAL -> throw new BusinessException("Tipo de movimentacao nao suportado neste fluxo");
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
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) throw new BusinessException(message);
    }

    private void validateNonNegative(BigDecimal value, String message) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) throw new BusinessException(message);
    }

    private void requireReason(String reason, String message) {
        if (!StringUtils.hasText(reason)) throw new BusinessException(message);
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

    private String insufficientStockMessage(
            String productNames,
            Ingredient ingredient,
            BigDecimal available,
            BigDecimal required
    ) {
        return "Estoque insuficiente para %s. Disponivel: %s %s. Necessario: %s %s."
                .formatted(
                        productNames,
                        formatQuantity(available),
                        StockUnitFormatter.label(ingredient.getUnit()),
                        formatQuantity(required),
                        StockUnitFormatter.label(ingredient.getUnit())
                );
    }

    private String displayName(OrderItem item) {
        String variantName = item.getProductVariantNameSnapshot();
        return variantName == null || "Padrao".equalsIgnoreCase(variantName) || "Padrão".equalsIgnoreCase(variantName)
                ? item.getProductNameSnapshot()
                : item.getProductNameSnapshot() + " - " + variantName;
    }

    private String formatQuantity(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private record PendingSale(OrderItem item, Long stockItemId, BigDecimal quantity) {
    }
}
