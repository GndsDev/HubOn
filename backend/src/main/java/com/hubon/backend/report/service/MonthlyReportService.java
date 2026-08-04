package com.hubon.backend.report.service;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.AnnualReportResponse;
import com.hubon.backend.report.dto.DailyReportResponse;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import com.hubon.backend.shared.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Collator;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Month;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class MonthlyReportService {

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter DAILY_LABEL = DateTimeFormatter.ofPattern("dd 'de' MMMM 'de' yyyy", PT_BR);
    private final NamedParameterJdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public DailyReportResponse generateDaily(LocalDate date, ReportChannel channel) {
        if (date == null) {
            throw new BusinessException("A data do relatório diário é obrigatória");
        }
        validateYear(date.getYear());
        ReportChannel selectedChannel = selectedChannel(channel);
        MapSqlParameterSource parameters = parameters(date, date.plusDays(1), selectedChannel);
        MonthlyReportResponse.CancellationSummary cancellations = cancellations(parameters, selectedChannel);
        MonthlyReportResponse.Summary summary = summary(parameters, selectedChannel, cancellations);
        BigDecimal previousNet = netRevenue(parameters(date.minusDays(1), date, selectedChannel), selectedChannel);
        BigDecimal difference = summary.netRevenue().subtract(previousNet);

        return new DailyReportResponse(
                date,
                capitalize(date.format(DAILY_LABEL)),
                selectedChannel,
                summary,
                new DailyReportResponse.Comparison(previousNet, difference, percentageChange(difference, previousNet)),
                products(parameters, selectedChannel),
                categories(parameters, selectedChannel),
                payments(parameters, selectedChannel),
                channels(parameters, selectedChannel),
                hourly(parameters, selectedChannel),
                sales(parameters, selectedChannel),
                cancellations
        );
    }

    @Transactional(readOnly = true)
    public MonthlyReportResponse generate(int year, int month, ReportChannel channel) {
        validateYear(year);
        YearMonth period;
        try {
            period = YearMonth.of(year, month);
        } catch (RuntimeException exception) {
            throw new BusinessException("Mês e ano do relatório são inválidos");
        }
        ReportChannel selectedChannel = selectedChannel(channel);
        MapSqlParameterSource parameters = parameters(period, selectedChannel);
        MonthlyReportResponse.CancellationSummary cancellations = cancellations(parameters, selectedChannel);
        MonthlyReportResponse.Summary summary = summary(parameters, selectedChannel, cancellations);
        BigDecimal previousNet = netRevenue(parameters(period.minusMonths(1), selectedChannel), selectedChannel);
        BigDecimal difference = summary.netRevenue().subtract(previousNet);

        return new MonthlyReportResponse(
                year,
                month,
                capitalize(period.getMonth().getDisplayName(TextStyle.FULL, PT_BR)) + " de " + year,
                selectedChannel,
                summary,
                new MonthlyReportResponse.Comparison(previousNet, difference, percentageChange(difference, previousNet)),
                products(parameters, selectedChannel),
                categories(parameters, selectedChannel),
                payments(parameters, selectedChannel),
                channels(parameters, selectedChannel),
                daily(parameters, selectedChannel),
                sales(parameters, selectedChannel),
                cancellations
        );
    }

    @Transactional(readOnly = true)
    public AnnualReportResponse generateAnnual(int year, ReportChannel channel) {
        validateYear(year);
        ReportChannel selectedChannel = selectedChannel(channel);
        LocalDate startDate = LocalDate.of(year, 1, 1);
        MapSqlParameterSource parameters = parameters(startDate, startDate.plusYears(1), selectedChannel);
        MonthlyReportResponse.CancellationSummary cancellations = cancellations(parameters, selectedChannel);
        MonthlyReportResponse.Summary summary = summary(parameters, selectedChannel, cancellations);
        BigDecimal previousNet = netRevenue(
                parameters(startDate.minusYears(1), startDate, selectedChannel), selectedChannel);
        BigDecimal difference = summary.netRevenue().subtract(previousNet);
        List<AnnualReportResponse.MonthPerformance> months = monthly(parameters, selectedChannel);

        return new AnnualReportResponse(
                year,
                "Ano de " + year,
                selectedChannel,
                summary,
                new AnnualReportResponse.Comparison(previousNet, difference, percentageChange(difference, previousNet)),
                products(parameters, selectedChannel),
                categories(parameters, selectedChannel),
                payments(parameters, selectedChannel),
                channels(parameters, selectedChannel),
                months,
                sales(parameters, selectedChannel),
                indicators(months, summary.netRevenue()),
                cancellations
        );
    }

    private MonthlyReportResponse.Summary summary(
            MapSqlParameterSource parameters,
            ReportChannel channel,
            MonthlyReportResponse.CancellationSummary cancellations
    ) {
        Map<String, Object> row = jdbc.queryForMap(
                """
                SELECT
                    COUNT(*) AS closed_tabs,
                    COUNT(*) FILTER (WHERE type = 'TABLE') AS table_sales,
                    COUNT(*) FILTER (WHERE type = 'COUNTER') AS counter_sales,
                    COALESCE(SUM(total_amount + service_fee), 0) AS gross_revenue,
                    COALESCE(SUM(service_fee), 0) AS service_fees,
                    COALESCE(SUM(discount_amount), 0) AS discounts,
                    COALESCE(SUM(final_amount), 0) AS net_revenue
                FROM tabs
                WHERE status = 'CLOSED'
                  AND closed_business_date >= :startDate
                  AND closed_business_date < :endDate
                """ + validSaleFilter("tabs") + channelFilter(channel, "type"),
                parameters
        );
        Map<String, Object> salesCounts = jdbc.queryForMap(
                """
                SELECT COUNT(DISTINCT customer_order.id) AS orders,
                       COALESCE(SUM(item.quantity), 0) AS items_sold
                FROM tabs tab
                JOIN orders customer_order ON customer_order.tab_id = tab.id
                JOIN order_items item ON item.order_id = customer_order.id
                WHERE tab.status = 'CLOSED'
                  AND tab.closed_business_date >= :startDate
                  AND tab.closed_business_date < :endDate
                  AND customer_order.status <> 'CANCELLED'
                  AND item.status NOT IN ('DRAFT', 'CANCELED')
                """ + channelFilter(channel, "tab.type"),
                parameters
        );
        BigDecimal received = decimal(jdbc.queryForObject(
                """
                SELECT COALESCE(SUM(payment.amount), 0)
                FROM payments payment
                JOIN tabs tab ON tab.id = payment.tab_id
                WHERE tab.status = 'CLOSED'
                  AND tab.closed_business_date >= :startDate
                  AND tab.closed_business_date < :endDate
                """ + validSaleFilter("tab") + channelFilter(channel, "tab.type"),
                parameters,
                BigDecimal.class
        ));
        long closedTabs = longValue(row.get("closed_tabs"));
        BigDecimal netRevenue = decimal(row.get("net_revenue"));
        return new MonthlyReportResponse.Summary(
                decimal(row.get("gross_revenue")),
                decimal(row.get("service_fees")),
                decimal(row.get("discounts")),
                netRevenue,
                received,
                closedTabs,
                longValue(salesCounts.get("orders")),
                longValue(salesCounts.get("items_sold")),
                average(netRevenue, closedTabs),
                longValue(row.get("table_sales")),
                longValue(row.get("counter_sales")),
                cancellations.cancelledOrders(),
                cancellations.cancelledItems(),
                cancellations.cancelledAmount()
        );
    }

    private BigDecimal netRevenue(MapSqlParameterSource parameters, ReportChannel channel) {
        return decimal(jdbc.queryForObject(
                """
                SELECT COALESCE(SUM(final_amount), 0)
                FROM tabs
                WHERE status = 'CLOSED'
                  AND closed_business_date >= :startDate
                  AND closed_business_date < :endDate
                """ + validSaleFilter("tabs") + channelFilter(channel, "type"),
                parameters,
                BigDecimal.class
        ));
    }

    private List<MonthlyReportResponse.ProductPerformance> products(
            MapSqlParameterSource parameters,
            ReportChannel channel
    ) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                """
                SELECT
                    item.product_name_snapshot AS product_name,
                    item.product_variant_name_snapshot AS variant_name,
                    item.category_name_snapshot AS category_name,
                    COALESCE(SUM(item.quantity), 0) AS quantity,
                    COALESCE(SUM(item.subtotal), 0) AS sales_amount
                FROM order_items item
                JOIN orders customer_order ON customer_order.id = item.order_id
                JOIN tabs tab ON tab.id = customer_order.tab_id
                WHERE tab.status = 'CLOSED'
                  AND tab.closed_business_date >= :startDate
                  AND tab.closed_business_date < :endDate
                  AND customer_order.status <> 'CANCELLED'
                  AND item.status NOT IN ('DRAFT', 'CANCELED')
                """ + channelFilter(channel, "tab.type") + """
                GROUP BY item.product_name_snapshot, item.product_variant_name_snapshot, item.category_name_snapshot
                ORDER BY sales_amount DESC, product_name, variant_name
                """,
                parameters
        );
        Map<String, ProductAccumulator> grouped = new LinkedHashMap<>();
        rows.forEach(row -> {
            String productName = string(row.get("product_name"), "Produto removido");
            String categoryName = string(row.get("category_name"), "Sem categoria");
            ProductAccumulator product = grouped.computeIfAbsent(
                    productName + "\u0000" + categoryName,
                    ignored -> new ProductAccumulator(productName, categoryName)
            );
            long quantity = longValue(row.get("quantity"));
            BigDecimal amount = decimal(row.get("sales_amount"));
            product.quantity += quantity;
            product.amount = product.amount.add(amount);
            product.variants.add(new MonthlyReportResponse.VariantPerformance(
                    string(row.get("variant_name"), "Padrão"), quantity, amount));
        });

        BigDecimal productsTotal = grouped.values().stream()
                .map(product -> product.amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        Collator names = Collator.getInstance(PT_BR);
        names.setStrength(Collator.PRIMARY);
        Comparator<MonthlyReportResponse.VariantPerformance> variantOrder = Comparator
                .comparing(MonthlyReportResponse.VariantPerformance::salesAmount).reversed()
                .thenComparing(Comparator.comparingLong(MonthlyReportResponse.VariantPerformance::quantity).reversed())
                .thenComparing(MonthlyReportResponse.VariantPerformance::variantName, names);
        Comparator<MonthlyReportResponse.ProductPerformance> productOrder = Comparator
                .comparing(MonthlyReportResponse.ProductPerformance::salesAmount).reversed()
                .thenComparing(Comparator.comparingLong(MonthlyReportResponse.ProductPerformance::quantity).reversed())
                .thenComparing(MonthlyReportResponse.ProductPerformance::productName, names);
        return grouped.values().stream()
                .map(product -> new MonthlyReportResponse.ProductPerformance(
                        product.productName,
                        product.categoryName,
                        product.quantity,
                        product.amount,
                        percentage(product.amount, productsTotal),
                        product.variants.stream().sorted(variantOrder).toList()
                ))
                .sorted(productOrder)
                .toList();
    }

    private List<MonthlyReportResponse.CategoryPerformance> categories(
            MapSqlParameterSource parameters,
            ReportChannel channel
    ) {
        List<MonthlyReportResponse.CategoryPerformance> rows = jdbc.query(
                """
                SELECT item.category_name_snapshot AS category_name,
                       COALESCE(SUM(item.quantity), 0) AS quantity,
                       COALESCE(SUM(item.subtotal), 0) AS sales_amount
                FROM order_items item
                JOIN orders customer_order ON customer_order.id = item.order_id
                JOIN tabs tab ON tab.id = customer_order.tab_id
                WHERE tab.status = 'CLOSED'
                  AND tab.closed_business_date >= :startDate
                  AND tab.closed_business_date < :endDate
                  AND customer_order.status <> 'CANCELLED'
                  AND item.status NOT IN ('DRAFT', 'CANCELED')
                """ + channelFilter(channel, "tab.type") + """
                GROUP BY item.category_name_snapshot
                ORDER BY sales_amount DESC, category_name
                """,
                parameters,
                (rs, rowNumber) -> new MonthlyReportResponse.CategoryPerformance(
                        string(rs.getString("category_name"), "Sem categoria"),
                        rs.getLong("quantity"),
                        decimal(rs.getBigDecimal("sales_amount")),
                        BigDecimal.ZERO)
        );
        BigDecimal total = rows.stream().map(MonthlyReportResponse.CategoryPerformance::salesAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return rows.stream()
                .map(row -> new MonthlyReportResponse.CategoryPerformance(
                        row.categoryName(), row.quantity(), row.salesAmount(), percentage(row.salesAmount(), total)))
                .toList();
    }

    private List<MonthlyReportResponse.PaymentPerformance> payments(
            MapSqlParameterSource parameters,
            ReportChannel channel
    ) {
        List<MonthlyReportResponse.PaymentPerformance> rows = jdbc.query(
                """
                SELECT payment.method, COUNT(*) AS payments, COALESCE(SUM(payment.amount), 0) AS amount
                FROM payments payment
                JOIN tabs tab ON tab.id = payment.tab_id
                WHERE tab.status = 'CLOSED'
                  AND tab.closed_business_date >= :startDate
                  AND tab.closed_business_date < :endDate
                """ + validSaleFilter("tab") + channelFilter(channel, "tab.type") + """
                GROUP BY payment.method
                ORDER BY amount DESC, payment.method
                """,
                parameters,
                (rs, rowNumber) -> new MonthlyReportResponse.PaymentPerformance(
                        rs.getString("method"), rs.getLong("payments"),
                        decimal(rs.getBigDecimal("amount")), BigDecimal.ZERO)
        );
        BigDecimal total = rows.stream().map(MonthlyReportResponse.PaymentPerformance::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return rows.stream()
                .map(row -> new MonthlyReportResponse.PaymentPerformance(
                        row.method(), row.payments(), row.amount(), percentage(row.amount(), total)))
                .toList();
    }

    private List<MonthlyReportResponse.ChannelPerformance> channels(
            MapSqlParameterSource parameters,
            ReportChannel channel
    ) {
        return jdbc.query(
                """
                SELECT type, COUNT(*) AS closed_tabs, COALESCE(SUM(final_amount), 0) AS net_revenue
                FROM tabs
                WHERE status = 'CLOSED'
                  AND closed_business_date >= :startDate
                  AND closed_business_date < :endDate
                """ + validSaleFilter("tabs") + channelFilter(channel, "type") + """
                GROUP BY type
                ORDER BY net_revenue DESC, type
                """,
                parameters,
                (rs, rowNumber) -> {
                    long tabs = rs.getLong("closed_tabs");
                    BigDecimal revenue = decimal(rs.getBigDecimal("net_revenue"));
                    return new MonthlyReportResponse.ChannelPerformance(
                            rs.getString("type"), tabs, revenue, average(revenue, tabs));
                }
        );
    }

    private List<MonthlyReportResponse.DailyPerformance> daily(
            MapSqlParameterSource parameters,
            ReportChannel channel
    ) {
        Map<LocalDate, PeriodAccumulator> values = new HashMap<>();
        jdbc.query(
                """
                SELECT closed_business_date AS business_date,
                       COUNT(*) AS closed_tabs,
                       COALESCE(SUM(total_amount + service_fee), 0) AS gross_revenue,
                       COALESCE(SUM(service_fee), 0) AS service_fees,
                       COALESCE(SUM(discount_amount), 0) AS discounts,
                       COALESCE(SUM(final_amount), 0) AS net_revenue
                FROM tabs
                WHERE status = 'CLOSED'
                  AND closed_business_date >= :startDate
                  AND closed_business_date < :endDate
                """ + validSaleFilter("tabs") + channelFilter(channel, "type") + """
                GROUP BY closed_business_date
                ORDER BY business_date
                """,
                parameters,
                (RowCallbackHandler) rs -> fillFinancial(values.computeIfAbsent(
                        rs.getObject("business_date", LocalDate.class), ignored -> new PeriodAccumulator()), rs)
        );
        jdbc.query(
                """
                SELECT tab.closed_business_date AS business_date,
                       COUNT(DISTINCT customer_order.id) AS orders,
                       COALESCE(SUM(item.quantity), 0) AS items_sold
                FROM tabs tab
                JOIN orders customer_order ON customer_order.tab_id = tab.id
                JOIN order_items item ON item.order_id = customer_order.id
                WHERE tab.status = 'CLOSED'
                  AND tab.closed_business_date >= :startDate
                  AND tab.closed_business_date < :endDate
                  AND customer_order.status <> 'CANCELLED'
                  AND item.status NOT IN ('DRAFT', 'CANCELED')
                """ + channelFilter(channel, "tab.type") + """
                GROUP BY tab.closed_business_date
                """,
                parameters,
                (RowCallbackHandler) rs -> fillVolume(values.computeIfAbsent(
                        rs.getObject("business_date", LocalDate.class), ignored -> new PeriodAccumulator()), rs)
        );
        jdbc.query(
                """
                SELECT tab.closed_business_date AS business_date,
                       COALESCE(SUM(payment.amount), 0) AS received_amount
                FROM payments payment
                JOIN tabs tab ON tab.id = payment.tab_id
                WHERE tab.status = 'CLOSED'
                  AND tab.closed_business_date >= :startDate
                  AND tab.closed_business_date < :endDate
                """ + validSaleFilter("tab") + channelFilter(channel, "tab.type") + """
                GROUP BY tab.closed_business_date
                """,
                parameters,
                (RowCallbackHandler) rs -> values.computeIfAbsent(
                                rs.getObject("business_date", LocalDate.class), ignored -> new PeriodAccumulator())
                        .receivedAmount = decimal(rs.getBigDecimal("received_amount"))
        );

        LocalDate start = (LocalDate) parameters.getValue("startDate");
        LocalDate end = (LocalDate) parameters.getValue("endDate");
        return start.datesUntil(end)
                .map(date -> dailyPerformance(date, values.getOrDefault(date, new PeriodAccumulator())))
                .toList();
    }

    private List<DailyReportResponse.HourlyPerformance> hourly(
            MapSqlParameterSource parameters,
            ReportChannel channel
    ) {
        Map<Integer, PeriodAccumulator> values = new HashMap<>();
        jdbc.query(
                """
                SELECT EXTRACT(HOUR FROM closed_at)::INTEGER AS hour_number,
                       COUNT(*) AS closed_tabs,
                       COALESCE(SUM(total_amount + service_fee), 0) AS gross_revenue,
                       COALESCE(SUM(service_fee), 0) AS service_fees,
                       COALESCE(SUM(discount_amount), 0) AS discounts,
                       COALESCE(SUM(final_amount), 0) AS net_revenue
                FROM tabs
                WHERE status = 'CLOSED'
                  AND closed_business_date >= :startDate
                  AND closed_business_date < :endDate
                """ + validSaleFilter("tabs") + channelFilter(channel, "type") + """
                GROUP BY hour_number
                """,
                parameters,
                (RowCallbackHandler) rs -> fillFinancial(values.computeIfAbsent(
                        rs.getInt("hour_number"), ignored -> new PeriodAccumulator()), rs)
        );
        jdbc.query(
                """
                SELECT EXTRACT(HOUR FROM tab.closed_at)::INTEGER AS hour_number,
                       COUNT(DISTINCT customer_order.id) AS orders,
                       COALESCE(SUM(item.quantity), 0) AS items_sold
                FROM tabs tab
                JOIN orders customer_order ON customer_order.tab_id = tab.id
                JOIN order_items item ON item.order_id = customer_order.id
                WHERE tab.status = 'CLOSED'
                  AND tab.closed_business_date >= :startDate
                  AND tab.closed_business_date < :endDate
                  AND customer_order.status <> 'CANCELLED'
                  AND item.status NOT IN ('DRAFT', 'CANCELED')
                """ + channelFilter(channel, "tab.type") + """
                GROUP BY hour_number
                """,
                parameters,
                (RowCallbackHandler) rs -> fillVolume(values.computeIfAbsent(
                        rs.getInt("hour_number"), ignored -> new PeriodAccumulator()), rs)
        );
        jdbc.query(
                """
                SELECT EXTRACT(HOUR FROM tab.closed_at)::INTEGER AS hour_number,
                       COALESCE(SUM(payment.amount), 0) AS received_amount
                FROM payments payment
                JOIN tabs tab ON tab.id = payment.tab_id
                WHERE tab.status = 'CLOSED'
                  AND tab.closed_business_date >= :startDate
                  AND tab.closed_business_date < :endDate
                """ + validSaleFilter("tab") + channelFilter(channel, "tab.type") + """
                GROUP BY hour_number
                """,
                parameters,
                (RowCallbackHandler) rs -> values.computeIfAbsent(rs.getInt("hour_number"), ignored -> new PeriodAccumulator())
                        .receivedAmount = decimal(rs.getBigDecimal("received_amount"))
        );
        return IntStream.range(0, 24)
                .mapToObj(hour -> hourlyPerformance(hour, values.getOrDefault(hour, new PeriodAccumulator())))
                .toList();
    }

    private List<AnnualReportResponse.MonthPerformance> monthly(
            MapSqlParameterSource parameters,
            ReportChannel channel
    ) {
        Map<Integer, PeriodAccumulator> values = new HashMap<>();
        jdbc.query(
                """
                SELECT EXTRACT(MONTH FROM closed_business_date)::INTEGER AS month_number,
                       COUNT(*) AS closed_tabs,
                       COALESCE(SUM(total_amount + service_fee), 0) AS gross_revenue,
                       COALESCE(SUM(service_fee), 0) AS service_fees,
                       COALESCE(SUM(discount_amount), 0) AS discounts,
                       COALESCE(SUM(final_amount), 0) AS net_revenue
                FROM tabs
                WHERE status = 'CLOSED'
                  AND closed_business_date >= :startDate
                  AND closed_business_date < :endDate
                """ + validSaleFilter("tabs") + channelFilter(channel, "type") + """
                GROUP BY month_number
                """,
                parameters,
                (RowCallbackHandler) rs -> fillFinancial(values.computeIfAbsent(
                        rs.getInt("month_number"), ignored -> new PeriodAccumulator()), rs)
        );
        jdbc.query(
                """
                SELECT EXTRACT(MONTH FROM tab.closed_business_date)::INTEGER AS month_number,
                       COUNT(DISTINCT customer_order.id) AS orders,
                       COALESCE(SUM(item.quantity), 0) AS items_sold
                FROM tabs tab
                JOIN orders customer_order ON customer_order.tab_id = tab.id
                JOIN order_items item ON item.order_id = customer_order.id
                WHERE tab.status = 'CLOSED'
                  AND tab.closed_business_date >= :startDate
                  AND tab.closed_business_date < :endDate
                  AND customer_order.status <> 'CANCELLED'
                  AND item.status NOT IN ('DRAFT', 'CANCELED')
                """ + channelFilter(channel, "tab.type") + """
                GROUP BY month_number
                """,
                parameters,
                (RowCallbackHandler) rs -> fillVolume(values.computeIfAbsent(
                        rs.getInt("month_number"), ignored -> new PeriodAccumulator()), rs)
        );
        jdbc.query(
                """
                SELECT EXTRACT(MONTH FROM tab.closed_business_date)::INTEGER AS month_number,
                       COALESCE(SUM(payment.amount), 0) AS received_amount
                FROM payments payment
                JOIN tabs tab ON tab.id = payment.tab_id
                WHERE tab.status = 'CLOSED'
                  AND tab.closed_business_date >= :startDate
                  AND tab.closed_business_date < :endDate
                """ + validSaleFilter("tab") + channelFilter(channel, "tab.type") + """
                GROUP BY month_number
                """,
                parameters,
                (RowCallbackHandler) rs -> values.computeIfAbsent(rs.getInt("month_number"), ignored -> new PeriodAccumulator())
                        .receivedAmount = decimal(rs.getBigDecimal("received_amount"))
        );
        jdbc.query(
                """
                SELECT EXTRACT(MONTH FROM item.cancelled_at)::INTEGER AS month_number,
                       COALESCE(SUM(item.subtotal), 0) AS cancelled_amount
                FROM order_items item
                JOIN orders customer_order ON customer_order.id = item.order_id
                JOIN tabs tab ON tab.id = customer_order.tab_id
                WHERE item.status = 'CANCELED'
                  AND item.cancelled_at >= :start
                  AND item.cancelled_at < :end
                """ + channelFilter(channel, "tab.type") + """
                GROUP BY month_number
                """,
                parameters,
                (RowCallbackHandler) rs -> values.computeIfAbsent(rs.getInt("month_number"), ignored -> new PeriodAccumulator())
                        .cancelledAmount = decimal(rs.getBigDecimal("cancelled_amount"))
        );
        return IntStream.rangeClosed(1, 12)
                .mapToObj(month -> monthPerformance(month, values.getOrDefault(month, new PeriodAccumulator())))
                .toList();
    }

    private List<MonthlyReportResponse.SaleDetail> sales(
            MapSqlParameterSource parameters,
            ReportChannel channel
    ) {
        return jdbc.query(
                """
                SELECT tab.id,
                       CASE
                           WHEN tab.type = 'TABLE' THEN 'Mesa ' || COALESCE(restaurant_table.number::TEXT, tab.id::TEXT)
                           ELSE 'Balcão #' || tab.id::TEXT
                       END AS origin,
                       tab.opened_at,
                       tab.closed_at,
                       GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (tab.closed_at - tab.opened_at)) / 60))::BIGINT AS duration_minutes,
                       opened_by.name AS responsible,
                       COALESCE(sale_volume.orders, 0) AS orders,
                       COALESCE(sale_volume.items, 0) AS items,
                       tab.total_amount + tab.service_fee AS gross_revenue,
                       tab.service_fee AS service_fees,
                       tab.discount_amount AS discounts,
                       tab.final_amount,
                       COALESCE(payment_totals.received_amount, 0) AS received_amount,
                       COALESCE(payment_totals.payment_methods, '') AS payment_methods
                FROM tabs tab
                JOIN users opened_by ON opened_by.id = tab.opened_by_user_id
                LEFT JOIN restaurant_tables restaurant_table ON restaurant_table.id = tab.restaurant_table_id
                LEFT JOIN LATERAL (
                    SELECT COUNT(DISTINCT customer_order.id) AS orders,
                           COALESCE(SUM(item.quantity), 0) AS items
                    FROM orders customer_order
                    JOIN order_items item ON item.order_id = customer_order.id
                    WHERE customer_order.tab_id = tab.id
                      AND customer_order.status <> 'CANCELLED'
                      AND item.status NOT IN ('DRAFT', 'CANCELED')
                ) sale_volume ON TRUE
                LEFT JOIN LATERAL (
                    SELECT COALESCE(SUM(payment.amount), 0) AS received_amount,
                           STRING_AGG(payment.method, ', ' ORDER BY payment.paid_at, payment.id) AS payment_methods
                    FROM payments payment
                    WHERE payment.tab_id = tab.id
                ) payment_totals ON TRUE
                WHERE tab.status = 'CLOSED'
                  AND tab.closed_business_date >= :startDate
                  AND tab.closed_business_date < :endDate
                """ + validSaleFilter("tab") + channelFilter(channel, "tab.type") + """
                ORDER BY tab.closed_at, tab.id
                """,
                parameters,
                (rs, rowNumber) -> new MonthlyReportResponse.SaleDetail(
                        rs.getLong("id"),
                        rs.getString("origin"),
                        rs.getObject("opened_at", LocalDateTime.class),
                        rs.getObject("closed_at", LocalDateTime.class),
                        rs.getLong("duration_minutes"),
                        rs.getString("responsible"),
                        rs.getLong("orders"),
                        rs.getLong("items"),
                        decimal(rs.getBigDecimal("gross_revenue")),
                        decimal(rs.getBigDecimal("service_fees")),
                        decimal(rs.getBigDecimal("discounts")),
                        decimal(rs.getBigDecimal("final_amount")),
                        decimal(rs.getBigDecimal("received_amount")),
                        rs.getString("payment_methods")
                )
        );
    }

    private MonthlyReportResponse.CancellationSummary cancellations(
            MapSqlParameterSource parameters,
            ReportChannel channel
    ) {
        Map<String, Object> row = jdbc.queryForMap(
                """
                SELECT COUNT(*) AS cancelled_items,
                       COALESCE(SUM(item.subtotal), 0) AS cancelled_amount
                FROM order_items item
                JOIN orders customer_order ON customer_order.id = item.order_id
                JOIN tabs tab ON tab.id = customer_order.tab_id
                WHERE item.status = 'CANCELED'
                  AND item.cancelled_at >= :start
                  AND item.cancelled_at < :end
                """ + channelFilter(channel, "tab.type"),
                parameters
        );
        Long cancelledOrders = jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM orders customer_order
                JOIN tabs tab ON tab.id = customer_order.tab_id
                WHERE customer_order.status = 'CANCELLED'
                  AND customer_order.updated_at >= :start
                  AND customer_order.updated_at < :end
                """ + channelFilter(channel, "tab.type"),
                parameters,
                Long.class
        );
        List<MonthlyReportResponse.CancellationReason> reasons = jdbc.query(
                """
                SELECT reason, COUNT(*) AS occurrences
                FROM (
                    SELECT customer_order.cancellation_reason AS reason
                    FROM orders customer_order
                    JOIN tabs tab ON tab.id = customer_order.tab_id
                    WHERE customer_order.status = 'CANCELLED'
                      AND customer_order.updated_at >= :start
                      AND customer_order.updated_at < :end
                """ + channelFilter(channel, "tab.type") + """
                    UNION ALL
                    SELECT item.cancellation_reason AS reason
                    FROM order_items item
                    JOIN orders customer_order ON customer_order.id = item.order_id
                    JOIN tabs tab ON tab.id = customer_order.tab_id
                    WHERE item.status = 'CANCELED'
                      AND item.cancelled_at >= :start
                      AND item.cancelled_at < :end
                """ + channelFilter(channel, "tab.type") + """
                ) cancellation
                WHERE reason IS NOT NULL AND TRIM(reason) <> ''
                GROUP BY reason
                ORDER BY occurrences DESC, reason
                LIMIT 5
                """,
                parameters,
                (rs, rowNumber) -> new MonthlyReportResponse.CancellationReason(
                        rs.getString("reason"), rs.getLong("occurrences"))
        );
        return new MonthlyReportResponse.CancellationSummary(
                cancelledOrders == null ? 0 : cancelledOrders,
                longValue(row.get("cancelled_items")),
                decimal(row.get("cancelled_amount")),
                reasons
        );
    }

    private MonthlyReportResponse.DailyPerformance dailyPerformance(LocalDate date, PeriodAccumulator value) {
        return new MonthlyReportResponse.DailyPerformance(
                date,
                value.closedTabs,
                value.orders,
                value.itemsSold,
                value.grossRevenue,
                value.serviceFees,
                value.discounts,
                value.netRevenue,
                value.receivedAmount,
                average(value.netRevenue, value.closedTabs)
        );
    }

    private DailyReportResponse.HourlyPerformance hourlyPerformance(int hour, PeriodAccumulator value) {
        return new DailyReportResponse.HourlyPerformance(
                hour,
                "%02d:00-%02d:59".formatted(hour, hour),
                value.closedTabs,
                value.orders,
                value.itemsSold,
                value.grossRevenue,
                value.serviceFees,
                value.discounts,
                value.netRevenue,
                value.receivedAmount,
                average(value.netRevenue, value.closedTabs)
        );
    }

    private AnnualReportResponse.MonthPerformance monthPerformance(int month, PeriodAccumulator value) {
        return new AnnualReportResponse.MonthPerformance(
                month,
                monthLabel(month),
                value.closedTabs,
                value.orders,
                value.itemsSold,
                value.grossRevenue,
                value.serviceFees,
                value.discounts,
                value.netRevenue,
                value.receivedAmount,
                value.cancelledAmount,
                average(value.netRevenue, value.closedTabs)
        );
    }

    private AnnualReportResponse.Indicators indicators(
            List<AnnualReportResponse.MonthPerformance> months,
            BigDecimal annualNetRevenue
    ) {
        AnnualReportResponse.MonthPerformance best = months.stream()
                .filter(month -> month.closedTabs() > 0)
                .max(Comparator.comparing(AnnualReportResponse.MonthPerformance::netRevenue))
                .orElse(null);
        long activeMonths = months.stream().filter(month -> month.closedTabs() > 0).count();
        return new AnnualReportResponse.Indicators(
                best == null ? "Sem vendas" : best.monthLabel(),
                best == null ? BigDecimal.ZERO : best.netRevenue(),
                annualNetRevenue.divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP),
                activeMonths
        );
    }

    private void fillFinancial(PeriodAccumulator value, java.sql.ResultSet rs) throws java.sql.SQLException {
        value.closedTabs = rs.getLong("closed_tabs");
        value.grossRevenue = decimal(rs.getBigDecimal("gross_revenue"));
        value.serviceFees = decimal(rs.getBigDecimal("service_fees"));
        value.discounts = decimal(rs.getBigDecimal("discounts"));
        value.netRevenue = decimal(rs.getBigDecimal("net_revenue"));
    }

    private void fillVolume(PeriodAccumulator value, java.sql.ResultSet rs) throws java.sql.SQLException {
        value.orders = rs.getLong("orders");
        value.itemsSold = rs.getLong("items_sold");
    }

    private MapSqlParameterSource parameters(YearMonth period, ReportChannel channel) {
        return parameters(period.atDay(1), period.plusMonths(1).atDay(1), channel);
    }

    private MapSqlParameterSource parameters(LocalDate startDate, LocalDate endDate, ReportChannel channel) {
        return new MapSqlParameterSource()
                .addValue("start", startDate.atStartOfDay())
                .addValue("end", endDate.atStartOfDay())
                .addValue("startDate", startDate)
                .addValue("endDate", endDate)
                .addValue("channel", channel.name());
    }

    private ReportChannel selectedChannel(ReportChannel channel) {
        return channel == null ? ReportChannel.ALL : channel;
    }

    private void validateYear(int year) {
        if (year < 2000 || year > 2100) {
            throw new BusinessException("Ano do relatório deve estar entre 2000 e 2100");
        }
    }

    private String monthLabel(int month) {
        return capitalize(Month.of(month).getDisplayName(TextStyle.FULL, PT_BR));
    }

    private String capitalize(String value) {
        return value == null || value.isBlank()
                ? value
                : Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    private String channelFilter(ReportChannel channel, String column) {
        return channel == ReportChannel.ALL ? "" : " AND " + column + " = :channel\n";
    }

    private String validSaleFilter(String tabAlias) {
        return """
                 AND EXISTS (
                     SELECT 1
                     FROM orders valid_order
                     JOIN order_items valid_item ON valid_item.order_id = valid_order.id
                     WHERE valid_order.tab_id = %s.id
                       AND valid_order.status <> 'CANCELLED'
                       AND valid_item.status NOT IN ('DRAFT', 'CANCELED')
                 )
                """.formatted(tabAlias);
    }

    private BigDecimal decimal(Object value) {
        return value == null ? BigDecimal.ZERO : new BigDecimal(value.toString());
    }

    private long longValue(Object value) {
        return value == null ? 0 : ((Number) value).longValue();
    }

    private String string(Object value, String fallback) {
        return value == null || value.toString().isBlank() ? fallback : value.toString();
    }

    private BigDecimal average(BigDecimal total, long count) {
        return count == 0
                ? BigDecimal.ZERO
                : total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal percentage(BigDecimal value, BigDecimal total) {
        return total.signum() == 0
                ? BigDecimal.ZERO
                : value.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal percentageChange(BigDecimal difference, BigDecimal previousValue) {
        return previousValue.signum() == 0 ? null : percentage(difference, previousValue);
    }

    private static final class ProductAccumulator {
        private final String productName;
        private final String categoryName;
        private long quantity;
        private BigDecimal amount = BigDecimal.ZERO;
        private final List<MonthlyReportResponse.VariantPerformance> variants = new ArrayList<>();

        private ProductAccumulator(String productName, String categoryName) {
            this.productName = productName;
            this.categoryName = categoryName;
        }
    }

    private static final class PeriodAccumulator {
        private long closedTabs;
        private long orders;
        private long itemsSold;
        private BigDecimal grossRevenue = BigDecimal.ZERO;
        private BigDecimal serviceFees = BigDecimal.ZERO;
        private BigDecimal discounts = BigDecimal.ZERO;
        private BigDecimal netRevenue = BigDecimal.ZERO;
        private BigDecimal receivedAmount = BigDecimal.ZERO;
        private BigDecimal cancelledAmount = BigDecimal.ZERO;
    }
}
