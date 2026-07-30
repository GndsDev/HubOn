package com.hubon.backend.tab.controller;

import com.hubon.backend.tab.dto.OpenTabRequest;
import com.hubon.backend.tab.dto.OpenCounterTabRequest;
import com.hubon.backend.tab.dto.CounterSaleDetailResponse;
import com.hubon.backend.tab.dto.CounterSaleSummaryResponse;
import com.hubon.backend.tab.dto.TabResponse;
import com.hubon.backend.tab.dto.UpdateCounterTabRequest;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.service.CounterSaleService;
import com.hubon.backend.tab.service.TabService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TabController {

    private final TabService tabService;
    private final CounterSaleService counterSaleService;

    @GetMapping("/tabs/counter/active")
    public List<CounterSaleSummaryResponse> listActiveCounterSales() {
        return counterSaleService.listActive();
    }

    @GetMapping("/tabs/counter/finished-today")
    public List<CounterSaleSummaryResponse> listCounterSalesFinishedToday() {
        return counterSaleService.listFinishedToday();
    }

    @GetMapping("/tabs/counter/history")
    public List<CounterSaleSummaryResponse> searchCounterHistory(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long number,
            @RequestParam(required = false) String customer,
            @RequestParam(required = false) TabStatus status,
            @RequestParam(required = false) String operator
    ) {
        return counterSaleService.searchHistory(from, to, number, customer, status, operator);
    }

    @GetMapping("/tabs/counter/{id}")
    public CounterSaleDetailResponse getCounterSale(@PathVariable Long id) {
        return counterSaleService.getById(id);
    }

    @PatchMapping("/tabs/counter/{id}")
    public CounterSaleDetailResponse updateCounterSale(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCounterTabRequest request
    ) {
        return counterSaleService.update(id, request);
    }

    @PostMapping("/tabs/counter/{id}/finish")
    public CounterSaleDetailResponse finishCounterSale(@PathVariable Long id) {
        return counterSaleService.finish(id);
    }

    @GetMapping("/tabs/open")
    public List<TabResponse> listOpen() {
        return tabService.listOpen();
    }

    @GetMapping("/tabs/{id}")
    public TabResponse getById(@PathVariable Long id) {
        return tabService.getById(id);
    }

    @PostMapping("/tabs/open")
    @ResponseStatus(HttpStatus.CREATED)
    public TabResponse open(@Valid @RequestBody OpenTabRequest request) {
        return tabService.open(request);
    }

    @PostMapping("/tabs/counter")
    @ResponseStatus(HttpStatus.CREATED)
    public TabResponse openCounter(@Valid @RequestBody OpenCounterTabRequest request) {
        return tabService.openCounter(request);
    }

    @PostMapping("/tabs/{id}/close")
    public TabResponse close(@PathVariable Long id) {
        return tabService.close(id);
    }

    @PostMapping("/tabs/{id}/cancel")
    public TabResponse cancel(@PathVariable Long id) {
        return tabService.cancel(id);
    }

    @GetMapping("/tables/{tableId}/current-tab")
    public TabResponse getCurrentByTable(@PathVariable Long tableId) {
        return tabService.getCurrentByTable(tableId);
    }
}
