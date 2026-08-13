package com.hubon.backend;

import com.hubon.backend.auth.service.AuthenticatedUser;
import com.hubon.backend.expense.domain.*;
import com.hubon.backend.expense.dto.*;
import com.hubon.backend.expense.repository.ExpenseRepository;
import com.hubon.backend.expense.service.ExpenseService;
import com.hubon.backend.role.domain.Role;
import com.hubon.backend.role.repository.RoleRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.stock.domain.StockMovementType;
import com.hubon.backend.stock.domain.UnitOfMeasure;
import com.hubon.backend.stock.dto.StockItemRequest;
import com.hubon.backend.stock.dto.StockItemResponse;
import com.hubon.backend.stock.repository.StockMovementRepository;
import com.hubon.backend.stock.service.StockItemService;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.repository.UserRepository;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {"spring.jpa.show-sql=false", "hubon.seed.enabled=false"})
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTestDatabaseGuard.class)
class ExpenseIntegrationTests {
    @Autowired ExpenseService expenseService;
    @Autowired ExpenseRepository expenseRepository;
    @Autowired StockItemService stockItemService;
    @Autowired StockMovementRepository stockMovementRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired UserRepository userRepository;
    @Autowired JdbcTemplate jdbc;

    private User user;

    @BeforeEach
    void setup() {
        clearDatabase();
        Role owner = roleRepository.findByName("OWNER").orElseThrow();
        user = userRepository.save(User.builder()
                .name("Gestor de despesas")
                .username("expense-manager")
                .password("unused")
                .active(true)
                .roles(Set.of(owner))
                .build());
        AuthenticatedUser principal = new AuthenticatedUser(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        clearDatabase();
    }

    @Test
    void createsDirectAndDetailedExpensesWithBackendCalculatedTotals() {
        ExpenseResponse direct = expenseService.create(directRequest(
                LocalDate.of(2026, 8, 10), "Energia elétrica", ExpenseCategory.UTILITIES,
                ExpensePaymentMethod.PIX, ExpenseStatus.PAID, "250.00"));

        assertThat(direct.totalAmount()).isEqualByComparingTo("250.00");
        assertThat(direct.quantity()).isNull();
        assertThat(direct.unitPrice()).isNull();
        assertThat(direct.stockMovementId()).isNull();

        ExpenseResponse detailed = expenseService.create(new ExpenseRequest(
                LocalDate.of(2026, 8, 11), "Compra de carne", ExpenseCategory.FOOD, "Fornecedor exemplo",
                ExpenseValueMode.DETAILED, value("2.500"), UnitOfMeasure.KG, value("12.34"), value("999.99"),
                ExpensePaymentMethod.BOLETO, ExpenseStatus.PENDING, false, null, null));

        assertThat(detailed.totalAmount()).isEqualByComparingTo("30.85");
        assertThat(detailed.quantity()).isEqualByComparingTo("2.500");
        assertThat(detailed.status()).isEqualTo(ExpenseStatus.PENDING);

        assertThatThrownBy(() -> expenseService.create(directRequest(
                LocalDate.now(), "Valor zero", ExpenseCategory.OTHER,
                ExpensePaymentMethod.CASH, ExpenseStatus.PAID, "0")))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> expenseService.create(new ExpenseRequest(
                LocalDate.now(), "Quantidade inválida", ExpenseCategory.FOOD, null,
                ExpenseValueMode.DETAILED, BigDecimal.ZERO, UnitOfMeasure.KG, BigDecimal.ONE, null,
                ExpensePaymentMethod.CASH, ExpenseStatus.PAID, false, null, null)))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> expenseService.create(new ExpenseRequest(
                LocalDate.now(), "Direto inconsistente", ExpenseCategory.OTHER, null,
                ExpenseValueMode.DIRECT, BigDecimal.ONE, UnitOfMeasure.UN, null, value("10"),
                ExpensePaymentMethod.CASH, ExpenseStatus.PAID, false, null, null)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void createsAuditableStockEntryAndProtectsItsFinancialHistory() {
        StockItemResponse stock = stock("Coca-Cola 350ml", "10.000", true);
        ExpenseRequest purchase = new ExpenseRequest(
                LocalDate.of(2026, 8, 12), "Compra de Coca-Cola", ExpenseCategory.BEVERAGE, "Distribuidora local",
                ExpenseValueMode.DETAILED, value("2.000"), UnitOfMeasure.CX, value("60.00"), null,
                ExpensePaymentMethod.BANK_TRANSFER, ExpenseStatus.PENDING, true, stock.id(), value("24.000"));

        ExpenseResponse expense = expenseService.create(purchase);

        assertThat(expense.totalAmount()).isEqualByComparingTo("120.00");
        assertThat(expense.stockItemId()).isEqualTo(stock.id());
        assertThat(expense.stockQuantity()).isEqualByComparingTo("24.000");
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("34.000");
        assertThat(stockMovementRepository.findById(expense.stockMovementId()).orElseThrow().getType())
                .isEqualTo(StockMovementType.ENTRY);
        assertThat(jdbc.queryForObject(
                "select reason from stock_movements where id = ?", String.class, expense.stockMovementId()))
                .isEqualTo("Compra / Despesa #" + expense.id());

        ExpenseRequest paid = new ExpenseRequest(
                purchase.expenseDate(), "Compra de refrigerantes", purchase.category(), purchase.supplier(),
                purchase.valueMode(), purchase.quantity(), purchase.unit(), purchase.unitPrice(), null,
                purchase.paymentMethod(), ExpenseStatus.PAID, true, stock.id(), purchase.stockQuantity());
        ExpenseResponse updated = expenseService.update(expense.id(), paid);
        assertThat(updated.description()).isEqualTo("Compra de refrigerantes");
        assertThat(updated.status()).isEqualTo(ExpenseStatus.PAID);
        assertThat(updated.stockMovementId()).isEqualTo(expense.stockMovementId());

        ExpenseRequest changedStockQuantity = new ExpenseRequest(
                purchase.expenseDate(), purchase.description(), purchase.category(), purchase.supplier(),
                purchase.valueMode(), purchase.quantity(), purchase.unit(), purchase.unitPrice(), null,
                purchase.paymentMethod(), purchase.status(), true, stock.id(), value("25.000"));
        assertThatThrownBy(() -> expenseService.update(expense.id(), changedStockQuantity))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("já gerou entrada");
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("34.000");
        assertThat(stockMovementRepository.count()).isEqualTo(2);
    }

    @Test
    void rollsBackExpenseAndMovementWhenStockEntryIsInvalid() {
        StockItemResponse inactive = stock("Item inativo", "5.000", false);
        long expensesBefore = expenseRepository.count();
        long movementsBefore = stockMovementRepository.count();

        ExpenseRequest request = new ExpenseRequest(
                LocalDate.now(), "Compra inválida", ExpenseCategory.STOCK_PURCHASE, null,
                ExpenseValueMode.DIRECT, null, null, null, value("50.00"),
                ExpensePaymentMethod.CASH, ExpenseStatus.PAID, true, inactive.id(), value("3.000"));

        assertThatThrownBy(() -> expenseService.create(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("inativo");
        assertThat(expenseRepository.count()).isEqualTo(expensesBefore);
        assertThat(stockMovementRepository.count()).isEqualTo(movementsBefore);
        assertThat(stockItemService.getById(inactive.id()).currentStock()).isEqualByComparingTo("5.000");
    }

    @Test
    void filtersOnBackendAndCalculatesSummaryForTheFilteredPeriod() {
        expenseService.create(directRequest(
                LocalDate.of(2026, 8, 1), "Conta de energia", ExpenseCategory.UTILITIES,
                ExpensePaymentMethod.PIX, ExpenseStatus.PAID, "100.00"));
        expenseService.create(directRequest(
                LocalDate.of(2026, 8, 2), "Internet", ExpenseCategory.UTILITIES,
                ExpensePaymentMethod.BOLETO, ExpenseStatus.PENDING, "80.00"));
        expenseService.create(new ExpenseRequest(
                LocalDate.of(2026, 8, 3), "Compra de embalagens", ExpenseCategory.PACKAGING, "Fornecedor Alfa",
                ExpenseValueMode.DIRECT, null, null, null, value("60.00"),
                ExpensePaymentMethod.PIX, ExpenseStatus.PAID, false, null, null));

        ExpenseListResponse utilities = expenseService.list(
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31),
                ExpenseCategory.UTILITIES, null, null, null);
        assertThat(utilities.items()).extracting(ExpenseResponse::description)
                .containsExactly("Internet", "Conta de energia");
        assertThat(utilities.summary().totalAmount()).isEqualByComparingTo("180.00");
        assertThat(utilities.summary().paidAmount()).isEqualByComparingTo("100.00");
        assertThat(utilities.summary().pendingAmount()).isEqualByComparingTo("80.00");

        ExpenseListResponse searched = expenseService.list(
                null, null, null, ExpenseStatus.PAID, ExpensePaymentMethod.PIX, "alfa");
        assertThat(searched.items()).extracting(ExpenseResponse::description)
                .containsExactly("Compra de embalagens");
        assertThat(searched.summary().expenseCount()).isEqualTo(1);

        assertThatThrownBy(() -> expenseService.list(
                LocalDate.of(2026, 8, 2), LocalDate.of(2026, 8, 1), null, null, null, null))
                .isInstanceOf(BusinessException.class);
    }

    private ExpenseRequest directRequest(
            LocalDate date,
            String description,
            ExpenseCategory category,
            ExpensePaymentMethod paymentMethod,
            ExpenseStatus status,
            String amount
    ) {
        return new ExpenseRequest(date, description, category, null, ExpenseValueMode.DIRECT,
                null, null, null, value(amount), paymentMethod, status, false, null, null);
    }

    private StockItemResponse stock(String name, String currentStock, boolean active) {
        return stockItemService.create(new StockItemRequest(
                name, null, UnitOfMeasure.UN, value(currentStock), BigDecimal.ZERO, active));
    }

    private BigDecimal value(String value) {
        return new BigDecimal(value);
    }

    private void clearDatabase() {
        jdbc.execute("""
                truncate table expenses, stock_movements, payments, cash_movements, sale_item_options,
                sale_items, sales, product_option_stock_links, product_stock_links, stock_items, product_options,
                product_option_groups, products, categories, cash_shifts,
                user_roles, users restart identity cascade
                """);
    }
}
