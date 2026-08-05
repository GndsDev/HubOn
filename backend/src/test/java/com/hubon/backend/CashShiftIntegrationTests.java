package com.hubon.backend;

import com.hubon.backend.auth.service.AuthenticatedUser;
import com.hubon.backend.cash.domain.CashMovementType;
import com.hubon.backend.cash.domain.CashShiftStatus;
import com.hubon.backend.cash.dto.CashMovementRequest;
import com.hubon.backend.cash.dto.CashShiftResponse;
import com.hubon.backend.cash.dto.CloseCashShiftRequest;
import com.hubon.backend.cash.dto.OpenCashShiftRequest;
import com.hubon.backend.cash.service.CashShiftService;
import com.hubon.backend.order.domain.OrderType;
import com.hubon.backend.order.dto.OrderItemRequest;
import com.hubon.backend.order.dto.RestaurantOrderRequest;
import com.hubon.backend.order.service.RestaurantOrderService;
import com.hubon.backend.payment.domain.PaymentMethod;
import com.hubon.backend.payment.dto.PaymentRequest;
import com.hubon.backend.payment.service.PaymentService;
import com.hubon.backend.role.domain.Role;
import com.hubon.backend.shared.exception.BusinessException;
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
class CashShiftIntegrationTests {

    private static final AtomicInteger TABLE_NUMBER = new AtomicInteger(180_000);

    @Autowired private JdbcTemplate jdbc;
    @Autowired private CashShiftService cashShiftService;
    @Autowired private TabService tabService;
    @Autowired private RestaurantOrderService orderService;
    @Autowired private PaymentService paymentService;

    private Long userId;
    private Long tableId;
    private Long productId;
    private Long variantId;

    @BeforeEach
    void setup() {
        String suffix = UUID.randomUUID().toString();
        userId = jdbc.queryForObject(
                "insert into users (name, email, password, active) values ('Operador Caixa', ?, '{noop}test', true) returning id",
                Long.class,
                "cash-" + suffix + "@hubon.test"
        );
        Long categoryId = jdbc.queryForObject(
                "insert into categories (name, active, display_order) values (?, true, 0) returning id",
                Long.class,
                "Caixa " + suffix
        );
        tableId = jdbc.queryForObject(
                "insert into restaurant_tables (number, name, status, active) values (?, 'Caixa', 'AVAILABLE', true) returning id",
                Long.class,
                TABLE_NUMBER.incrementAndGet()
        );
        productId = jdbc.queryForObject(
                "insert into products (category_id, name, preparation_flow, active, available, display_order) values (?, ?, 'DIRECT_SERVICE', true, true, 0) returning id",
                Long.class,
                categoryId,
                "Produto Caixa " + suffix
        );
        variantId = jdbc.queryForObject(
                "insert into product_variants (product_id, name, price, active, available, display_order) values (?, 'Padrão', 25, true, true, 0) returning id",
                Long.class,
                productId
        );

        User user = User.builder()
                .id(userId)
                .name("Operador Caixa")
                .email("cash-authenticated@hubon.test")
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
    void aggregatesPaymentsSupplyAndWithdrawalInTheOpenShift() {
        CashShiftResponse opened = cashShiftService.open(new OpenCashShiftRequest(new BigDecimal("100.00")));
        TabResponse tab = tabService.open(new OpenTabRequest(tableId, null, null, BigDecimal.ZERO, BigDecimal.ZERO));
        orderService.confirm(orderService.create(new RestaurantOrderRequest(
                tab.id(), null, OrderType.TABLE, null,
                List.of(new OrderItemRequest(productId, variantId, 1, null, List.of()))
        )).id());

        paymentService.create(new PaymentRequest(tab.id(), PaymentMethod.CASH, new BigDecimal("25.00"), null));
        cashShiftService.addMovement(opened.id(), new CashMovementRequest(
                CashMovementType.SUPPLY, new BigDecimal("10.00"), "Reforço de troco"));
        cashShiftService.addMovement(opened.id(), new CashMovementRequest(
                CashMovementType.WITHDRAWAL, new BigDecimal("5.00"), "Retirada autorizada"));

        CashShiftResponse current = cashShiftService.getCurrent().orElseThrow();
        assertThat(current.receivedTotal()).isEqualByComparingTo("25.00");
        assertThat(current.receivedByMethod().get(PaymentMethod.CASH)).isEqualByComparingTo("25.00");
        assertThat(current.supplyAmount()).isEqualByComparingTo("10.00");
        assertThat(current.withdrawalAmount()).isEqualByComparingTo("5.00");
        assertThat(current.expectedCash()).isEqualByComparingTo("130.00");
        assertThat(current.movements()).extracting(movement -> movement.type())
                .containsExactly("PAYMENT", "SUPPLY", "WITHDRAWAL");
        assertThat(jdbc.queryForObject(
                "select cash_shift_id from payments where tab_id = ?",
                Long.class,
                tab.id()
        )).isEqualTo(opened.id());
    }

    @Test
    void preventsMoreThanOneOpenShift() {
        cashShiftService.open(new OpenCashShiftRequest(BigDecimal.ZERO));

        assertThatThrownBy(() -> cashShiftService.open(new OpenCashShiftRequest(BigDecimal.ONE)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Já existe um turno de caixa aberto");
    }

    @Test
    void requiresAnExplanationWhenClosingWithDifference() {
        CashShiftResponse opened = cashShiftService.open(new OpenCashShiftRequest(new BigDecimal("50.00")));

        assertThatThrownBy(() -> cashShiftService.close(
                opened.id(), new CloseCashShiftRequest(new BigDecimal("49.00"), null)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("observação");
    }

    @Test
    void closesShiftWithConferenceAndKeepsFinancialHistory() {
        CashShiftResponse opened = cashShiftService.open(new OpenCashShiftRequest(new BigDecimal("50.00")));
        cashShiftService.addMovement(opened.id(), new CashMovementRequest(
                CashMovementType.SUPPLY, new BigDecimal("10.00"), "Troco adicional"));

        CashShiftResponse closed = cashShiftService.close(
                opened.id(), new CloseCashShiftRequest(new BigDecimal("58.00"), "Diferença conferida"));

        assertThat(closed.status()).isEqualTo(CashShiftStatus.CLOSED);
        assertThat(closed.expectedCash()).isEqualByComparingTo("60.00");
        assertThat(closed.countedCash()).isEqualByComparingTo("58.00");
        assertThat(closed.differenceAmount()).isEqualByComparingTo("-2.00");
        assertThat(closed.closingNote()).isEqualTo("Diferença conferida");
        assertThat(cashShiftService.getCurrent()).isEmpty();
        assertThat(cashShiftService.history()).extracting(CashShiftResponse::id).contains(opened.id());
        assertThatThrownBy(() -> cashShiftService.addMovement(opened.id(), new CashMovementRequest(
                CashMovementType.WITHDRAWAL, BigDecimal.ONE, "Após fechamento")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("já está fechado");
    }
}
