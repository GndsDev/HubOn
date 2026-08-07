package com.hubon.backend.sale.controller;

import com.hubon.backend.payment.dto.PaymentRequest;
import com.hubon.backend.payment.service.PaymentService;
import com.hubon.backend.sale.domain.SaleStatus;
import com.hubon.backend.sale.domain.SaleType;
import com.hubon.backend.sale.dto.*;
import com.hubon.backend.sale.service.SaleQueryService;
import com.hubon.backend.sale.service.SaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SaleController {
    private final SaleService saleService;
    private final SaleQueryService queryService;
    private final PaymentService paymentService;

    @GetMapping public List<SaleResponse> list(@RequestParam(required = false) SaleStatus status,
                                               @RequestParam(required = false) SaleType type) { return queryService.list(status, type); }
    @GetMapping("/{id}") public SaleResponse get(@PathVariable Long id) { return queryService.get(id); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public SaleResponse open(@Valid @RequestBody OpenSaleRequest request) { return saleService.open(request); }
    @PostMapping("/{id}/items") @ResponseStatus(HttpStatus.CREATED) public SaleResponse addItem(@PathVariable Long id, @Valid @RequestBody AddSaleItemRequest request) { return saleService.addItem(id, request); }
    @PostMapping("/{id}/items/{itemId}/cancel") public SaleResponse cancelItem(@PathVariable Long id, @PathVariable Long itemId, @Valid @RequestBody CancellationRequest request) { return saleService.cancelItem(id, itemId, request); }
    @PostMapping("/{id}/payments") @ResponseStatus(HttpStatus.CREATED) public SaleResponse pay(@PathVariable Long id, @Valid @RequestBody PaymentRequest request) { paymentService.create(id, request); return queryService.get(id); }
    @PostMapping("/{id}/close") public SaleResponse close(@PathVariable Long id) { return saleService.close(id); }
    @PostMapping("/{id}/cancel") public SaleResponse cancel(@PathVariable Long id, @Valid @RequestBody CancellationRequest request) { return saleService.cancel(id, request); }
}
