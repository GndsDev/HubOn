package com.hubon.backend;

import com.hubon.backend.auth.service.AuthenticatedUser;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.domain.OrderType;
import com.hubon.backend.order.dto.OrderCancellationRequest;
import com.hubon.backend.order.dto.OrderItemRequest;
import com.hubon.backend.order.dto.OrderItemStatusRequest;
import com.hubon.backend.order.dto.OrderStatusRequest;
import com.hubon.backend.order.dto.RestaurantOrderRequest;
import com.hubon.backend.order.dto.RestaurantOrderResponse;
import com.hubon.backend.order.service.RestaurantOrderService;
import com.hubon.backend.payment.domain.PaymentMethod;
import com.hubon.backend.payment.dto.PaymentRequest;
import com.hubon.backend.payment.service.PaymentService;
import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import com.hubon.backend.report.service.MonthlyReportService;
import com.hubon.backend.role.domain.Role;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.domain.TabType;
import com.hubon.backend.tab.dto.OpenCounterTabRequest;
import com.hubon.backend.tab.dto.OpenTabRequest;
import com.hubon.backend.tab.dto.CounterAttendanceState;
import com.hubon.backend.tab.dto.CounterFinancialState;
import com.hubon.backend.tab.dto.CounterNextAction;
import com.hubon.backend.tab.dto.CounterPreparationState;
import com.hubon.backend.tab.dto.CounterSaleDetailResponse;
import com.hubon.backend.tab.dto.UpdateCounterTabRequest;
import com.hubon.backend.tab.dto.TabResponse;
import com.hubon.backend.tab.service.CounterSaleService;
import com.hubon.backend.tab.service.TabService;
import com.hubon.backend.user.domain.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "hubon.security.permit-all=false",
        "hubon.seed.enabled=false"
})
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTestDatabaseGuard.class)
@Transactional
class CounterSalesAndMonthlyReportsIntegrationTests {

    private static final AtomicInteger TABLE_NUMBER = new AtomicInteger(120_000);

    @Autowired private JdbcTemplate jdbc;
    @Autowired private TabService tabService;
    @Autowired private CounterSaleService counterSaleService;
    @Autowired private RestaurantOrderService orderService;
    @Autowired private PaymentService paymentService;
    @Autowired private MonthlyReportService reportService;
    @Autowired private EntityManager entityManager;

    private Long userId;
    private Long categoryId;
    private Long tableId;
    private Long directProductId;
    private Long directVariantId;
    private Long preparationProductId;
    private Long preparationVariantId;
    private Long stockItemId;

    @BeforeEach
    void setup() {
        String suffix = UUID.randomUUID().toString();
        userId = jdbc.queryForObject(
                "insert into users (name, email, password, active) values ('Operador', ?, '{noop}test', true) returning id",
                Long.class,
                "counter-" + suffix + "@hubon.test"
        );
        categoryId = jdbc.queryForObject(
                "insert into categories (name, description, active, display_order) values (?, 'Teste', true, 0) returning id",
                Long.class,
                "Bebidas " + suffix
        );
        tableId = jdbc.queryForObject(
                "insert into restaurant_tables (number, name, status, active) values (?, 'Teste', 'AVAILABLE', true) returning id",
                Long.class,
                TABLE_NUMBER.incrementAndGet()
        );
        directProductId = insertProduct("Coca-Cola", "DIRECT_SERVICE");
        directVariantId = insertVariant(directProductId, "Lata", "20.00");
        preparationProductId = insertProduct("Jantinha", "REQUIRES_PREPARATION");
        preparationVariantId = insertVariant(preparationProductId, "Completa", "30.00");
        stockItemId = jdbc.queryForObject(
                """
                insert into ingredients (name, unit, current_stock, minimum_stock, ideal_stock, control_mode, active)
                values (?, 'UN', 10, 2, 12, 'DIRECT_SALE', true)
                returning id
                """,
                Long.class,
                "Lata " + suffix
        );
        jdbc.update(
                "insert into product_stock_links (product_variant_id, stock_item_id, quantity_per_sale, active) values (?, ?, 1, true)",
                directVariantId,
                stockItemId
        );

        User user = User.builder()
                .id(userId)
                .name("Operador")
                .email("counter-authenticated@hubon.test")
                .password("{noop}test")
                .active(true)
                .roles(Set.of(Role.builder().name("OWNER").build()))
                .build();
        AuthenticatedUser principal = new AuthenticatedUser(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities())
        );
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createsIndependentCounterTabsWithoutTableAndWithOwnIdentifier() {
        TabResponse first = openCounter("Ana");
        TabResponse second = openCounter(null);

        assertThat(first.type()).isEqualTo(TabType.COUNTER);
        assertThat(first.tableId()).isNull();
        assertThat(first.customerName()).isEqualTo("Ana");
        assertThat(first.displayLabel()).isEqualTo("Balcão #" + first.id() + " - Ana");
        assertThat(second.id()).isNotEqualTo(first.id());
        assertThat(second.displayLabel()).isEqualTo("Balcão #" + second.id());
        assertThat(first.openedByUserId()).isEqualTo(userId);
    }

    @Test
    void databaseRejectsTableTabWithoutTable() {
        assertThatThrownBy(() -> jdbc.update(
                """
                insert into tabs (type, restaurant_table_id, status, opened_by_user_id, total_amount, service_fee, discount_amount, final_amount)
                values ('TABLE', null, 'OPEN', ?, 0, 0, 0, 0)
                """,
                userId
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void databaseRejectsCounterTabLinkedToTable() {
        assertThatThrownBy(() -> jdbc.update(
                """
                insert into tabs (type, restaurant_table_id, status, opened_by_user_id, total_amount, service_fee, discount_amount, final_amount)
                values ('COUNTER', ?, 'OPEN', ?, 0, 0, 0, 0)
                """,
                tableId,
                userId
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void directCounterSaleDerivesTypeDecrementsStockOnceAndFinalizes() {
        TabResponse tab = openCounter(null);
        RestaurantOrderResponse draft = createOrder(tab.id(), List.of(item(directProductId, directVariantId, 2)));
        assertThat(draft.type()).isEqualTo(OrderType.COUNTER);

        RestaurantOrderResponse confirmed = orderService.confirm(draft.id());
        RestaurantOrderResponse idempotent = orderService.confirm(draft.id());
        assertThat(confirmed.status()).isEqualTo(OrderStatus.READY);
        assertThat(confirmed.items().getFirst().status()).isEqualTo(OrderItemStatus.READY);
        assertThat(idempotent.status()).isEqualTo(OrderStatus.READY);
        assertThat(stock()).isEqualByComparingTo("8.000");
        assertThat(jdbc.queryForObject(
                "select count(*) from inventory_movements where order_item_id = ? and type = 'SALE'",
                Long.class,
                confirmed.items().getFirst().id()
        )).isEqualTo(1L);

        TabResponse amount = tabService.getById(tab.id());
        paymentService.create(new PaymentRequest(tab.id(), PaymentMethod.PIX, amount.finalAmount(), null));
        orderService.updateStatus(draft.id(), new OrderStatusRequest(OrderStatus.DELIVERED));
        TabResponse closed = tabService.close(tab.id());
        assertThat(closed.status()).isEqualTo(TabStatus.CLOSED);
        assertThat(closed.paidAmount()).isEqualByComparingTo(closed.finalAmount());
    }

    @Test
    void paidPreparationSaleRemainsUpdatableByKitchenUntilDelivery() {
        TabResponse tab = openCounter(null);
        RestaurantOrderResponse order = orderService.confirm(
                createOrder(tab.id(), List.of(item(preparationProductId, preparationVariantId, 1))).id()
        );
        assertThat(order.status()).isEqualTo(OrderStatus.SENT_TO_KITCHEN);
        TabResponse amount = tabService.getById(tab.id());
        paymentService.create(new PaymentRequest(tab.id(), PaymentMethod.CREDIT_CARD, amount.finalAmount(), null));

        Long itemId = order.items().getFirst().id();
        RestaurantOrderResponse preparing = orderService.updateItemStatus(
                order.id(), itemId, new OrderItemStatusRequest(OrderItemStatus.IN_PREPARATION));
        RestaurantOrderResponse ready = orderService.updateItemStatus(
                order.id(), itemId, new OrderItemStatusRequest(OrderItemStatus.READY));
        assertThat(preparing.status()).isEqualTo(OrderStatus.PREPARING);
        assertThat(ready.status()).isEqualTo(OrderStatus.READY);

        orderService.updateStatus(order.id(), new OrderStatusRequest(OrderStatus.DELIVERED));
        assertThat(tabService.close(tab.id()).status()).isEqualTo(TabStatus.CLOSED);
    }

    @Test
    void mixedSaleKeepsDirectItemReadyAndOnlyPreparedItemInKitchenFlow() {
        TabResponse tab = openCounter(null);
        RestaurantOrderResponse order = orderService.confirm(createOrder(tab.id(), List.of(
                item(directProductId, directVariantId, 1),
                item(preparationProductId, preparationVariantId, 1)
        )).id());

        assertThat(order.items()).extracting(item -> item.status())
                .containsExactly(OrderItemStatus.READY, OrderItemStatus.WAITING_PREPARATION);
        assertThat(order.status()).isEqualTo(OrderStatus.SENT_TO_KITCHEN);
        paymentService.create(new PaymentRequest(
                tab.id(), PaymentMethod.DEBIT_CARD, tabService.getById(tab.id()).finalAmount(), null));

        assertThatThrownBy(() -> orderService.updateItemStatus(
                order.id(), order.items().getFirst().id(), new OrderItemStatusRequest(OrderItemStatus.IN_PREPARATION)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("entrega direta");
        Long preparedItem = order.items().get(1).id();
        orderService.updateItemStatus(order.id(), preparedItem, new OrderItemStatusRequest(OrderItemStatus.IN_PREPARATION));
        RestaurantOrderResponse ready = orderService.updateItemStatus(
                order.id(), preparedItem, new OrderItemStatusRequest(OrderItemStatus.READY));
        assertThat(ready.status()).isEqualTo(OrderStatus.READY);
    }

    @Test
    void counterCenterPersistsAndRestoresDraftWithDerivedStates() {
        TabResponse tab = openCounter(null);
        RestaurantOrderResponse emptyDraft = createOrder(tab.id(), List.of());

        CounterSaleDetailResponse empty = counterSaleService.getById(tab.id());
        assertThat(empty.summary().attendanceState()).isEqualTo(CounterAttendanceState.ASSEMBLING);
        assertThat(empty.summary().nextAction()).isEqualTo(CounterNextAction.ADD_ITEMS);
        assertThat(empty.orders()).singleElement().satisfies(order -> {
            assertThat(order.id()).isEqualTo(emptyDraft.id());
            assertThat(order.items()).isEmpty();
        });

        orderService.updateDraft(emptyDraft.id(), new RestaurantOrderRequest(
                tab.id(), null, OrderType.COUNTER, "Retomar depois", List.of(
                item(directProductId, directVariantId, 1),
                item(preparationProductId, preparationVariantId, 2)
        )));
        counterSaleService.update(tab.id(), new UpdateCounterTabRequest("Ana", "11999999999", "Balcão"));
        entityManager.flush();
        entityManager.clear();

        CounterSaleDetailResponse restored = counterSaleService.getById(tab.id());
        assertThat(restored.summary().customerName()).isEqualTo("Ana");
        assertThat(restored.customerPhone()).isEqualTo("11999999999");
        assertThat(restored.summary().itemCount()).isEqualTo(3);
        assertThat(restored.summary().draftItemCount()).isEqualTo(3);
        assertThat(restored.summary().nextAction()).isEqualTo(CounterNextAction.CONFIRM_ORDER);
        assertThat(counterSaleService.listActive()).extracting(item -> item.id()).contains(tab.id());
    }

    @Test
    void paidMixedSaleRemainsActiveThroughPreparationDeliveryAndOnlyLeavesAfterFinish() {
        TabResponse tab = openCounter("Gabriel");
        RestaurantOrderResponse confirmed = orderService.confirm(createOrder(tab.id(), List.of(
                item(directProductId, directVariantId, 1),
                item(preparationProductId, preparationVariantId, 1)
        )).id());

        CounterSaleDetailResponse waiting = counterSaleService.getById(tab.id());
        assertThat(waiting.summary().preparationState()).isEqualTo(CounterPreparationState.PARTIALLY_READY);
        assertThat(waiting.summary().readyItemCount()).isEqualTo(1);
        assertThat(waiting.summary().waitingItemCount()).isEqualTo(1);
        assertThat(waiting.summary().nextAction()).isEqualTo(CounterNextAction.FOLLOW_PREPARATION);

        BigDecimal total = tabService.getById(tab.id()).finalAmount();
        paymentService.create(new PaymentRequest(tab.id(), PaymentMethod.PIX, total.divide(BigDecimal.valueOf(2)), null));
        assertThat(counterSaleService.getById(tab.id()).summary().financialState())
                .isEqualTo(CounterFinancialState.PARTIALLY_PAID);
        paymentService.create(new PaymentRequest(tab.id(), PaymentMethod.PIX, total.divide(BigDecimal.valueOf(2)), null));
        CounterSaleDetailResponse paidAndWaiting = counterSaleService.getById(tab.id());
        assertThat(paidAndWaiting.summary().financialState()).isEqualTo(CounterFinancialState.PAID);
        assertThat(counterSaleService.listActive()).extracting(item -> item.id()).contains(tab.id());

        Long preparationItemId = confirmed.items().stream()
                .filter(item -> item.preparationFlow().name().equals("REQUIRES_PREPARATION"))
                .findFirst()
                .orElseThrow()
                .id();
        orderService.updateItemStatus(confirmed.id(), preparationItemId, new OrderItemStatusRequest(OrderItemStatus.IN_PREPARATION));
        orderService.updateItemStatus(confirmed.id(), preparationItemId, new OrderItemStatusRequest(OrderItemStatus.READY));
        CounterSaleDetailResponse ready = counterSaleService.getById(tab.id());
        assertThat(ready.summary().preparationState()).isEqualTo(CounterPreparationState.READY);
        assertThat(ready.summary().nextAction()).isEqualTo(CounterNextAction.DELIVER);

        orderService.updateStatus(confirmed.id(), new OrderStatusRequest(OrderStatus.DELIVERED));
        CounterSaleDetailResponse delivered = counterSaleService.getById(tab.id());
        assertThat(delivered.summary().attendanceState()).isEqualTo(CounterAttendanceState.READY_TO_FINISH);
        assertThat(delivered.summary().nextAction()).isEqualTo(CounterNextAction.FINALIZE);
        assertThat(counterSaleService.listActive()).extracting(item -> item.id()).contains(tab.id());

        counterSaleService.finish(tab.id());
        assertThat(counterSaleService.listActive()).extracting(item -> item.id()).doesNotContain(tab.id());
        assertThat(counterSaleService.listFinishedToday()).extracting(item -> item.id()).contains(tab.id());
    }

    @Test
    void cancelledCounterSaleLeavesTheActiveCenterAndRemainsSearchable() {
        TabResponse tab = openCounter("Cliente");
        RestaurantOrderResponse draft = createOrder(tab.id(), List.of(item(directProductId, directVariantId, 1)));
        orderService.cancel(draft.id(), new OrderCancellationRequest("Cliente desistiu"));
        tabService.cancel(tab.id());

        assertThat(counterSaleService.listActive()).extracting(item -> item.id()).doesNotContain(tab.id());
        assertThat(counterSaleService.searchHistory(null, null, tab.id(), null, TabStatus.CANCELLED, null))
                .singleElement()
                .satisfies(sale -> assertThat(sale.attendanceState()).isEqualTo(CounterAttendanceState.CANCELLED));
    }

    @Test
    void cancellationReversesStockIsIdempotentAndAllowsCounterTabCancellation() {
        TabResponse tab = openCounter(null);
        RestaurantOrderResponse order = orderService.confirm(
                createOrder(tab.id(), List.of(item(directProductId, directVariantId, 2))).id()
        );
        assertThat(stock()).isEqualByComparingTo("8.000");

        orderService.cancelItem(order.id(), order.items().getFirst().id(), new OrderCancellationRequest("Cliente desistiu"));
        orderService.cancel(order.id(), new OrderCancellationRequest("Cliente desistiu"));
        assertThat(stock()).isEqualByComparingTo("10.000");
        assertThat(jdbc.queryForObject(
                "select count(*) from inventory_movements where order_item_id = ? and type = 'REVERSAL'",
                Long.class,
                order.items().getFirst().id()
        )).isEqualTo(1L);
        assertThat(tabService.cancel(tab.id()).status()).isEqualTo(TabStatus.CANCELLED);
    }

    @Test
    void tableTabRegressionStillRequiresAndOccupiesRealTable() {
        TabResponse tab = tabService.open(new OpenTabRequest(tableId, null, BigDecimal.ZERO, BigDecimal.ZERO));
        assertThat(tab.type()).isEqualTo(TabType.TABLE);
        assertThat(tab.tableId()).isEqualTo(tableId);
        entityManager.flush();
        assertThat(jdbc.queryForObject("select status from restaurant_tables where id = ?", String.class, tableId))
                .isEqualTo("OCCUPIED");
    }

    @Test
    void monthlyReportUsesClosingDateSnapshotsAndAllRequiredAggregations() {
        insertClosedSale("TABLE", LocalDateTime.of(2026, 7, 5, 12, 0), "100", "10", "5", "105", "Coca-Cola", "Lata", 2, "PIX");
        insertClosedSale("COUNTER", LocalDateTime.of(2026, 7, 10, 18, 0), "50", "0", "0", "50", "Coca-Cola", "600 mL", 1, "CASH");
        insertClosedSale("TABLE", LocalDateTime.of(2026, 6, 15, 12, 0), "100", "0", "0", "100", "Jantinha", "Completa", 1, "PIX");
        insertDraftClosedTab(LocalDateTime.of(2026, 7, 12, 12, 0));
        insertCancellation(LocalDateTime.of(2026, 7, 20, 12, 0));

        MonthlyReportResponse report = reportService.generate(2026, 7, ReportChannel.ALL);
        assertThat(report.summary().grossRevenue()).isEqualByComparingTo("160.00");
        assertThat(report.summary().serviceFees()).isEqualByComparingTo("10.00");
        assertThat(report.summary().discounts()).isEqualByComparingTo("5.00");
        assertThat(report.summary().netRevenue()).isEqualByComparingTo("155.00");
        assertThat(report.summary().closedTabs()).isEqualTo(2);
        assertThat(report.summary().orders()).isEqualTo(2);
        assertThat(report.summary().itemsSold()).isEqualTo(3);
        assertThat(report.summary().averageTicket()).isEqualByComparingTo("77.50");
        assertThat(report.products()).hasSize(1);
        assertThat(report.products().getFirst().productName()).isEqualTo("Coca-Cola");
        assertThat(report.products().getFirst().variants()).extracting(MonthlyReportResponse.VariantPerformance::variantName)
                .containsExactly("Lata", "600 mL");
        assertThat(report.categories()).singleElement().satisfies(category -> {
            assertThat(category.categoryName()).isEqualTo("Bebidas");
            assertThat(category.quantity()).isEqualTo(3);
        });
        assertThat(report.paymentMethods()).extracting(MonthlyReportResponse.PaymentPerformance::method)
                .containsExactly("PIX", "CASH");
        assertThat(report.channels()).extracting(MonthlyReportResponse.ChannelPerformance::channel)
                .containsExactly("TABLE", "COUNTER");
        assertThat(report.daily()).hasSize(2);
        assertThat(report.comparison().previousMonthNetRevenue()).isEqualByComparingTo("100.00");
        assertThat(report.comparison().netRevenueDifference()).isEqualByComparingTo("55.00");
        assertThat(report.comparison().percentageChange()).isEqualByComparingTo("55.00");
        assertThat(report.cancellations().cancelledOrders()).isEqualTo(1);
        assertThat(report.cancellations().cancelledItems()).isEqualTo(1);
        assertThat(report.cancellations().cancelledAmount()).isEqualByComparingTo("30.00");
        assertThat(report.cancellations().mainReasons()).extracting(MonthlyReportResponse.CancellationReason::reason)
                .contains("Cliente desistiu");
    }

    @Test
    void monthlyReportFiltersChannelAndDoesNotInventPercentageWithoutPreviousBase() {
        insertClosedSale("TABLE", LocalDateTime.of(2026, 7, 5, 12, 0), "100", "0", "0", "100", "Coca-Cola", "Lata", 1, "PIX");
        insertClosedSale("COUNTER", LocalDateTime.of(2026, 7, 10, 18, 0), "50", "0", "0", "50", "Jantinha", "Completa", 1, "CASH");

        MonthlyReportResponse counter = reportService.generate(2026, 7, ReportChannel.COUNTER);
        assertThat(counter.summary().closedTabs()).isEqualTo(1);
        assertThat(counter.summary().netRevenue()).isEqualByComparingTo("50.00");
        assertThat(counter.products()).singleElement().satisfies(product -> assertThat(product.productName()).isEqualTo("Jantinha"));
        assertThat(counter.channels()).singleElement().satisfies(channel -> {
            assertThat(channel.channel()).isEqualTo("COUNTER");
            assertThat(channel.closedTabs()).isEqualTo(1);
            assertThat(channel.netRevenue()).isEqualByComparingTo("50.00");
        });
        assertThat(counter.comparison().previousMonthNetRevenue()).isZero();
        assertThat(counter.comparison().percentageChange()).isNull();
    }

    @Test
    void monthlyReportRejectsInvalidMonthAndYear() {
        assertThatThrownBy(() -> reportService.generate(2026, 13, ReportChannel.ALL))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("inválidos");
        assertThatThrownBy(() -> reportService.generate(1999, 12, ReportChannel.ALL))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("entre 2000 e 2100");
    }

    private TabResponse openCounter(String customerName) {
        return tabService.openCounter(new OpenCounterTabRequest(
                customerName, null, null, BigDecimal.ZERO, BigDecimal.ZERO));
    }

    private RestaurantOrderResponse createOrder(Long tabId, List<OrderItemRequest> items) {
        return orderService.create(new RestaurantOrderRequest(tabId, null, OrderType.TABLE, null, items));
    }

    private OrderItemRequest item(Long productId, Long variantId, int quantity) {
        return new OrderItemRequest(productId, variantId, quantity, null, List.of());
    }

    private Long insertProduct(String name, String flow) {
        return jdbc.queryForObject(
                """
                insert into products (category_id, name, description, preparation_flow, active, available, display_order)
                values (?, ?, 'Teste', ?, true, true, 0)
                returning id
                """,
                Long.class,
                categoryId,
                name + " " + UUID.randomUUID(),
                flow
        );
    }

    private Long insertVariant(Long productId, String name, String price) {
        return jdbc.queryForObject(
                """
                insert into product_variants (product_id, name, price, active, available, display_order)
                values (?, ?, cast(? as numeric), true, true, 0)
                returning id
                """,
                Long.class,
                productId,
                name,
                price
        );
    }

    private BigDecimal stock() {
        return jdbc.queryForObject("select current_stock from ingredients where id = ?", BigDecimal.class, stockItemId);
    }

    private void insertClosedSale(
            String type,
            LocalDateTime closedAt,
            String total,
            String service,
            String discount,
            String finalAmount,
            String productName,
            String variantName,
            int quantity,
            String paymentMethod
    ) {
        Long tabId = jdbc.queryForObject(
                """
                insert into tabs (
                    type, restaurant_table_id, status, opened_by_user_id, opened_at, closed_at, closed_business_date,
                    total_amount, service_fee, discount_amount, final_amount
                ) values (?, ?, 'CLOSED', ?, ?, ?, ?, cast(? as numeric), cast(? as numeric), cast(? as numeric), cast(? as numeric))
                returning id
                """,
                Long.class,
                type,
                "TABLE".equals(type) ? tableId : null,
                userId,
                closedAt.minusHours(1),
                closedAt,
                closedAt.toLocalDate(),
                total,
                service,
                discount,
                finalAmount
        );
        Long orderId = jdbc.queryForObject(
                """
                insert into orders (tab_id, status, type, created_by_user_id, confirmed_at, created_at, updated_at)
                values (?, 'DELIVERED', ?, ?, ?, ?, ?)
                returning id
                """,
                Long.class,
                tabId,
                type,
                userId,
                closedAt.minusMinutes(50),
                closedAt.minusHours(1),
                closedAt
        );
        BigDecimal itemAmount = new BigDecimal(total);
        jdbc.update(
                """
                insert into order_items (
                    order_id, product_id, product_variant_id, product_name_snapshot,
                    product_variant_name_snapshot, category_name_snapshot, preparation_flow_snapshot,
                    unit_price_snapshot, quantity, status, subtotal, created_at, updated_at
                ) values (?, ?, ?, ?, ?, 'Bebidas', 'DIRECT_SERVICE', ?, ?, 'DELIVERED', ?, ?, ?)
                """,
                orderId,
                directProductId,
                directVariantId,
                productName,
                variantName,
                itemAmount.divide(BigDecimal.valueOf(quantity)),
                quantity,
                itemAmount,
                closedAt.minusMinutes(45),
                closedAt
        );
        jdbc.update(
                """
                insert into payments (tab_id, method, amount, paid_at, received_by_user_id)
                values (?, ?, cast(? as numeric), ?, ?)
                """,
                tabId,
                paymentMethod,
                finalAmount,
                closedAt.minusMinutes(5),
                userId
        );
    }

    private void insertDraftClosedTab(LocalDateTime closedAt) {
        Long tabId = jdbc.queryForObject(
                """
                insert into tabs (type, status, opened_by_user_id, opened_at, closed_at, closed_business_date, total_amount, service_fee, discount_amount, final_amount)
                values ('COUNTER', 'CLOSED', ?, ?, ?, ?, 999, 0, 0, 999)
                returning id
                """,
                Long.class,
                userId,
                closedAt.minusHours(1),
                closedAt,
                closedAt.toLocalDate()
        );
        Long orderId = jdbc.queryForObject(
                "insert into orders (tab_id, status, type, created_by_user_id) values (?, 'CREATED', 'COUNTER', ?) returning id",
                Long.class,
                tabId,
                userId
        );
        jdbc.update(
                """
                insert into order_items (
                    order_id, product_id, product_variant_id, product_name_snapshot, product_variant_name_snapshot,
                    category_name_snapshot, preparation_flow_snapshot, unit_price_snapshot, quantity, status, subtotal
                ) values (?, ?, ?, 'Rascunho', 'Padrao', 'Bebidas', 'DIRECT_SERVICE', 999, 1, 'DRAFT', 999)
                """,
                orderId,
                directProductId,
                directVariantId
        );
    }

    private void insertCancellation(LocalDateTime cancelledAt) {
        Long tabId = jdbc.queryForObject(
                """
                insert into tabs (type, status, opened_by_user_id, opened_at, closed_at, closed_business_date, total_amount, service_fee, discount_amount, final_amount)
                values ('COUNTER', 'CANCELLED', ?, ?, ?, ?, 0, 0, 0, 0)
                returning id
                """,
                Long.class,
                userId,
                cancelledAt.minusHours(1),
                cancelledAt,
                cancelledAt.toLocalDate()
        );
        Long orderId = jdbc.queryForObject(
                """
                insert into orders (tab_id, status, type, created_by_user_id, cancellation_reason, cancelled_by_user_id, created_at, updated_at)
                values (?, 'CANCELLED', 'COUNTER', ?, 'Cliente desistiu', ?, ?, ?)
                returning id
                """,
                Long.class,
                tabId,
                userId,
                userId,
                cancelledAt.minusMinutes(30),
                cancelledAt
        );
        jdbc.update(
                """
                insert into order_items (
                    order_id, product_id, product_variant_id, product_name_snapshot, product_variant_name_snapshot,
                    category_name_snapshot, preparation_flow_snapshot, unit_price_snapshot, quantity, status, subtotal,
                    cancellation_reason, cancelled_at, cancelled_by_user_id
                ) values (?, ?, ?, 'Coca-Cola', 'Lata', 'Bebidas', 'DIRECT_SERVICE', 30, 1, 'CANCELED', 30, 'Cliente desistiu', ?, ?)
                """,
                orderId,
                directProductId,
                directVariantId,
                cancelledAt,
                userId
        );
    }
}
