package com.hubon.backend.stock.controller;

import com.hubon.backend.stock.dto.*;
import com.hubon.backend.stock.service.StockMovementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stock-movements")
@RequiredArgsConstructor
public class StockMovementController {
    private final StockMovementService service;
    @GetMapping public List<StockMovementResponse> list() { return service.listRecent(); }
    @GetMapping("/stock-item/{id}") public List<StockMovementResponse> byItem(@PathVariable Long id) { return service.listByStockItem(id); }
    @PostMapping("/entries") @ResponseStatus(HttpStatus.CREATED) public StockMovementResponse entry(@Valid @RequestBody StockEntryRequest request) { return service.entry(request); }
    @PostMapping("/exits") @ResponseStatus(HttpStatus.CREATED) public StockMovementResponse exit(@Valid @RequestBody StockExitRequest request) { return service.exit(request); }
    @PostMapping("/losses") @ResponseStatus(HttpStatus.CREATED) public StockMovementResponse loss(@Valid @RequestBody StockLossRequest request) { return service.loss(request); }
    @PostMapping("/adjustments") @ResponseStatus(HttpStatus.CREATED) public StockMovementResponse adjust(@Valid @RequestBody StockAdjustmentRequest request) { return service.adjust(request); }
}
