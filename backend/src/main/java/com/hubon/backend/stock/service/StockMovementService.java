package com.hubon.backend.stock.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.product.domain.ProductOption;
import com.hubon.backend.sale.domain.SaleItem;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.*;
import com.hubon.backend.stock.dto.*;
import com.hubon.backend.stock.repository.ProductStockLinkRepository;
import com.hubon.backend.stock.repository.ProductOptionStockLinkRepository;
import com.hubon.backend.stock.repository.StockItemRepository;
import com.hubon.backend.stock.repository.StockMovementRepository;
import com.hubon.backend.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
@RequiredArgsConstructor
public class StockMovementService {
    private final StockMovementRepository movementRepository;
    private final StockItemRepository stockItemRepository;
    private final ProductStockLinkRepository linkRepository;
    private final ProductOptionStockLinkRepository optionLinkRepository;
    private final AuthenticatedUserProvider authenticatedUserProvider;
    private final Clock businessClock;

    @Transactional(readOnly = true)
    public List<StockMovementResponse> listRecent() {
        return movementRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 200)).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<StockMovementResponse> listByStockItem(Long stockItemId) {
        return movementRepository.findAllByStockItemIdOrderByCreatedAtDesc(stockItemId, PageRequest.of(0, 200))
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public StockMovementResponse entry(StockEntryRequest request) {
        return toResponse(manual(request.stockItemId(), StockMovementType.ENTRY, request.quantity(), request.reason()));
    }

    @Transactional
    public StockMovement entryForExpense(Long stockItemId, BigDecimal quantity, String reason, User user) {
        if (quantity == null || quantity.signum() <= 0) {
            throw new BusinessException("A quantidade de entrada deve ser maior que zero");
        }
        StockItem item = findForUpdate(stockItemId);
        if (!Boolean.TRUE.equals(item.getActive())) {
            throw new BusinessException("Item de estoque está inativo: " + item.getName());
        }
        return record(item, StockMovementType.ENTRY, quantity, null, null, normalize(reason), user);
    }

    @Transactional
    public StockMovementResponse exit(StockExitRequest request) {
        return toResponse(manual(request.stockItemId(), StockMovementType.EXIT, request.quantity().negate(), request.reason()));
    }

    @Transactional
    public StockMovementResponse loss(StockLossRequest request) {
        return toResponse(manual(request.stockItemId(), StockMovementType.LOSS, request.quantity().negate(), request.reason()));
    }

    @Transactional
    public StockMovementResponse adjust(StockAdjustmentRequest request) {
        StockItem item = findForUpdate(request.stockItemId());
        BigDecimal delta = request.newStock().subtract(item.getCurrentStock());
        if (delta.signum() == 0) throw new BusinessException("O novo saldo deve ser diferente do saldo atual");
        return toResponse(record(item, StockMovementType.ADJUSTMENT, delta, null, null, request.reason(), currentUser()));
    }

    public void applySale(SaleItem saleItem, List<ProductOption> selectedOptions, User user) {
        Map<Long, BigDecimal> quantityPerSale = new LinkedHashMap<>();
        linkRepository.findActiveConsumptionByProductId(saleItem.getProduct().getId()).ifPresent(link -> {
            quantityPerSale.merge(link.getStockItemId(), link.getQuantityPerSale(), BigDecimal::add);
        });
        if (!selectedOptions.isEmpty()) {
            optionLinkRepository.findActiveConsumptionsByProductOptionIdIn(
                            selectedOptions.stream().map(ProductOption::getId).toList())
                    .forEach(link -> quantityPerSale.merge(
                            link.getStockItemId(),
                            link.getQuantityPerSelection(),
                            BigDecimal::add
                    ));
        }

        List<PendingMovement> pending = quantityPerSale.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new PendingMovement(
                        findForUpdate(entry.getKey()),
                        entry.getValue().multiply(BigDecimal.valueOf(saleItem.getQuantity())).negate(),
                        null
                ))
                .toList();
        applyPending(saleItem, pending, user, null);
    }

    public void applySaleQuantityDelta(SaleItem saleItem, int quantityDelta, User user) {
        if (quantityDelta == 0) return;
        List<StockMovement> movements = saleMovements(saleItem);
        if (movements.isEmpty()) return;
        List<PendingMovement> pending = new ArrayList<>();
        for (Map.Entry<Long, List<StockMovement>> entry : movementsByStockItem(movements).entrySet()) {
            List<StockMovement> itemMovements = entry.getValue();
            BigDecimal consumed = netDelta(itemMovements).negate();
            if (consumed.signum() <= 0) {
                throw new BusinessException("Consumo de estoque da venda esta inconsistente");
            }
            BigDecimal quantityPerSale = consumed.divide(
                    BigDecimal.valueOf(saleItem.getQuantity()),
                    3,
                    RoundingMode.UNNECESSARY
            );
            BigDecimal stockDelta = quantityPerSale.multiply(BigDecimal.valueOf(Math.abs((long) quantityDelta)));
            pending.add(new PendingMovement(
                    findForUpdate(entry.getKey()),
                    quantityDelta > 0 ? stockDelta.negate() : stockDelta,
                    quantityDelta > 0 ? null : originalSaleMovement(itemMovements)
            ));
        }
        applyPending(saleItem, pending, user, null);
    }

    public void reverseSale(SaleItem saleItem, User user) {
        reverseSale(saleItem, user, saleItem.getCancellationReason());
    }

    public void reverseSale(SaleItem saleItem, User user, String reason) {
        List<StockMovement> movements = saleMovements(saleItem);
        if (movements.isEmpty()) return;
        List<PendingMovement> pending = new ArrayList<>();
        for (Map.Entry<Long, List<StockMovement>> entry : movementsByStockItem(movements).entrySet()) {
            List<StockMovement> itemMovements = entry.getValue();
            BigDecimal consumed = netDelta(itemMovements).negate();
            if (consumed.signum() < 0) {
                throw new BusinessException("Consumo de estoque da venda esta inconsistente");
            }
            if (consumed.signum() > 0) {
                pending.add(new PendingMovement(
                        findForUpdate(entry.getKey()),
                        consumed,
                        originalSaleMovement(itemMovements)
                ));
            }
        }
        applyPending(saleItem, pending, user, reason);
    }

    private List<StockMovement> saleMovements(SaleItem saleItem) {
        return movementRepository.findAllBySaleItemIdOrderByCreatedAtAscIdAsc(saleItem.getId());
    }

    private StockMovement originalSaleMovement(List<StockMovement> movements) {
        return movements.stream().filter(movement -> movement.getType() == StockMovementType.SALE)
                .findFirst().orElseThrow(() -> new BusinessException("Movimento original da venda nao encontrado"));
    }

    private BigDecimal netDelta(List<StockMovement> movements) {
        return movements.stream().map(StockMovement::getDeltaQuantity).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Map<Long, List<StockMovement>> movementsByStockItem(List<StockMovement> movements) {
        Map<Long, List<StockMovement>> grouped = new TreeMap<>();
        movements.forEach(movement -> grouped
                .computeIfAbsent(movement.getStockItem().getId(), ignored -> new ArrayList<>())
                .add(movement));
        return grouped;
    }

    private void applyPending(SaleItem saleItem, List<PendingMovement> pending, User user, String reason) {
        for (PendingMovement movement : pending) {
            StockItem item = movement.stockItem();
            if (movement.delta().signum() < 0 && !Boolean.TRUE.equals(item.getActive())) {
                throw new BusinessException("Item de estoque vinculado esta inativo: " + item.getName());
            }
            if (item.getCurrentStock().add(movement.delta()).signum() < 0) {
                throw new BusinessException("Estoque insuficiente para concluir a operacao: " + item.getName());
            }
        }
        for (PendingMovement movement : pending) {
            StockMovementType type = movement.delta().signum() < 0
                    ? StockMovementType.SALE
                    : StockMovementType.SALE_REVERSAL;
            record(movement.stockItem(), type, movement.delta(), saleItem,
                    movement.reversedMovement(), reason, user);
        }
    }

    private StockMovement manual(Long stockItemId, StockMovementType type, BigDecimal delta, String reason) {
        return record(findForUpdate(stockItemId), type, delta, null, null, normalize(reason), currentUser());
    }

    private StockMovement record(
            StockItem item,
            StockMovementType type,
            BigDecimal delta,
            SaleItem saleItem,
            StockMovement reversed,
            String reason,
            User user
    ) {
        BigDecimal previous = item.getCurrentStock();
        BigDecimal resulting = previous.add(delta);
        if (resulting.signum() < 0) throw new BusinessException("Estoque insuficiente para concluir a operacao");
        item.setCurrentStock(resulting);
        return movementRepository.save(StockMovement.builder()
                .stockItem(item).type(type).deltaQuantity(delta)
                .previousBalance(previous).resultingBalance(resulting)
                .saleItem(saleItem).reversedMovement(reversed).reason(normalize(reason))
                .createdByUser(user).createdAt(LocalDateTime.now(businessClock)).build());
    }

    private StockItem findForUpdate(Long id) {
        return stockItemRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Item de estoque nao encontrado"));
    }

    private User currentUser() {
        return authenticatedUserProvider.currentUser()
                .orElseThrow(() -> new BusinessException("Usuario autenticado e obrigatorio"));
    }

    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    StockMovementResponse toResponse(StockMovement movement) {
        return new StockMovementResponse(movement.getId(), movement.getStockItem().getId(),
                movement.getStockItem().getName(), movement.getStockItem().getUnit(), movement.getType(),
                movement.getDeltaQuantity(), movement.getPreviousBalance(), movement.getResultingBalance(),
                movement.getSaleItem() == null ? null : movement.getSaleItem().getId(),
                movement.getReversedMovement() == null ? null : movement.getReversedMovement().getId(),
                movement.getReason(), movement.getCreatedByUser().getId(), movement.getCreatedByUser().getName(),
                movement.getCreatedAt());
    }

    private record PendingMovement(
            StockItem stockItem,
            BigDecimal delta,
            StockMovement reversedMovement
    ) {
    }
}
