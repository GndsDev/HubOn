package com.hubon.backend.report.service;

import com.hubon.backend.payment.domain.Payment;
import com.hubon.backend.payment.domain.PaymentMethod;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.AnnualReportResponse;
import com.hubon.backend.report.dto.DailyReportResponse;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import com.hubon.backend.sale.domain.*;
import com.hubon.backend.sale.repository.SaleItemRepository;
import com.hubon.backend.sale.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MonthlyReportService {
    private final SaleRepository saleRepository;
    private final SaleItemRepository itemRepository;
    private final PaymentRepository paymentRepository;
    private final Clock businessClock;

    @Transactional(readOnly = true)
    public MonthlyReportResponse generate(int year, int month, ReportChannel channel) {
        YearMonth period = YearMonth.of(year, month);
        ReportData current = data(period.atDay(1).atStartOfDay(), period.plusMonths(1).atDay(1).atStartOfDay(), channel);
        YearMonth previousPeriod = period.minusMonths(1);
        ReportData previous = data(previousPeriod.atDay(1).atStartOfDay(), previousPeriod.plusMonths(1).atDay(1).atStartOfDay(), channel);
        List<MonthlyReportResponse.DailyPerformance> daily = new ArrayList<>();
        for (int day = 1; day <= period.lengthOfMonth(); day++) {
            LocalDate date = period.atDay(day);
            ReportData value = data(date.atStartOfDay(), date.plusDays(1).atStartOfDay(), channel);
            daily.add(new MonthlyReportResponse.DailyPerformance(date, value.summary().closedSales(),
                    value.summary().itemsSold(), value.summary().grossRevenue(), value.summary().serviceFees(),
                    value.summary().discounts(), value.summary().netRevenue(), value.summary().receivedAmount(),
                    value.summary().averageTicket()));
        }
        return new MonthlyReportResponse(year, month, monthLabel(period), channel, current.summary(),
                new MonthlyReportResponse.Comparison(previous.summary().netRevenue(),
                        current.summary().netRevenue().subtract(previous.summary().netRevenue()),
                        percentageChange(current.summary().netRevenue(), previous.summary().netRevenue())),
                current.products(), current.categories(), current.paymentMethods(), current.channels(), daily,
                current.sales(), current.cancellations());
    }

    @Transactional(readOnly = true)
    public DailyReportResponse generateDaily(LocalDate date, ReportChannel channel) {
        ReportData current = data(date.atStartOfDay(), date.plusDays(1).atStartOfDay(), channel);
        ReportData previous = data(date.minusDays(1).atStartOfDay(), date.atStartOfDay(), channel);
        List<DailyReportResponse.HourlyPerformance> hourly = new ArrayList<>();
        for (int hour = 0; hour < 24; hour++) {
            LocalDateTime start = date.atTime(hour, 0);
            ReportData value = data(start, start.plusHours(1), channel);
            hourly.add(new DailyReportResponse.HourlyPerformance(hour, "%02d:00".formatted(hour),
                    value.summary().closedSales(), value.summary().itemsSold(), value.summary().grossRevenue(),
                    value.summary().serviceFees(), value.summary().discounts(), value.summary().netRevenue(),
                    value.summary().receivedAmount(), value.summary().averageTicket()));
        }
        return new DailyReportResponse(date, date.toString(), channel, current.summary(),
                new DailyReportResponse.Comparison(previous.summary().netRevenue(),
                        current.summary().netRevenue().subtract(previous.summary().netRevenue()),
                        percentageChange(current.summary().netRevenue(), previous.summary().netRevenue())),
                current.products(), current.categories(), current.paymentMethods(), current.channels(), hourly,
                current.sales(), current.cancellations());
    }

    @Transactional(readOnly = true)
    public AnnualReportResponse generateAnnual(int year, ReportChannel channel) {
        LocalDate startDate = LocalDate.of(year, 1, 1);
        ReportData current = data(startDate.atStartOfDay(), startDate.plusYears(1).atStartOfDay(), channel);
        ReportData previous = data(startDate.minusYears(1).atStartOfDay(), startDate.atStartOfDay(), channel);
        List<AnnualReportResponse.MonthPerformance> monthly = new ArrayList<>();
        for (int month = 1; month <= 12; month++) {
            YearMonth period = YearMonth.of(year, month);
            ReportData value = data(period.atDay(1).atStartOfDay(), period.plusMonths(1).atDay(1).atStartOfDay(), channel);
            monthly.add(new AnnualReportResponse.MonthPerformance(month, monthLabel(period),
                    value.summary().closedSales(), value.summary().itemsSold(), value.summary().grossRevenue(),
                    value.summary().serviceFees(), value.summary().discounts(), value.summary().netRevenue(),
                    value.summary().receivedAmount(), value.summary().cancelledAmount(),
                    value.summary().averageTicket()));
        }
        AnnualReportResponse.MonthPerformance best = monthly.stream()
                .max(Comparator.comparing(AnnualReportResponse.MonthPerformance::netRevenue)).orElse(monthly.getFirst());
        long activeMonths = monthly.stream().filter(value -> value.closedSales() > 0).count();
        BigDecimal averageMonthly = activeMonths == 0 ? BigDecimal.ZERO
                : current.summary().netRevenue().divide(BigDecimal.valueOf(activeMonths), 2, RoundingMode.HALF_UP);
        return new AnnualReportResponse(year, String.valueOf(year), channel, current.summary(),
                new AnnualReportResponse.Comparison(previous.summary().netRevenue(),
                        current.summary().netRevenue().subtract(previous.summary().netRevenue()),
                        percentageChange(current.summary().netRevenue(), previous.summary().netRevenue())),
                current.products(), current.categories(), current.paymentMethods(), current.channels(), monthly,
                current.sales(), new AnnualReportResponse.Indicators(best.monthLabel(), best.netRevenue(),
                averageMonthly, activeMonths), current.cancellations());
    }

    private ReportData data(LocalDateTime start, LocalDateTime end, ReportChannel channel) {
        List<Sale> sales = closedSales(start, end, channel);
        List<Long> saleIds = sales.stream().map(Sale::getId).toList();
        List<SaleItem> items = saleIds.isEmpty() ? List.of() : itemRepository.findAllBySaleIdIn(saleIds).stream()
                .filter(SaleItem::isActive).toList();
        List<Payment> payments = saleIds.isEmpty() ? List.of() : paymentRepository.findAllBySaleIdIn(saleIds);
        Map<Long, List<SaleItem>> itemsBySale = items.stream().collect(Collectors.groupingBy(item -> item.getSale().getId()));
        Map<Long, List<Payment>> paymentsBySale = payments.stream().collect(Collectors.groupingBy(payment -> payment.getSale().getId()));

        BigDecimal gross = sum(items, SaleItem::getSubtotal);
        BigDecimal serviceFees = sum(sales, Sale::getServiceFee);
        BigDecimal discounts = sum(sales, Sale::getDiscountAmount);
        BigDecimal net = sales.stream().map(sale -> finalAmount(sale, itemsBySale.getOrDefault(sale.getId(), List.of())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal received = sum(payments, Payment::getAmount);
        long quantity = items.stream().mapToLong(SaleItem::getQuantity).sum();
        CancellationData cancellation = cancellations(start, end);
        MonthlyReportResponse.Summary summary = new MonthlyReportResponse.Summary(gross, serviceFees, discounts,
                net, received, sales.size(), quantity, average(net, sales.size()),
                sales.stream().filter(sale -> sale.getType() == SaleType.TABLE).count(),
                sales.stream().filter(sale -> sale.getType() == SaleType.COUNTER).count(),
                cancellation.cancelledSales(), cancellation.cancelledItems(), cancellation.amount());
        return new ReportData(summary, products(items, gross), categories(items, gross),
                paymentMethods(payments, received), channels(sales, itemsBySale),
                saleDetails(sales, itemsBySale, paymentsBySale), cancellation.response());
    }

    private List<Sale> closedSales(LocalDateTime start, LocalDateTime end, ReportChannel channel) {
        if (channel == ReportChannel.ALL) {
            return saleRepository.findAllByStatusAndClosedAtGreaterThanEqualAndClosedAtLessThanOrderByClosedAtAscIdAsc(
                    SaleStatus.CLOSED, start, end);
        }
        return saleRepository.findAllByStatusAndTypeAndClosedAtGreaterThanEqualAndClosedAtLessThanOrderByClosedAtAscIdAsc(
                SaleStatus.CLOSED, SaleType.valueOf(channel.name()), start, end);
    }

    private List<MonthlyReportResponse.ProductPerformance> products(List<SaleItem> items, BigDecimal gross) {
        return items.stream().collect(Collectors.groupingBy(item -> new ProductKey(item.getProductNameSnapshot(),
                        item.getCategoryNameSnapshot() == null ? "Sem categoria" : item.getCategoryNameSnapshot())))
                .entrySet().stream().map(entry -> new MonthlyReportResponse.ProductPerformance(entry.getKey().name(),
                        entry.getKey().category(), entry.getValue().stream().mapToLong(SaleItem::getQuantity).sum(),
                        sum(entry.getValue(), SaleItem::getSubtotal), share(sum(entry.getValue(), SaleItem::getSubtotal), gross)))
                .sorted(Comparator.comparing(MonthlyReportResponse.ProductPerformance::salesAmount).reversed()
                        .thenComparing(MonthlyReportResponse.ProductPerformance::productName)).toList();
    }

    private List<MonthlyReportResponse.CategoryPerformance> categories(List<SaleItem> items, BigDecimal gross) {
        return items.stream().collect(Collectors.groupingBy(item -> item.getCategoryNameSnapshot() == null
                        ? "Sem categoria" : item.getCategoryNameSnapshot()))
                .entrySet().stream().map(entry -> new MonthlyReportResponse.CategoryPerformance(entry.getKey(),
                        entry.getValue().stream().mapToLong(SaleItem::getQuantity).sum(),
                        sum(entry.getValue(), SaleItem::getSubtotal), share(sum(entry.getValue(), SaleItem::getSubtotal), gross)))
                .sorted(Comparator.comparing(MonthlyReportResponse.CategoryPerformance::salesAmount).reversed()).toList();
    }

    private List<MonthlyReportResponse.PaymentPerformance> paymentMethods(List<Payment> payments, BigDecimal received) {
        return payments.stream().collect(Collectors.groupingBy(Payment::getMethod)).entrySet().stream()
                .map(entry -> new MonthlyReportResponse.PaymentPerformance(entry.getKey().name(), entry.getValue().size(),
                        sum(entry.getValue(), Payment::getAmount), share(sum(entry.getValue(), Payment::getAmount), received)))
                .sorted(Comparator.comparing(MonthlyReportResponse.PaymentPerformance::amount).reversed()).toList();
    }

    private List<MonthlyReportResponse.ChannelPerformance> channels(List<Sale> sales, Map<Long, List<SaleItem>> itemsBySale) {
        return sales.stream().collect(Collectors.groupingBy(Sale::getType)).entrySet().stream().map(entry -> {
            BigDecimal net = entry.getValue().stream().map(sale -> finalAmount(sale, itemsBySale.getOrDefault(sale.getId(), List.of())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            return new MonthlyReportResponse.ChannelPerformance(entry.getKey().name(), entry.getValue().size(), net,
                    average(net, entry.getValue().size()));
        }).sorted(Comparator.comparing(MonthlyReportResponse.ChannelPerformance::channel)).toList();
    }

    private List<MonthlyReportResponse.SaleDetail> saleDetails(List<Sale> sales,
            Map<Long, List<SaleItem>> itemsBySale, Map<Long, List<Payment>> paymentsBySale) {
        return sales.stream().map(sale -> {
            List<SaleItem> items = itemsBySale.getOrDefault(sale.getId(), List.of());
            List<Payment> payments = paymentsBySale.getOrDefault(sale.getId(), List.of());
            BigDecimal gross = sum(items, SaleItem::getSubtotal);
            return new MonthlyReportResponse.SaleDetail(sale.getId(), origin(sale), sale.getOpenedAt(), sale.getClosedAt(),
                    ChronoUnit.MINUTES.between(sale.getOpenedAt(), sale.getClosedAt()), sale.getOpenedByUser().getName(),
                    items.stream().mapToLong(SaleItem::getQuantity).sum(), gross, sale.getServiceFee(),
                    sale.getDiscountAmount(), finalAmount(sale, items), sum(payments, Payment::getAmount),
                    payments.stream().map(Payment::getMethod).map(PaymentMethod::name).distinct().sorted()
                            .collect(Collectors.joining(", ")));
        }).toList();
    }

    private CancellationData cancellations(LocalDateTime start, LocalDateTime end) {
        List<Sale> cancelledSales = saleRepository
                .findAllByStatusAndCancelledAtGreaterThanEqualAndCancelledAtLessThanOrderByCancelledAtAscIdAsc(
                        SaleStatus.CANCELLED, start, end);
        List<SaleItem> cancelledItems = itemRepository
                .findAllByCancelledAtGreaterThanEqualAndCancelledAtLessThanOrderByCancelledAtAsc(start, end)
                .stream().filter(SaleItem::isOperationalCancellation).toList();
        Map<String, Long> reasons = new HashMap<>();
        cancelledSales.forEach(sale -> reasons.merge(sale.getCancellationReason(), 1L, Long::sum));
        cancelledItems.forEach(item -> reasons.merge(item.getCancellationReason(), 1L, Long::sum));
        List<MonthlyReportResponse.CancellationReason> rows = reasons.entrySet().stream()
                .map(entry -> new MonthlyReportResponse.CancellationReason(entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparing(MonthlyReportResponse.CancellationReason::occurrences).reversed()).limit(10).toList();
        BigDecimal amount = sum(cancelledItems, SaleItem::getSubtotal);
        return new CancellationData(cancelledSales.size(), cancelledItems.size(), amount,
                new MonthlyReportResponse.CancellationSummary(cancelledSales.size(), cancelledItems.size(), amount, rows));
    }

    private BigDecimal finalAmount(Sale sale, List<SaleItem> items) {
        return sum(items, SaleItem::getSubtotal).add(sale.getServiceFee()).subtract(sale.getDiscountAmount()).max(BigDecimal.ZERO);
    }

    private <T> BigDecimal sum(Collection<T> values, Function<T, BigDecimal> mapper) {
        return values.stream().map(mapper).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal average(BigDecimal amount, long count) { return count == 0 ? BigDecimal.ZERO : amount.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP); }
    private BigDecimal share(BigDecimal amount, BigDecimal total) { return total.signum() == 0 ? BigDecimal.ZERO : amount.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP); }
    private BigDecimal percentageChange(BigDecimal current, BigDecimal previous) { return previous.signum() == 0 ? BigDecimal.ZERO : current.subtract(previous).multiply(BigDecimal.valueOf(100)).divide(previous, 2, RoundingMode.HALF_UP); }
    private String origin(Sale sale) { return sale.getType() == SaleType.COUNTER ? "Balcao #" + sale.getId() : "Mesa " + sale.getTableNumber(); }
    private String monthLabel(YearMonth period) { String month = period.getMonth().getDisplayName(TextStyle.FULL, Locale.forLanguageTag("pt-BR")); return month.substring(0, 1).toUpperCase() + month.substring(1) + " de " + period.getYear(); }

    private record ProductKey(String name, String category) { }
    private record CancellationData(long cancelledSales, long cancelledItems, BigDecimal amount,
                                    MonthlyReportResponse.CancellationSummary response) { }
    private record ReportData(MonthlyReportResponse.Summary summary,
            List<MonthlyReportResponse.ProductPerformance> products,
            List<MonthlyReportResponse.CategoryPerformance> categories,
            List<MonthlyReportResponse.PaymentPerformance> paymentMethods,
            List<MonthlyReportResponse.ChannelPerformance> channels,
            List<MonthlyReportResponse.SaleDetail> sales,
            MonthlyReportResponse.CancellationSummary cancellations) { }
}
