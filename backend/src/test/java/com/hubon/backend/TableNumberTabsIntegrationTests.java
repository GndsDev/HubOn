package com.hubon.backend;

import com.hubon.backend.auth.service.AuthenticatedUser;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.OrderType;
import com.hubon.backend.order.dto.OrderItemRequest;
import com.hubon.backend.order.dto.OrderItemStatusRequest;
import com.hubon.backend.order.dto.RestaurantOrderRequest;
import com.hubon.backend.order.dto.RestaurantOrderResponse;
import com.hubon.backend.order.service.RestaurantOrderService;
import com.hubon.backend.payment.domain.PaymentMethod;
import com.hubon.backend.payment.dto.PaymentRequest;
import com.hubon.backend.payment.service.PaymentService;
import com.hubon.backend.role.domain.Role;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.dto.OpenCounterTabRequest;
import com.hubon.backend.tab.dto.OpenTabRequest;
import com.hubon.backend.tab.dto.TabResponse;
import com.hubon.backend.tab.service.TabService;
import com.hubon.backend.user.domain.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
class TableNumberTabsIntegrationTests {

    private static final AtomicInteger TABLE_NUMBER = new AtomicInteger(250_000);

    @Autowired private JdbcTemplate jdbc;
    @Autowired private TabService tabService;
    @Autowired private RestaurantOrderService orderService;
    @Autowired private PaymentService paymentService;

    private Long userId;
    private Long categoryId;
    private Long productId;
    private Long variantId;

    @BeforeEach
    void setup() {
        String suffix = UUID.randomUUID().toString();
        userId = jdbc.queryForObject(
                "insert into users (name, email, password, active) values ('Mesa Numero', ?, '{noop}test', true) returning id",
                Long.class,
                "table-number-" + suffix + "@hubon.test"
        );
        categoryId = jdbc.queryForObject(
                "insert into categories (name, active, display_order) values (?, true, 0) returning id",
                Long.class,
                "Mesa Numero " + suffix
        );
        productId = jdbc.queryForObject(
                "insert into products (category_id, name, preparation_flow, active, available, display_order) values (?, ?, 'DIRECT_SERVICE', true, true, 0) returning id",
                Long.class,
                categoryId,
                "Produto Mesa Numero " + suffix
        );
        variantId = jdbc.queryForObject(
                "insert into product_variants (product_id, name, price, active, available, display_order) values (?, 'Padrão', 35, true, true, 0) returning id",
                Long.class,
                productId
        );

        User user = User.builder()
                .id(userId)
                .name("Mesa Numero")
                .email("table-number-authenticated@hubon.test")
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
    void cleanupAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void migrationAddsTableNumberAndOpenTableTabsAreUniqueByNumber() {
        assertThat(jdbc.queryForObject(
                "select count(*) from information_schema.columns where table_name = 'tabs' and column_name = 'table_number'",
                Integer.class
        )).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "select count(*) from pg_indexes where indexname = 'uq_tabs_one_open_table_number'",
                Integer.class
        )).isEqualTo(1);
    }

    @Test
    void opensTableTabByNumberWithoutCreatingRestaurantTableAndRejectsInvalidOrigins() {
        int tableCountBefore = tableCount();
        int tableNumber = TABLE_NUMBER.incrementAndGet();

        TabResponse tab = tabService.open(new OpenTabRequest(null, tableNumber, null, BigDecimal.ZERO, BigDecimal.ZERO));

        assertThat(tab.type().name()).isEqualTo("TABLE");
        assertThat(tab.tableId()).isNull();
        assertThat(tab.tableNumber()).isEqualTo(tableNumber);
        assertThat(tab.displayLabel()).isEqualTo("Mesa " + tableNumber);
        assertThat(tableCount()).isEqualTo(tableCountBefore);

        assertThatThrownBy(() -> tabService.open(new OpenTabRequest(null, tableNumber, null, BigDecimal.ZERO, BigDecimal.ZERO)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Já existe uma comanda aberta para a Mesa " + tableNumber + ".");
        assertThatThrownBy(() -> tabService.open(new OpenTabRequest(null, 0, null, BigDecimal.ZERO, BigDecimal.ZERO)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("maior que zero");
        assertThatThrownBy(() -> tabService.openCounter(new OpenCounterTabRequest(
                null, null, null, BigDecimal.ZERO, BigDecimal.ZERO, tableNumber)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("não deve informar número de mesa");
    }

    @Test
    void paymentAndCloseRulesFollowTheTableTabLifecycle() {
        int tableNumber = TABLE_NUMBER.incrementAndGet();
        TabResponse tab = tabService.open(new OpenTabRequest(null, tableNumber, null, BigDecimal.ZERO, BigDecimal.ZERO));

        assertThatThrownBy(() -> tabService.close(tab.id()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Comanda vazia");

        RestaurantOrderResponse order = orderService.create(new RestaurantOrderRequest(
                tab.id(),
                null,
                OrderType.TABLE,
                null,
                List.of(new OrderItemRequest(productId, variantId, 1, null, List.of()))
        ));
        RestaurantOrderResponse confirmed = orderService.confirm(order.id());
        Long itemId = confirmed.items().getFirst().id();

        assertThatThrownBy(() -> paymentService.create(new PaymentRequest(
                tab.id(), PaymentMethod.PIX, new BigDecimal("35.00"), null)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Abra o caixa");

        jdbc.update(
                "insert into cash_shifts (status, opened_by_user_id, opening_balance) values ('OPEN', ?, 0)",
                userId
        );
        paymentService.create(new PaymentRequest(tab.id(), PaymentMethod.PIX, new BigDecimal("35.00"), null));
        assertThatThrownBy(() -> orderService.create(new RestaurantOrderRequest(
                tab.id(),
                null,
                OrderType.TABLE,
                null,
                List.of(new OrderItemRequest(productId, variantId, 1, null, List.of()))
        )))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("já foi paga");

        orderService.updateItemStatus(order.id(), itemId, new OrderItemStatusRequest(OrderItemStatus.DELIVERED));

        TabResponse closed = tabService.close(tab.id());
        TabResponse idempotent = tabService.close(tab.id());
        assertThat(closed.status()).isEqualTo(TabStatus.CLOSED);
        assertThat(idempotent.status()).isEqualTo(TabStatus.CLOSED);

        TabResponse reopened = tabService.open(new OpenTabRequest(null, tableNumber, null, BigDecimal.ZERO, BigDecimal.ZERO));
        assertThat(reopened.tableNumber()).isEqualTo(tableNumber);
        assertThat(reopened.status()).isEqualTo(TabStatus.OPEN);
    }

    private int tableCount() {
        Integer count = jdbc.queryForObject("select count(*) from restaurant_tables", Integer.class);
        return count == null ? 0 : count;
    }
}
