package com.hubon.backend.stock.service;

import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.Ingredient;
import com.hubon.backend.stock.domain.StockStatus;
import com.hubon.backend.stock.domain.StockControlMode;
import com.hubon.backend.stock.dto.IngredientRequest;
import com.hubon.backend.stock.dto.IngredientResponse;
import com.hubon.backend.stock.repository.IngredientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class IngredientService {

    private final IngredientRepository ingredientRepository;

    @Transactional(readOnly = true)
    public List<IngredientResponse> listAll() {
        return ingredientRepository.findAllByOrderByNameAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<IngredientResponse> listActive() {
        return ingredientRepository.findAllByActiveTrueOrderByNameAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public IngredientResponse getById(Long id) {
        return toResponse(findEntityById(id));
    }

    @Transactional
    public IngredientResponse create(IngredientRequest request) {
        String name = normalizeName(request.name());
        validateStockLevels(request.minimumStock(), request.idealStock());
        if (ingredientRepository.existsByNameIgnoreCase(name)) {
            throw new BusinessException("Ja existe um ingrediente com este nome");
        }

        Ingredient ingredient = Ingredient.builder()
                .name(name)
                .description(request.description())
                .unit(request.unit())
                .controlMode(controlModeOrDefault(request.controlMode()))
                .currentStock(BigDecimal.ZERO)
                .minimumStock(request.minimumStock())
                .idealStock(request.idealStock())
                .active(request.active())
                .build();

        return toResponse(ingredientRepository.save(ingredient));
    }

    @Transactional
    public IngredientResponse update(Long id, IngredientRequest request) {
        Ingredient ingredient = findEntityById(id);
        String name = normalizeName(request.name());
        validateStockLevels(request.minimumStock(), request.idealStock());
        if (!ingredient.getName().equalsIgnoreCase(name)
                && ingredientRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new BusinessException("Ja existe um ingrediente com este nome");
        }

        ingredient.setName(name);
        ingredient.setDescription(request.description());
        ingredient.setUnit(request.unit());
        ingredient.setControlMode(controlModeOrDefault(request.controlMode()));
        ingredient.setMinimumStock(request.minimumStock());
        ingredient.setIdealStock(request.idealStock());
        ingredient.setActive(request.active() == null ? ingredient.getActive() : request.active());

        return toResponse(ingredient);
    }

    @Transactional
    public IngredientResponse activate(Long id) {
        Ingredient ingredient = findEntityById(id);
        ingredient.setActive(true);
        return toResponse(ingredient);
    }

    @Transactional
    public IngredientResponse deactivate(Long id) {
        Ingredient ingredient = findEntityById(id);
        ingredient.setActive(false);
        return toResponse(ingredient);
    }

    @Transactional(readOnly = true)
    public List<IngredientResponse> listAlerts() {
        return ingredientRepository.findAllActiveAtOrBelowMinimumStock()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Ingredient findEntityById(Long id) {
        return ingredientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ingrediente nao encontrado"));
    }

    IngredientResponse toResponse(Ingredient ingredient) {
        return new IngredientResponse(
                ingredient.getId(),
                ingredient.getName(),
                ingredient.getDescription(),
                ingredient.getUnit(),
                ingredient.getControlMode(),
                ingredient.getCurrentStock(),
                ingredient.getMinimumStock(),
                ingredient.getIdealStock(),
                ingredient.getActive(),
                stockStatus(ingredient),
                ingredient.getCreatedAt(),
                ingredient.getUpdatedAt()
        );
    }

    private StockStatus stockStatus(Ingredient ingredient) {
        BigDecimal currentStock = valueOrZero(ingredient.getCurrentStock());
        BigDecimal minimumStock = valueOrZero(ingredient.getMinimumStock());
        if (currentStock.compareTo(BigDecimal.ZERO) == 0) {
            return StockStatus.OUT_OF_STOCK;
        }
        if (currentStock.compareTo(minimumStock) <= 0) {
            return StockStatus.LOW_STOCK;
        }
        return StockStatus.NORMAL;
    }

    private void validateStockLevels(BigDecimal minimumStock, BigDecimal idealStock) {
        validateNonNegative(minimumStock, "Estoque minimo nao pode ser negativo");
        validateNonNegative(idealStock, "Estoque ideal nao pode ser negativo");
        if (idealStock.compareTo(minimumStock) < 0) {
            throw new BusinessException("Estoque ideal nao pode ser menor que o estoque minimo");
        }
    }

    private StockControlMode controlModeOrDefault(StockControlMode controlMode) {
        return controlMode == null ? StockControlMode.MANUAL : controlMode;
    }

    private void validateNonNegative(BigDecimal value, String message) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(message);
        }
    }

    private String normalizeName(String name) {
        if (name == null || name.trim().isBlank()) {
            throw new BusinessException("Nome do ingrediente e obrigatorio");
        }
        return name.trim();
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
