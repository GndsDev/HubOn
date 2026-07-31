package com.hubon.backend.cash.controller;

import com.hubon.backend.cash.dto.CashMovementRequest;
import com.hubon.backend.cash.dto.CashShiftResponse;
import com.hubon.backend.cash.dto.CloseCashShiftRequest;
import com.hubon.backend.cash.dto.OpenCashShiftRequest;
import com.hubon.backend.cash.service.CashShiftService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/cash-shifts")
@RequiredArgsConstructor
public class CashShiftController {

    private final CashShiftService cashShiftService;

    @GetMapping("/current")
    public ResponseEntity<CashShiftResponse> current() {
        return cashShiftService.getCurrent()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/history")
    public List<CashShiftResponse> history() {
        return cashShiftService.history();
    }

    @GetMapping("/{id}")
    public CashShiftResponse getById(@PathVariable Long id) {
        return cashShiftService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CashShiftResponse open(@Valid @RequestBody OpenCashShiftRequest request) {
        return cashShiftService.open(request);
    }

    @PostMapping("/{id}/movements")
    @ResponseStatus(HttpStatus.CREATED)
    public CashShiftResponse addMovement(
            @PathVariable Long id,
            @Valid @RequestBody CashMovementRequest request
    ) {
        return cashShiftService.addMovement(id, request);
    }

    @PostMapping("/{id}/close")
    public CashShiftResponse close(
            @PathVariable Long id,
            @Valid @RequestBody CloseCashShiftRequest request
    ) {
        return cashShiftService.close(id, request);
    }
}
