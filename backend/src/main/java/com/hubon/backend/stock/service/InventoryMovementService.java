package com.hubon.backend.stock.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.Ingredient;
import com.hubon.backend.stock.domain.InventoryMovement;
import com.hubon.backend.stock.domain.InventoryMovementType;
import com.hubon.backend.stock.dto.InventoryMovementResponse;
import com.hubon.backend.stock.dto.StockAdjustmentRequest;
import com.hubon.backend.stock.dto.StockEntryRequest;
import com.hubon.backend.stock.dto.StockExitRequest;
import com.hubon.backend.stock.dto.StockLossRequest;
import com.hubon.backend.stock.repository.IngredientRepository;
import com.hubon.backend.stock.repository.InventoryMovementRepository;
import com.hubon.backend.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InventoryMovementService {

    private static final int RECENT_LIMIT = 100;

    private final InventoryMovementRepository movementRepository;
    private final IngredientRepository ingredientRepository;
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
                .user(currentUser())
                .build();

        return toResponse(movementRepository.save(movement));
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

    private User currentUser() {
        return authenticatedUserProvider.currentUser()
                .orElseThrow(() -> new BusinessException("Usuario autenticado e obrigatorio para movimentar estoque"));
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
                movement.getUser().getId(),
                movement.getUser().getName(),
                movement.getCreatedAt()
        );
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
