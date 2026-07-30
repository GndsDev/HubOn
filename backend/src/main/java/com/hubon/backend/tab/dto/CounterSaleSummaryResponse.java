package com.hubon.backend.tab.dto;

import com.hubon.backend.tab.domain.TabStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CounterSaleSummaryResponse(
        Long id,
        Long number,
        String displayLabel,
        String customerName,
        LocalDateTime openedAt,
        LocalDateTime closedAt,
        String openedByUserName,
        TabStatus tabStatus,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        int itemCount,
        int draftItemCount,
        int waitingItemCount,
        int inPreparationItemCount,
        int readyItemCount,
        int deliveredItemCount,
        CounterAttendanceState attendanceState,
        CounterPreparationState preparationState,
        CounterFinancialState financialState,
        CounterNextAction nextAction,
        boolean cancellationAllowed
) {
}
