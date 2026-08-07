package com.hubon.backend.stock.service;

import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.StockItem;
import com.hubon.backend.stock.domain.StockStatus;
import com.hubon.backend.stock.dto.StockEntryRequest;
import com.hubon.backend.stock.dto.StockItemRequest;
import com.hubon.backend.stock.dto.StockItemResponse;
import com.hubon.backend.stock.repository.ProductStockLinkRepository;
import com.hubon.backend.stock.repository.StockItemRepository;
import com.hubon.backend.stock.repository.StockMovementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StockItemService {
    private final StockItemRepository repository;
    private final StockMovementRepository movementRepository;
    private final ProductStockLinkRepository linkRepository;
    private final StockMovementService movementService;

    @Transactional(readOnly = true) public List<StockItemResponse> listAll() { return repository.findAllByOrderByNameAsc().stream().map(this::toResponse).toList(); }
    @Transactional(readOnly = true) public List<StockItemResponse> listActive() { return repository.findAllByActiveTrueOrderByNameAsc().stream().map(this::toResponse).toList(); }
    @Transactional(readOnly = true) public List<StockItemResponse> alerts() { return repository.findAlerts().stream().map(this::toResponse).toList(); }
    @Transactional(readOnly = true) public StockItemResponse getById(Long id) { return toResponse(find(id)); }

    @Transactional
    public StockItemResponse create(StockItemRequest request) {
        String name = request.name().trim();
        if (repository.existsByNameIgnoreCase(name)) throw new BusinessException("Ja existe um item de estoque com este nome");
        BigDecimal initialStock = request.currentStock();
        StockItem item = repository.save(StockItem.builder().name(name).description(normalize(request.description()))
                .unit(request.unit()).currentStock(BigDecimal.ZERO).minimumStock(request.minimumStock())
                .active(request.active()).build());
        if (initialStock.signum() > 0) movementService.entry(new StockEntryRequest(item.getId(), initialStock, "Saldo inicial"));
        return toResponse(item);
    }

    @Transactional
    public StockItemResponse update(Long id, StockItemRequest request) {
        StockItem item = find(id);
        String name = request.name().trim();
        if (repository.existsByNameIgnoreCaseAndIdNot(name, id)) throw new BusinessException("Ja existe um item de estoque com este nome");
        if (item.getCurrentStock().compareTo(request.currentStock()) != 0) {
            throw new BusinessException("Use um ajuste de estoque para alterar o saldo atual");
        }
        if (item.getUnit() != request.unit() && movementRepository.existsByStockItemId(id)) {
            throw new BusinessException("A unidade nao pode mudar depois do primeiro movimento");
        }
        item.setName(name);
        item.setDescription(normalize(request.description()));
        item.setUnit(request.unit());
        item.setMinimumStock(request.minimumStock());
        item.setActive(request.active() == null ? item.getActive() : request.active());
        return toResponse(item);
    }

    @Transactional public StockItemResponse activate(Long id) { find(id).setActive(true); return getById(id); }

    @Transactional
    public StockItemResponse deactivate(Long id) {
        StockItem item = find(id);
        if (linkRepository.existsByStockItemIdAndActiveTrue(id)) throw new BusinessException("Desative o vinculo automatico antes do item de estoque");
        item.setActive(false);
        return toResponse(item);
    }

    private StockItem find(Long id) { return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Item de estoque nao encontrado")); }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private StockItemResponse toResponse(StockItem item) {
        StockStatus status = item.getCurrentStock().signum() == 0 ? StockStatus.OUT_OF_STOCK
                : item.getCurrentStock().compareTo(item.getMinimumStock()) <= 0 ? StockStatus.LOW_STOCK : StockStatus.NORMAL;
        return new StockItemResponse(item.getId(), item.getName(), item.getDescription(), item.getUnit(),
                item.getCurrentStock(), item.getMinimumStock(), status, item.getActive(), item.getCreatedAt(), item.getUpdatedAt());
    }
}
