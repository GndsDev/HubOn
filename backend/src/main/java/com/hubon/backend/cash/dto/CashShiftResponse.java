package com.hubon.backend.cash.dto;

import com.hubon.backend.cash.domain.CashShiftStatus;
import com.hubon.backend.payment.domain.PaymentMethod;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record CashShiftResponse(
        Long id,
        CashShiftStatus status,
        Long openedByUserId,
        String openedByUserName,
        LocalDateTime openedAt,
        BigDecimal openingBalance,
        Long closedByUserId,
        String closedByUserName,
        LocalDateTime closedAt,
        BigDecimal receivedTotal,
        Map<PaymentMethod, BigDecimal> receivedByMethod,
        BigDecimal cancellationAmount,
        BigDecimal supplyAmount,
        BigDecimal withdrawalAmount,
        BigDecimal expectedCash,
        BigDecimal countedCash,
        BigDecimal differenceAmount,
        String closingNote,
        List<CashMovementResponse> movements
) {
}
