package com.hubon.backend;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

@SpringBootTest(properties = "spring.jpa.show-sql=false")
class FinancialRulesIntegrationTests {

    private static final AtomicInteger TABLE_NUMBER = new AtomicInteger(20_000);
    private static final String BUSINESS_EXCEPTION =
            "com.hubon.backend.shared.exception.BusinessException";

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Scenario scenario;

    @AfterEach
    void cleanup() {
        if (scenario == null) {
            return;
        }

        jdbcTemplate.update("delete from payments where tab_id = ?", scenario.tabId());
        jdbcTemplate.update("delete from order_items where order_id = ?", scenario.orderId());
        jdbcTemplate.update("delete from orders where id = ?", scenario.orderId());
        jdbcTemplate.update("delete from tabs where id = ?", scenario.tabId());
        jdbcTemplate.update("delete from products where id = ?", scenario.productId());
        jdbcTemplate.update("delete from categories where id = ?", scenario.categoryId());
        jdbcTemplate.update("delete from restaurant_tables where id = ?", scenario.tableId());
        jdbcTemplate.update("delete from users where id = ?", scenario.userId());
    }

    @Test
    void shouldRegisterValidPayment() throws Throwable {
        scenario = createScenario();

        createPayment("40.00", "PIX");

        assertMoney("40.00", paidAmount());
    }

    @Test
    void shouldRejectZeroPayment() {
        scenario = createScenario();

        Throwable failure = captureFailure(() -> createPayment("0.00", "CASH"));

        assertBusinessFailure(failure, "Pagamento deve ser maior que zero");
        assertMoney("0.00", paidAmount());
    }

    @Test
    void shouldRejectPaymentAboveRemainingAmount() {
        scenario = createScenario();

        Throwable failure = captureFailure(() -> createPayment("100.01", "CREDIT_CARD"));

        assertBusinessFailure(
                failure,
                "Soma dos pagamentos não pode ultrapassar o valor final da comanda"
        );
        assertMoney("0.00", paidAmount());
    }

    @Test
    void shouldSerializeConcurrentPaymentsWithoutExceedingTabTotal() throws Exception {
        scenario = createScenario();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try {
            Future<Throwable> first = executor.submit(
                    () -> executeConcurrentPayment("PIX", ready, start)
            );
            Future<Throwable> second = executor.submit(
                    () -> executeConcurrentPayment("DEBIT_CARD", ready, start)
            );

            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();

            Throwable firstResult = first.get(10, TimeUnit.SECONDS);
            Throwable secondResult = second.get(10, TimeUnit.SECONDS);
            long successfulPayments = java.util.stream.Stream.of(firstResult, secondResult)
                    .filter(result -> result == null)
                    .count();
            Throwable rejectedPayment = firstResult == null ? secondResult : firstResult;

            assertEquals(1, successfulPayments);
            assertBusinessFailure(
                    rejectedPayment,
                    "Soma dos pagamentos não pode ultrapassar o valor final da comanda"
            );
            assertMoney("60.00", paidAmount());
            assertEquals(1, paymentCount());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void shouldRejectOrderCancellationWhenTabHasPayments() throws Throwable {
        scenario = createScenario();
        createPayment("10.00", "CASH");

        Throwable failure = captureFailure(() -> cancelOrder(scenario.orderId()));

        assertBusinessFailure(
                failure,
                "Não é possível cancelar um pedido de uma comanda com pagamentos registrados"
        );
        assertEquals("CREATED", orderStatus());
    }

    @Test
    void shouldRejectDeliveredOrderCancellation() {
        scenario = createScenario();
        updateOrderStatus("DELIVERED");

        Throwable failure = captureFailure(() -> cancelOrder(scenario.orderId()));

        assertBusinessFailure(failure, "Pedido entregue não pode ser cancelado");
        assertEquals("DELIVERED", orderStatus());
    }

    @Test
    void shouldExcludeCancelledOrderFromTabTotalBeforePayment() throws Throwable {
        scenario = createScenario();

        cancelOrder(scenario.orderId());

        assertEquals("CANCELLED", orderStatus());
        assertMoney("0.00", tabAmount("total_amount"));
        assertMoney("0.00", tabAmount("final_amount"));
        assertMoney("0.00", paidAmount());
    }

    @Test
    void shouldRejectTabCancellationWhenPaymentsExist() {
        scenario = createScenario();
        updateOrderStatus("CANCELLED");
        insertPayment("10.00", "CASH");

        Throwable failure = captureFailure(() -> cancelTab(scenario.tabId()));

        assertBusinessFailure(
                failure,
                "Não é possível cancelar uma comanda com pagamentos registrados."
        );
        assertEquals("OPEN", tabStatus());
    }

    @Test
    void shouldRejectTabCancellationWhenDeliveredOrdersExist() {
        scenario = createScenario();
        updateOrderStatus("DELIVERED");

        Throwable failure = captureFailure(() -> cancelTab(scenario.tabId()));

        assertBusinessFailure(
                failure,
                "Não é possível cancelar uma comanda com pedidos entregues."
        );
        assertEquals("OPEN", tabStatus());
    }

    @Test
    void shouldRejectClosingWithoutFullPayment() throws Throwable {
        scenario = createScenario();
        updateOrderStatus("DELIVERED");
        createPayment("90.00", "PIX");

        Throwable failure = captureFailure(() -> closeTab(scenario.tabId()));

        assertBusinessFailure(failure, "Comanda não pode ser fechada sem pagamento completo");
        assertEquals("OPEN", tabStatus());
    }

    @Test
    void shouldRejectClosingWithExcessPayment() {
        scenario = createScenario();
        updateOrderStatus("DELIVERED");
        insertPayment("110.00", "CREDIT_CARD");

        Throwable failure = captureFailure(() -> closeTab(scenario.tabId()));

        assertBusinessFailure(
                failure,
                "Não é possível fechar uma comanda com pagamento excedente"
        );
        assertEquals("OPEN", tabStatus());
    }

    @Test
    void shouldCloseWithExactPaymentAndReleaseTable() throws Throwable {
        scenario = createScenario();
        updateOrderStatus("DELIVERED");
        createPayment("100.00", "PIX");

        closeTab(scenario.tabId());

        assertEquals("CLOSED", tabStatus());
        assertEquals("AVAILABLE", tableStatus());
        assertMoney("100.00", paidAmount());
    }

    private Scenario createScenario() {
        String suffix = UUID.randomUUID().toString();
        Long userId = jdbcTemplate.queryForObject(
                """
                insert into users (name, email, password, active)
                values (?, ?, ?, true)
                returning id
                """,
                Long.class,
                "Operador financeiro",
                "finance-" + suffix + "@hubon.test",
                "{noop}test"
        );
        Long categoryId = jdbcTemplate.queryForObject(
                """
                insert into categories (name, description, active, display_order)
                values (?, ?, true, 0)
                returning id
                """,
                Long.class,
                "Categoria " + suffix,
                "Categoria usada em teste financeiro"
        );
        Long productId = jdbcTemplate.queryForObject(
                """
                insert into products (category_id, name, price, active)
                values (?, ?, 100.00, true)
                returning id
                """,
                Long.class,
                categoryId,
                "Produto " + suffix
        );
        Long tableId = jdbcTemplate.queryForObject(
                """
                insert into restaurant_tables (number, name, status, active)
                values (?, ?, 'OCCUPIED', true)
                returning id
                """,
                Long.class,
                TABLE_NUMBER.incrementAndGet(),
                "Mesa de teste"
        );
        Long tabId = jdbcTemplate.queryForObject(
                """
                insert into tabs (
                    restaurant_table_id,
                    status,
                    opened_by_user_id,
                    total_amount,
                    service_fee,
                    discount_amount,
                    final_amount
                )
                values (?, 'OPEN', ?, 0, 0, 0, 0)
                returning id
                """,
                Long.class,
                tableId,
                userId
        );
        Long orderId = jdbcTemplate.queryForObject(
                """
                insert into orders (tab_id, status, type, created_by_user_id)
                values (?, 'CREATED', 'TABLE', ?)
                returning id
                """,
                Long.class,
                tabId,
                userId
        );
        jdbcTemplate.update(
                """
                insert into order_items (
                    order_id,
                    product_id,
                    product_name_snapshot,
                    unit_price_snapshot,
                    quantity,
                    status,
                    subtotal
                )
                values (?, ?, ?, 100.00, 1, 'ACTIVE', 100.00)
                """,
                orderId,
                productId,
                "Produto " + suffix
        );

        return new Scenario(userId, categoryId, productId, tableId, tabId, orderId);
    }

    private void createPayment(String amount, String method) throws Throwable {
        Object request = newPaymentRequest(amount, method);
        invokeService("paymentService", "create", request);
    }

    private void cancelOrder(Long orderId) throws Throwable {
        invokeService("restaurantOrderService", "cancel", orderId);
    }

    private void cancelTab(Long tabId) throws Throwable {
        invokeService("tabService", "cancel", tabId);
    }

    private void closeTab(Long tabId) throws Throwable {
        invokeService("tabService", "close", tabId);
    }

    private Object newPaymentRequest(String amount, String method) throws Exception {
        Class<?> paymentMethodClass = Class.forName(
                "com.hubon.backend.payment.domain.PaymentMethod"
        );
        Class<?> paymentRequestClass = Class.forName(
                "com.hubon.backend.payment.dto.PaymentRequest"
        );
        @SuppressWarnings({"rawtypes", "unchecked"})
        Object paymentMethod = Enum.valueOf(
                (Class<? extends Enum>) paymentMethodClass.asSubclass(Enum.class),
                method
        );
        Constructor<?> constructor = paymentRequestClass.getConstructor(
                Long.class,
                paymentMethodClass,
                BigDecimal.class,
                Long.class
        );
        return constructor.newInstance(
                scenario.tabId(),
                paymentMethod,
                new BigDecimal(amount),
                scenario.userId()
        );
    }

    private Object invokeService(String beanName, String methodName, Object argument) throws Throwable {
        Object service = applicationContext.getBean(beanName);
        Method method = service.getClass().getMethod(methodName, argument.getClass());
        try {
            return method.invoke(service, argument);
        } catch (InvocationTargetException exception) {
            throw exception.getCause();
        }
    }

    private Throwable executeConcurrentPayment(
            String method,
            CountDownLatch ready,
            CountDownLatch start
    ) {
        ready.countDown();
        try {
            if (!start.await(5, TimeUnit.SECONDS)) {
                return new IllegalStateException("Tempo excedido ao iniciar pagamentos concorrentes");
            }
            createPayment("60.00", method);
            return null;
        } catch (Throwable exception) {
            return exception;
        }
    }

    private Throwable captureFailure(ThrowingOperation operation) {
        try {
            operation.run();
        } catch (Throwable exception) {
            return exception;
        }
        fail("A operação deveria ter falhado");
        return null;
    }

    private void assertBusinessFailure(Throwable failure, String message) {
        assertTrue(failure != null, "Era esperada uma falha de negócio");
        assertEquals(BUSINESS_EXCEPTION, failure.getClass().getName());
        assertEquals(message, failure.getMessage());
    }

    private void insertPayment(String amount, String method) {
        jdbcTemplate.update(
                """
                insert into payments (tab_id, method, amount, received_by_user_id)
                values (?, ?, ?, ?)
                """,
                scenario.tabId(),
                method,
                new BigDecimal(amount),
                scenario.userId()
        );
    }

    private void updateOrderStatus(String status) {
        jdbcTemplate.update(
                "update orders set status = ?, updated_at = current_timestamp where id = ?",
                status,
                scenario.orderId()
        );
    }

    private BigDecimal paidAmount() {
        return jdbcTemplate.queryForObject(
                "select coalesce(sum(amount), 0) from payments where tab_id = ?",
                BigDecimal.class,
                scenario.tabId()
        );
    }

    private int paymentCount() {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from payments where tab_id = ?",
                Integer.class,
                scenario.tabId()
        );
        return count == null ? 0 : count;
    }

    private BigDecimal tabAmount(String column) {
        if (!column.equals("total_amount") && !column.equals("final_amount")) {
            throw new IllegalArgumentException("Coluna financeira não permitida");
        }
        return jdbcTemplate.queryForObject(
                "select " + column + " from tabs where id = ?",
                BigDecimal.class,
                scenario.tabId()
        );
    }

    private String orderStatus() {
        return jdbcTemplate.queryForObject(
                "select status from orders where id = ?",
                String.class,
                scenario.orderId()
        );
    }

    private String tabStatus() {
        return jdbcTemplate.queryForObject(
                "select status from tabs where id = ?",
                String.class,
                scenario.tabId()
        );
    }

    private String tableStatus() {
        return jdbcTemplate.queryForObject(
                "select status from restaurant_tables where id = ?",
                String.class,
                scenario.tableId()
        );
    }

    private void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual));
    }

    @FunctionalInterface
    private interface ThrowingOperation {
        void run() throws Throwable;
    }

    private record Scenario(
            Long userId,
            Long categoryId,
            Long productId,
            Long tableId,
            Long tabId,
            Long orderId
    ) {
    }
}
