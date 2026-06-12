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
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

@SpringBootTest(properties = "spring.jpa.show-sql=false")
class OperationalConsistencyIntegrationTests {

    private static final AtomicInteger TABLE_NUMBER = new AtomicInteger(30_000);
    private static final String BUSINESS_EXCEPTION =
            "com.hubon.backend.shared.exception.BusinessException";

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long userId;
    private Long tableId;
    private Long tabId;
    private Long categoryId;
    private Long productId;

    @AfterEach
    void cleanup() {
        if (tabId != null) {
            jdbcTemplate.update(
                    "delete from order_items where order_id in (select id from orders where tab_id = ?)",
                    tabId
            );
            jdbcTemplate.update("delete from orders where tab_id = ?", tabId);
            jdbcTemplate.update("delete from payments where tab_id = ?", tabId);
            jdbcTemplate.update("delete from tabs where id = ?", tabId);
        }
        if (productId != null) {
            jdbcTemplate.update("delete from products where id = ?", productId);
        }
        if (categoryId != null) {
            jdbcTemplate.update("delete from categories where id = ?", categoryId);
        }
        if (tableId != null) {
            jdbcTemplate.update("delete from restaurant_tables where id = ?", tableId);
        }
        if (userId != null) {
            jdbcTemplate.update("delete from users where id = ?", userId);
        }
    }

    @Test
    void shouldRejectOccupiedStatusOnManualCreation() throws Exception {
        Object request = newRestaurantTableRequest(
                TABLE_NUMBER.incrementAndGet(),
                "Mesa manual",
                "OCCUPIED",
                false
        );

        Throwable failure = captureFailure(
                () -> invokeService("restaurantTableService", "create", request)
        );

        assertBusinessFailure(
                failure,
                "Status OCCUPIED é controlado pelo ciclo da comanda"
        );
    }

    @Test
    void shouldRejectOccupiedStatusOnManualUpdate() throws Exception {
        tableId = insertTable("AVAILABLE");
        Object updateRequest = newRestaurantTableRequest(
                tableNumber(),
                "Mesa alterada",
                "OCCUPIED",
                false
        );
        Object statusRequest = newTableStatusRequest("OCCUPIED");

        Throwable updateFailure = captureFailure(
                () -> invokeService("restaurantTableService", "update", tableId, updateRequest)
        );
        Throwable statusFailure = captureFailure(
                () -> invokeService("restaurantTableService", "updateStatus", tableId, statusRequest)
        );

        assertBusinessFailure(
                updateFailure,
                "Status OCCUPIED é controlado pelo ciclo da comanda"
        );
        assertBusinessFailure(
                statusFailure,
                "Status OCCUPIED é controlado pelo ciclo da comanda"
        );
        assertEquals("AVAILABLE", tableStatus());
    }

    @Test
    void shouldRejectOpeningTabForReservedTable() throws Exception {
        userId = insertUser();
        tableId = insertTable("RESERVED");
        Object request = newOpenTabRequest();

        Throwable failure = captureFailure(
                () -> invokeService("tabService", "open", request)
        );

        assertBusinessFailure(
                failure,
                "Mesa reservada não pode abrir comanda diretamente."
        );
        assertEquals("RESERVED", tableStatus());
    }

    @Test
    void shouldControlOccupiedStatusThroughTabLifecycle() throws Throwable {
        userId = insertUser();
        tableId = insertTable("AVAILABLE");

        Object openedTab = invokeService("tabService", "open", newOpenTabRequest());
        tabId = responseId(openedTab);

        assertEquals("OCCUPIED", tableStatus());

        invokeService("tabService", "cancel", tabId);

        assertEquals("AVAILABLE", tableStatus());
    }

    @Test
    void shouldRejectProductFromInactiveCategoryInNewOrder() throws Exception {
        userId = insertUser();
        tableId = insertTable("OCCUPIED");
        tabId = insertOpenTab();
        categoryId = insertCategory(false);
        productId = insertProduct();
        Object request = newRestaurantOrderRequest();

        Throwable failure = captureFailure(
                () -> invokeService("restaurantOrderService", "create", request)
        );

        assertBusinessFailure(
                failure,
                "Produto pertence a uma categoria inativa."
        );
        assertEquals(0, orderCount());
    }

    @Test
    void shouldLoadDashboardWithAtMostFiveRecentOrders() throws Throwable {
        Object response = invokeService("dashboardService", "getSummary");
        @SuppressWarnings("unchecked")
        List<Object> recentOrders = (List<Object>) response.getClass()
                .getMethod("recentOrders")
                .invoke(response);

        assertTrue(recentOrders.size() <= 5);
    }

    private Object newRestaurantTableRequest(
            Integer number,
            String name,
            String status,
            Boolean active
    ) throws Exception {
        Class<?> statusClass = Class.forName(
                "com.hubon.backend.table.domain.TableStatus"
        );
        Class<?> requestClass = Class.forName(
                "com.hubon.backend.table.dto.RestaurantTableRequest"
        );
        Constructor<?> constructor = requestClass.getConstructor(
                Integer.class,
                String.class,
                statusClass,
                Boolean.class
        );
        return constructor.newInstance(number, name, enumValue(statusClass, status), active);
    }

    private Object newTableStatusRequest(String status) throws Exception {
        Class<?> statusClass = Class.forName(
                "com.hubon.backend.table.domain.TableStatus"
        );
        Class<?> requestClass = Class.forName(
                "com.hubon.backend.table.dto.TableStatusRequest"
        );
        return requestClass
                .getConstructor(statusClass)
                .newInstance(enumValue(statusClass, status));
    }

    private Object newOpenTabRequest() throws Exception {
        Class<?> requestClass = Class.forName(
                "com.hubon.backend.tab.dto.OpenTabRequest"
        );
        return requestClass
                .getConstructor(Long.class, Long.class, BigDecimal.class, BigDecimal.class)
                .newInstance(tableId, userId, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    private Object newRestaurantOrderRequest() throws Exception {
        Class<?> orderTypeClass = Class.forName(
                "com.hubon.backend.order.domain.OrderType"
        );
        Class<?> itemRequestClass = Class.forName(
                "com.hubon.backend.order.dto.OrderItemRequest"
        );
        Object itemRequest = itemRequestClass
                .getConstructor(Long.class, Integer.class, String.class)
                .newInstance(productId, 1, null);
        Class<?> orderRequestClass = Class.forName(
                "com.hubon.backend.order.dto.RestaurantOrderRequest"
        );
        return orderRequestClass
                .getConstructor(
                        Long.class,
                        Long.class,
                        orderTypeClass,
                        String.class,
                        List.class
                )
                .newInstance(
                        tabId,
                        userId,
                        enumValue(orderTypeClass, "TABLE"),
                        null,
                        List.of(itemRequest)
                );
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private Object enumValue(Class<?> enumClass, String value) {
        return Enum.valueOf(
                (Class<? extends Enum>) enumClass.asSubclass(Enum.class),
                value
        );
    }

    private Object invokeService(
            String beanName,
            String methodName,
            Object... arguments
    ) throws Throwable {
        Object service = applicationContext.getBean(beanName);
        Method method = findMethod(service.getClass(), methodName, arguments.length);
        try {
            return method.invoke(service, arguments);
        } catch (InvocationTargetException exception) {
            throw exception.getCause();
        }
    }

    private Method findMethod(Class<?> serviceClass, String methodName, int parameterCount) {
        return java.util.Arrays.stream(serviceClass.getMethods())
                .filter(method -> method.getName().equals(methodName))
                .filter(method -> method.getParameterCount() == parameterCount)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Método de serviço não encontrado"));
    }

    private Long responseId(Object response) throws Exception {
        return (Long) response.getClass().getMethod("id").invoke(response);
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

    private Long insertUser() {
        String suffix = UUID.randomUUID().toString();
        return jdbcTemplate.queryForObject(
                """
                insert into users (name, email, password, active)
                values (?, ?, ?, true)
                returning id
                """,
                Long.class,
                "Operador operacional",
                "operator-" + suffix + "@hubon.test",
                "{noop}test"
        );
    }

    private Long insertTable(String status) {
        return jdbcTemplate.queryForObject(
                """
                insert into restaurant_tables (number, name, status, active)
                values (?, ?, ?, true)
                returning id
                """,
                Long.class,
                TABLE_NUMBER.incrementAndGet(),
                "Mesa de teste",
                status
        );
    }

    private Long insertOpenTab() {
        return jdbcTemplate.queryForObject(
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
    }

    private Long insertCategory(boolean active) {
        return jdbcTemplate.queryForObject(
                """
                insert into categories (name, description, active, display_order)
                values (?, ?, ?, 0)
                returning id
                """,
                Long.class,
                "Categoria " + UUID.randomUUID(),
                "Categoria de teste",
                active
        );
    }

    private Long insertProduct() {
        return jdbcTemplate.queryForObject(
                """
                insert into products (category_id, name, price, active)
                values (?, ?, 25.00, true)
                returning id
                """,
                Long.class,
                categoryId,
                "Produto de categoria inativa"
        );
    }

    private Integer tableNumber() {
        return jdbcTemplate.queryForObject(
                "select number from restaurant_tables where id = ?",
                Integer.class,
                tableId
        );
    }

    private String tableStatus() {
        return jdbcTemplate.queryForObject(
                "select status from restaurant_tables where id = ?",
                String.class,
                tableId
        );
    }

    private int orderCount() {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from orders where tab_id = ?",
                Integer.class,
                tabId
        );
        return count == null ? 0 : count;
    }

    @FunctionalInterface
    private interface ThrowingOperation {
        void run() throws Throwable;
    }
}
