package com.hubon.backend.payment.controller;

import com.hubon.backend.payment.dto.PaymentRequest;
import com.hubon.backend.payment.dto.PaymentResponse;
import com.hubon.backend.payment.dto.PaymentSummaryResponse;
import com.hubon.backend.payment.service.PaymentService;
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

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentResponse create(@Valid @RequestBody PaymentRequest request) {
        return paymentService.create(request);
    }

    @GetMapping("/tab/{tabId}")
    public PaymentSummaryResponse listByTab(@PathVariable Long tabId) {
        return paymentService.getSummaryByTab(tabId);
    }
}
