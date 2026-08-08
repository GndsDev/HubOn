package com.hubon.backend.stock.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.sale.domain.SaleItem;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.*;
import com.hubon.backend.stock.dto.*;
import com.hubon.backend.stock.repository.ProductStockLinkRepository;
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
import java.util.List;

@Service
@RequiredArgsConstructor
public class StockMovementService {
    private final StockMovementRepository movementRepository;
    private final StockItemRepository stockItemRepository;
    private final ProductStockLinkRepository linkRepository;
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

    public void applySale(SaleItem saleItem, User user) {
        linkRepository.findByProductIdAndActiveTrue(saleItem.getProduct().getId()).ifPresent(link -> {
            if (!Boolean.TRUE.equals(link.getStockItem().getActive())) {
                throw new BusinessException("Item de estoque vinculado esta inativo");
            }
            StockItem item = findForUpdate(link.getStockItem().getId());
            BigDecimal quantity = link.getQuantityPerSale().multiply(BigDecimal.valueOf(saleItem.getQuantity()));
            record(item, StockMovementType.SALE, quantity.negate(), saleItem, null, null, user);
        });
    }

    public void applySaleQuantityDelta(SaleItem saleItem, int quantityDelta, User user) {
        if (quantityDelta == 0) return;
        List<StockMovement> movements = saleMovements(saleItem);
        if (movements.isEmpty()) return;

        StockMovement original = originalSaleMovement(movements);
        BigDecimal consumed = netDelta(movements).negate();
        if (consumed.signum() <= 0) {
            throw new BusinessException("Consumo de estoque da venda esta inconsistente");
        }
        BigDecimal quantityPerSale = consumed.divide(
                BigDecimal.valueOf(saleItem.getQuantity()),
                3,
                RoundingMode.UNNECESSARY
        );
        BigDecimal stockDelta = quantityPerSale.multiply(BigDecimal.valueOf(Math.abs((long) quantityDelta)));
        StockItem stockItem = findForUpdate(original.getStockItem().getId());

        if (quantityDelta > 0) {
            record(stockItem, StockMovementType.SALE, stockDelta.negate(), saleItem, null, null, user);
        } else {
            record(stockItem, StockMovementType.SALE_REVERSAL, stockDelta, saleItem, original, null, user);
        }
    }

    public void reverseSale(SaleItem saleItem, User user) {
        List<StockMovement> movements = saleMovements(saleItem);
        if (movements.isEmpty()) return;
        BigDecimal consumed = netDelta(movements).negate();
        if (consumed.signum() == 0) return;
        if (consumed.signum() < 0) throw new BusinessException("Consumo de estoque da venda esta inconsistente");

        StockMovement original = originalSaleMovement(movements);
        StockItem item = findForUpdate(original.getStockItem().getId());
        record(item, StockMovementType.SALE_REVERSAL, consumed,
                saleItem, original, saleItem.getCancellationReason(), user);
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
}
