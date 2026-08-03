package com.hubon.backend.report.service;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.AnnualReportResponse;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import com.hubon.backend.shared.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Collator;
import java.time.LocalDate;
import java.time.Month;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MonthlyReportService {

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter DAY_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    private final NamedParameterJdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public MonthlyReportResponse generate(int year, int month, ReportChannel channel) {
        validateYear(year);
        YearMonth period;
        try {
            period = YearMonth.of(year, month);
        } catch (RuntimeException exception) {
            throw new BusinessException("Mês e ano do relatório são inválidos");
        }
        ReportChannel selectedChannel = channel == null ? ReportChannel.ALL : channel;
        MapSqlParameterSource parameters = parameters(period, selectedChannel);

        MonthlyReportResponse.Summary summary = summary(parameters, selectedChannel);
        BigDecimal previousNet = previousNet(period.minusMonths(1), selectedChannel);
        BigDecimal difference = summary.netRevenue().subtract(previousNet);
        BigDecimal percentage = previousNet.signum() == 0
                ? null
                : difference.multiply(BigDecimal.valueOf(100)).divide(previousNet, 2, RoundingMode.HALF_UP);

        return new MonthlyReportResponse(
                year,
                month,
                period.getMonth().getDisplayName(TextStyle.FULL, PT_BR) + " de " + year,
                selectedChannel,
                summary,
                new MonthlyReportResponse.Comparison(previousNet, difference, percentage),
                products(parameters, selectedChannel),
                categories(parameters, selectedChannel),
                payments(parameters, selectedChannel),
                channels(parameters, selectedChannel),
                daily(parameters, selectedChannel),
                cancellations(parameters, selectedChannel)
        );
    }

    @Transactional(readOnly = true)
    public AnnualReportResponse generateAnnual(int year, ReportChannel channel) {
        validateYear(year);
        ReportChannel selectedChannel = channel == null ? ReportChannel.ALL : channel;
        LocalDate startDate = LocalDate.of(year, 1, 1);
        LocalDate endDate = startDate.plusYears(1);
        MapSqlParameterSource parameters = parameters(startDate, endDate, selectedChannel);

        MonthlyReportResponse.Summary summary = summary(parameters, selectedChannel);
        BigDecimal previousNet = netRevenue(parameters(startDate.minusYears(1), startDate, selectedChannel), selectedChannel);
        BigDecimal difference = summary.netRevenue().subtract(previousNet);
        BigDecimal percentage = previousNet.signum() == 0
                ? null
                : difference.multiply(BigDecimal.valueOf(100)).divide(previousNet, 2, RoundingMode.HALF_UP);

        return new AnnualReportResponse(
                year,
                "Ano de " + year,
                selectedChannel,
                summary,
                new AnnualReportResponse.Comparison(previousNet, difference, percentage),
                products(parameters, selectedChannel),
                categories(parameters, selectedChannel),
                payments(parameters, selectedChannel),
                channels(parameters, selectedChannel),
                monthly(parameters, selectedChannel),
                cancellations(parameters, selectedChannel)
        );
    }

    private MonthlyReportResponse.Summary summary(
            MapSqlParameterSource parameters,
            ReportChannel channel
    ) {
        String sql = """
                SELECT
                    COUNT(*) AS closed_tabs,
                    COALESCE(SUM(total_amount + service_fee), 0) AS gross_revenue,
                    COALESCE(SUM(service_fee), 0) AS service_fees,
                    COALESCE(SUM(discount_amount), 0) AS discounts,
                    COALESCE(SUM(final_amount), 0) AS net_revenue
                FROM tabs
                WHERE status = 'CLOSED'
                  AND closed_business_date >= :startDate
                  AND closed_business_date < :endDate
                """ + validSaleFilter("tabs") + channelFilter(channel, "type");
        Map<String, Object> row = jdbc.queryForMap(sql, parameters);
        long closedTabs = longValue(row.get("closed_tabs"));
        BigDecimal netRevenue = decimal(row.get("net_revenue"));
        BigDecimal received = jdbc.queryForObject(
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
        return new MonthlyReportResponse.Summary(
                decimal(row.get("gross_revenue")),
                decimal(row.get("service_fees")),
                decimal(row.get("discounts")),
                netRevenue,
                decimal(received),
                closedTabs,
                longValue(salesCounts.get("orders")),
                longValue(salesCounts.get("items_sold")),
                closedTabs == 0
                        ? BigDecimal.ZERO
                        : netRevenue.divide(BigDecimal.valueOf(closedTabs), 2, RoundingMode.HALF_UP)
        );
    }

    private BigDecimal previousNet(YearMonth period, ReportChannel channel) {
        return netRevenue(parameters(period, channel), channel);
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
            String key = productName + "\u0000" + categoryName;
            ProductAccumulator product = grouped.computeIfAbsent(key, ignored -> new ProductAccumulator(productName, categoryName));
            long quantity = longValue(row.get("quantity"));
            BigDecimal amount = decimal(row.get("sales_amount"));
            product.quantity += quantity;
            product.amount = product.amount.add(amount);
            product.variants.add(new MonthlyReportResponse.VariantPerformance(
                    string(row.get("variant_name"), "Padrão"),
                    quantity,
                    amount
            ));
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
                SELECT
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
                GROUP BY item.category_name_snapshot
                ORDER BY sales_amount DESC, category_name
                """,
                parameters,
                (rs, rowNumber) -> new MonthlyReportResponse.CategoryPerformance(
                        rs.getString("category_name"), rs.getLong("quantity"), rs.getBigDecimal("sales_amount"), BigDecimal.ZERO)
        );
        BigDecimal total = rows.stream().map(MonthlyReportResponse.CategoryPerformance::salesAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return rows.stream().map(row -> new MonthlyReportResponse.CategoryPerformance(
                row.categoryName(), row.quantity(), row.salesAmount(), percentage(row.salesAmount(), total))).toList();
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
                """ + channelFilter(channel, "tab.type") + """
                GROUP BY payment.method
                ORDER BY amount DESC, payment.method
                """,
                parameters,
                (rs, rowNumber) -> new MonthlyReportResponse.PaymentPerformance(
                        rs.getString("method"), rs.getLong("payments"), rs.getBigDecimal("amount"), BigDecimal.ZERO)
        );
        BigDecimal total = rows.stream().map(MonthlyReportResponse.PaymentPerformance::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return rows.stream().map(row -> new MonthlyReportResponse.PaymentPerformance(
                row.method(), row.payments(), row.amount(), percentage(row.amount(), total))).toList();
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
                    BigDecimal revenue = rs.getBigDecimal("net_revenue");
                    return new MonthlyReportResponse.ChannelPerformance(
                            rs.getString("type"), tabs, revenue,
                            tabs == 0 ? BigDecimal.ZERO : revenue.divide(BigDecimal.valueOf(tabs), 2, RoundingMode.HALF_UP));
                }
        );
    }

    private List<MonthlyReportResponse.DailyPerformance> daily(
            MapSqlParameterSource parameters,
            ReportChannel channel
    ) {
        return jdbc.query(
                """
                SELECT closed_business_date AS business_date,
                       COUNT(*) AS closed_tabs,
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
                (rs, rowNumber) -> {
                    long tabs = rs.getLong("closed_tabs");
                    BigDecimal revenue = rs.getBigDecimal("net_revenue");
                    return new MonthlyReportResponse.DailyPerformance(
                            java.time.LocalDate.parse(rs.getString("business_date"), DAY_FORMAT), tabs, revenue,
                            tabs == 0 ? BigDecimal.ZERO : revenue.divide(BigDecimal.valueOf(tabs), 2, RoundingMode.HALF_UP));
                }
        );
    }

    private List<AnnualReportResponse.MonthPerformance> monthly(
            MapSqlParameterSource parameters,
            ReportChannel channel
    ) {
        Map<Integer, AnnualReportResponse.MonthPerformance> values = new LinkedHashMap<>();
        jdbc.query(
                """
                SELECT EXTRACT(MONTH FROM closed_business_date)::INTEGER AS month_number,
                       COUNT(*) AS closed_tabs,
                       COALESCE(SUM(final_amount), 0) AS net_revenue
                FROM tabs
                WHERE status = 'CLOSED'
                  AND closed_business_date >= :startDate
                  AND closed_business_date < :endDate
                """ + validSaleFilter("tabs") + channelFilter(channel, "type") + """
                GROUP BY month_number
                ORDER BY month_number
                """,
                parameters,
                resultSet -> {
                    int month = resultSet.getInt("month_number");
                    long tabs = resultSet.getLong("closed_tabs");
                    BigDecimal revenue = resultSet.getBigDecimal("net_revenue");
                    values.put(month, new AnnualReportResponse.MonthPerformance(
                            month,
                            monthLabel(month),
                            tabs,
                            revenue,
                            tabs == 0 ? BigDecimal.ZERO : revenue.divide(BigDecimal.valueOf(tabs), 2, RoundingMode.HALF_UP)
                    ));
                }
        );
        return java.util.stream.IntStream.rangeClosed(1, 12)
                .mapToObj(month -> values.getOrDefault(month, new AnnualReportResponse.MonthPerformance(
                        month, monthLabel(month), 0, BigDecimal.ZERO, BigDecimal.ZERO)))
                .toList();
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

    private void validateYear(int year) {
        if (year < 2000 || year > 2100) {
            throw new BusinessException("Ano do relatório deve estar entre 2000 e 2100");
        }
    }

    private String monthLabel(int month) {
        String label = Month.of(month).getDisplayName(TextStyle.FULL, PT_BR);
        return Character.toUpperCase(label.charAt(0)) + label.substring(1);
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

    private BigDecimal percentage(BigDecimal value, BigDecimal total) {
        return total.signum() == 0
                ? BigDecimal.ZERO
                : value.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP);
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
}
