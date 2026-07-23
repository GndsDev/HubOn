package com.hubon.backend.stock.controller;

import com.hubon.backend.stock.dto.InventoryMovementResponse;
import com.hubon.backend.stock.dto.StockAdjustmentRequest;
import com.hubon.backend.stock.dto.StockEntryRequest;
import com.hubon.backend.stock.dto.StockExitRequest;
import com.hubon.backend.stock.dto.StockLossRequest;
import com.hubon.backend.stock.service.InventoryMovementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/inventory-movements")
@RequiredArgsConstructor
public class InventoryMovementController {

    private final InventoryMovementService movementService;

    @GetMapping
    public List<InventoryMovementResponse> listRecent() {
        return movementService.listRecent();
    }

    @GetMapping("/ingredient/{ingredientId}")
    public List<InventoryMovementResponse> listByIngredient(@PathVariable Long ingredientId) {
        return movementService.listByIngredient(ingredientId);
    }

    @PostMapping("/entries")
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryMovementResponse registerEntry(@Valid @RequestBody StockEntryRequest request) {
        return movementService.registerEntry(request);
    }

    @PostMapping("/exits")
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryMovementResponse registerExit(@Valid @RequestBody StockExitRequest request) {
        return movementService.registerExit(request);
    }

    @PostMapping("/losses")
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryMovementResponse registerLoss(@Valid @RequestBody StockLossRequest request) {
        return movementService.registerLoss(request);
    }

    @PostMapping("/adjustments")
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryMovementResponse registerAdjustment(@Valid @RequestBody StockAdjustmentRequest request) {
        return movementService.registerAdjustment(request);
    }
}
