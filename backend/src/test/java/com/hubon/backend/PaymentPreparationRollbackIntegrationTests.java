package com.hubon.backend;

import com.hubon.backend.auth.service.AuthenticatedUser;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.OrderType;
import com.hubon.backend.order.dto.OrderItemRequest;
import com.hubon.backend.order.dto.RestaurantOrderRequest;
import com.hubon.backend.order.dto.RestaurantOrderResponse;
import com.hubon.backend.order.service.OrderPreparationWorkflowService;
import com.hubon.backend.order.service.RestaurantOrderService;
import com.hubon.backend.payment.domain.PaymentMethod;
import com.hubon.backend.payment.dto.PaymentRequest;
import com.hubon.backend.payment.service.PaymentService;
import com.hubon.backend.role.domain.Role;
import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.dto.OpenCounterTabRequest;
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
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;

@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "hubon.security.permit-all=false",
        "hubon.seed.enabled=false"
})
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTestDatabaseGuard.class)
class PaymentPreparationRollbackIntegrationTests {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private TabService tabService;
    @Autowired private RestaurantOrderService orderService;
    @Autowired private PaymentService paymentService;

    @MockitoSpyBean
    private OrderPreparationWorkflowService preparationWorkflowService;

    private Long userId;
    private Long categoryId;
    private Long productId;
    private Long variantId;
    private Long tabId;
    private Long orderId;

    @BeforeEach
    void setup() {
        String suffix = UUID.randomUUID().toString();
        userId = jdbc.queryForObject(
                "insert into users (name, email, password, active) values ('Rollback', ?, '{noop}test', true) returning id",
                Long.class,
                "rollback-" + suffix + "@hubon.test"
        );
        categoryId = jdbc.queryForObject(
                "insert into categories (name, active, display_order) values (?, true, 0) returning id",
                Long.class,
                "Rollback " + suffix
        );
        productId = jdbc.queryForObject(
                "insert into products (category_id, name, preparation_flow, active, available, display_order) values (?, ?, 'REQUIRES_PREPARATION', true, true, 0) returning id",
                Long.class,
                categoryId,
                "Produto Rollback " + suffix
        );
        variantId = jdbc.queryForObject(
                "insert into product_variants (product_id, name, price, active, available, display_order) values (?, 'Padrão', 30, true, true, 0) returning id",
                Long.class,
                productId
        );

        User user = User.builder()
                .id(userId)
                .name("Rollback")
                .email("rollback-authenticated@hubon.test")
                .password("{noop}test")
                .active(true)
                .roles(Set.of(Role.builder().name("OWNER").build()))
                .build();
        AuthenticatedUser principal = new AuthenticatedUser(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities())
        );

        TabResponse tab = tabService.openCounter(new OpenCounterTabRequest(
                null, null, null, BigDecimal.ZERO, BigDecimal.ZERO));
        tabId = tab.id();
        RestaurantOrderResponse order = orderService.create(new RestaurantOrderRequest(
                tabId,
                null,
                OrderType.COUNTER,
                null,
                List.of(new OrderItemRequest(productId, variantId, 1, null, List.of()))
        ));
        orderId = order.id();
        orderService.confirm(orderId);
    }

    @AfterEach
    void cleanup() {
        reset(preparationWorkflowService);
        SecurityContextHolder.clearContext();
        if (tabId != null) jdbc.update("delete from payments where tab_id = ?", tabId);
        if (orderId != null) {
            jdbc.update("delete from order_item_options where order_item_id in (select id from order_items where order_id = ?)", orderId);
            jdbc.update("delete from inventory_movements where order_item_id in (select id from order_items where order_id = ?)", orderId);
            jdbc.update("delete from order_items where order_id = ?", orderId);
            jdbc.update("delete from orders where id = ?", orderId);
        }
        if (tabId != null) jdbc.update("delete from tabs where id = ?", tabId);
        if (variantId != null) jdbc.update("delete from product_variants where id = ?", variantId);
        if (productId != null) jdbc.update("delete from products where id = ?", productId);
        if (categoryId != null) jdbc.update("delete from categories where id = ?", categoryId);
        if (userId != null) jdbc.update("delete from users where id = ?", userId);
    }

    @Test
    void preparationFailureRollsBackThePayment() {
        doThrow(new IllegalStateException("Falha simulada no preparo"))
                .when(preparationWorkflowService)
                .startEligibleCounterItems(any(Tab.class));

        assertThatThrownBy(() -> paymentService.create(new PaymentRequest(
                tabId, PaymentMethod.PIX, new BigDecimal("30.00"), null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Falha simulada");

        assertThat(jdbc.queryForObject(
                "select count(*) from payments where tab_id = ?",
                Long.class,
                tabId
        )).isZero();
        assertThat(jdbc.queryForObject(
                "select status from order_items where order_id = ?",
                String.class,
                orderId
        )).isEqualTo(OrderItemStatus.WAITING_PREPARATION.name());
    }
}
