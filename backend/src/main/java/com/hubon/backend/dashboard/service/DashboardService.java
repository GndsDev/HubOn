package com.hubon.backend.dashboard.service;

import com.hubon.backend.dashboard.dto.DashboardSummaryResponse;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.sale.domain.*;
import com.hubon.backend.sale.repository.SaleItemRepository;
import com.hubon.backend.sale.repository.SaleRepository;
import com.hubon.backend.sale.service.SaleValueService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DashboardService {
    private final SaleRepository saleRepository;
    private final SaleItemRepository itemRepository;
    private final PaymentRepository paymentRepository;
    private final SaleValueService valueService;
    private final Clock businessClock;

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary() {
        LocalDate today = LocalDate.now(businessClock);
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay();
        List<Sale> closed = saleRepository
                .findAllByStatusAndClosedAtGreaterThanEqualAndClosedAtLessThanOrderByClosedAtAscIdAsc(
                        SaleStatus.CLOSED, start, end);
        BigDecimal todaySales = closed.stream().map(valueService::calculate)
                .map(values -> values.finalAmount()).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal average = closed.isEmpty() ? BigDecimal.ZERO
                : todaySales.divide(BigDecimal.valueOf(closed.size()), 2, RoundingMode.HALF_UP);
        List<Sale> open = saleRepository.findAllByStatusOrderByOpenedAtDesc(SaleStatus.OPEN);
        long openTables = open.stream().filter(sale -> sale.getType() == SaleType.TABLE).count();
        long openCounters = open.size() - openTables;
        long pending = open.stream().filter(sale -> valueService.calculate(sale).remainingAmount().signum() > 0).count();
        BigDecimal openAmount = open.stream().map(valueService::calculate).map(values -> values.finalAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cancelled = itemRepository
                .findAllByCancelledAtGreaterThanEqualAndCancelledAtLessThanOrderByCancelledAtAsc(start, end)
                .stream().filter(SaleItem::isOperationalCancellation)
                .map(SaleItem::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<DashboardSummaryResponse.RecentSale> recent = saleRepository.findAllByOrderByOpenedAtDesc().stream().limit(5)
                .map(sale -> new DashboardSummaryResponse.RecentSale(sale.getId(), sale.getTableNumber(),
                        sale.getType() == SaleType.COUNTER ? "Balcao #" + sale.getId() : "Mesa " + sale.getTableNumber(),
                        sale.getStatus().name(), valueService.calculate(sale).finalAmount(),
                        sale.getOpenedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))).toList();
        return new DashboardSummaryResponse(todaySales, open.size(), openTables, openCounters, pending, average,
                new DashboardSummaryResponse.CashSummary(paymentRepository.sumAmountBetween(start, end),
                openAmount, cancelled), recent);
    }
}
