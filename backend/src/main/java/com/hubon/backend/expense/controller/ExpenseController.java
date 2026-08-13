package com.hubon.backend.expense.controller;

import com.hubon.backend.expense.domain.*;
import com.hubon.backend.expense.dto.*;
import com.hubon.backend.expense.service.ExpenseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class ExpenseController {
    private final ExpenseService service;

    @GetMapping
    public ExpenseListResponse list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) ExpenseCategory category,
            @RequestParam(required = false) ExpenseStatus status,
            @RequestParam(required = false) ExpensePaymentMethod paymentMethod,
            @RequestParam(required = false) String search
    ) {
        return service.list(from, to, category, status, paymentMethod, search);
    }

    @GetMapping("/{id}")
    public ExpenseResponse getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseResponse create(@Valid @RequestBody ExpenseRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public ExpenseResponse update(@PathVariable Long id, @Valid @RequestBody ExpenseRequest request) {
        return service.update(id, request);
    }
}
