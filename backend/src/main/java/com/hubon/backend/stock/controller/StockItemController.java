package com.hubon.backend.stock.controller;

import com.hubon.backend.stock.dto.StockItemRequest;
import com.hubon.backend.stock.dto.StockItemResponse;
import com.hubon.backend.stock.service.StockItemService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stock-items")
@RequiredArgsConstructor
public class StockItemController {
    private final StockItemService service;
    @GetMapping public List<StockItemResponse> listAll() { return service.listAll(); }
    @GetMapping("/active") public List<StockItemResponse> listActive() { return service.listActive(); }
    @GetMapping("/alerts") public List<StockItemResponse> alerts() { return service.alerts(); }
    @GetMapping("/{id}") public StockItemResponse get(@PathVariable Long id) { return service.getById(id); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public StockItemResponse create(@Valid @RequestBody StockItemRequest request) { return service.create(request); }
    @PutMapping("/{id}") public StockItemResponse update(@PathVariable Long id, @Valid @RequestBody StockItemRequest request) { return service.update(id, request); }
    @PatchMapping("/{id}/activate") public StockItemResponse activate(@PathVariable Long id) { return service.activate(id); }
    @PatchMapping("/{id}/deactivate") public StockItemResponse deactivate(@PathVariable Long id) { return service.deactivate(id); }
}
