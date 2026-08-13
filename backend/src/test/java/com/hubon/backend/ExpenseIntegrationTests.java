package com.hubon.backend;

import com.hubon.backend.auth.service.AuthenticatedUser;
import com.hubon.backend.expense.domain.*;
import com.hubon.backend.expense.dto.*;
import com.hubon.backend.expense.repository.ExpenseRepository;
import com.hubon.backend.expense.service.ExpenseService;
import com.hubon.backend.product.dto.*;
import com.hubon.backend.product.service.ProductOptionService;
import com.hubon.backend.product.service.ProductService;
import com.hubon.backend.role.domain.Role;
import com.hubon.backend.role.repository.RoleRepository;
import com.hubon.backend.sale.domain.SaleStatus;
import com.hubon.backend.sale.domain.SaleType;
import com.hubon.backend.sale.dto.*;
import com.hubon.backend.sale.service.SaleService;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.stock.domain.StockMovementType;
import com.hubon.backend.stock.domain.UnitOfMeasure;
import com.hubon.backend.stock.dto.*;
import com.hubon.backend.stock.repository.StockMovementRepository;
import com.hubon.backend.stock.service.ProductOptionStockLinkService;
import com.hubon.backend.stock.service.ProductStockLinkService;
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
import java.util.List;
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
    @Autowired ProductService productService;
    @Autowired ProductOptionService optionService;
    @Autowired ProductStockLinkService stockLinkService;
    @Autowired ProductOptionStockLinkService optionStockLinkService;
    @Autowired SaleService saleService;
    @Autowired RoleRepository roleRepository;
    @Autowired UserRepository userRepository;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void setup() {
        clearDatabase();
        Role owner = roleRepository.findByName("OWNER").orElseThrow();
        User user = userRepository.save(User.builder()
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
    void keepsSimpleAndPendingExpensesOutsideStockAndAllowsAmountEdits() {
        ExpenseResponse energy = expenseService.create(directRequest(
                LocalDate.of(2026, 8, 10), "Conta de energia", ExpenseCategory.UTILITIES,
                ExpensePaymentMethod.PIX, ExpenseStatus.PAID, "800.00"));

        ExpenseResponse updatedEnergy = expenseService.update(energy.id(), directRequest(
                energy.expenseDate(), energy.description(), energy.category(),
                energy.paymentMethod(), energy.status(), "850.00"));
        ExpenseResponse maintenance = expenseService.create(directRequest(
                LocalDate.of(2026, 8, 11), "Manutencao churrasqueira", ExpenseCategory.MAINTENANCE,
                ExpensePaymentMethod.PIX, ExpenseStatus.PENDING, "300.00"));
        ExpenseResponse internet = expenseService.create(directRequest(
                LocalDate.of(2026, 8, 12), "Internet", ExpenseCategory.UTILITIES,
                ExpensePaymentMethod.CASH, ExpenseStatus.PENDING, "180.00"));

        assertThat(updatedEnergy.totalAmount()).isEqualByComparingTo("850.00");
        assertThat(updatedEnergy.stockMovementId()).isNull();
        assertThat(maintenance.status()).isEqualTo(ExpenseStatus.PENDING);
        assertThat(internet.stockMovementId()).isNull();
        assertThat(expenseRepository.count()).isEqualTo(3);
        assertThat(stockMovementRepository.count()).isZero();

        ExpenseListResponse pending = expenseService.list(null, null, null, ExpenseStatus.PENDING, null, null);
        assertThat(pending.summary().pendingAmount()).isEqualByComparingTo("480.00");
    }

    @Test
    void beveragePurchaseKeepsPurchaseUnitsSeparateFromStockAndFeedsLaterSales() {
        StockItemResponse beerStock = stock("Cerveja Lata", UnitOfMeasure.UN, "10.000", true);
        ExpenseResponse purchase = expenseService.create(purchaseRequest(
                "Compra de Cerveja Lata", ExpenseCategory.BEVERAGE, "Distribuidora Central",
                "2.000", UnitOfMeasure.CX, "42.00", ExpensePaymentMethod.PIX,
                beerStock.id(), "24.000"));

        assertThat(purchase.totalAmount()).isEqualByComparingTo("84.00");
        assertThat(purchase.quantity()).isEqualByComparingTo("2.000");
        assertThat(purchase.unit()).isEqualTo(UnitOfMeasure.CX);
        assertThat(purchase.stockQuantity()).isEqualByComparingTo("24.000");
        assertThat(movementDelta(purchase.stockMovementId())).isEqualByComparingTo("24.000");
        assertThat(stockItemService.getById(beerStock.id()).currentStock()).isEqualByComparingTo("34.000");

        ProductResponse beer = product("Cerveja Lata", "7.00");
        stockLinkService.create(beer.id(), new ProductStockLinkRequest(beerStock.id(), value("1.000")));
        SaleResponse sale = counter();
        SaleResponse sold = saleService.addItem(sale.id(), new AddSaleItemRequest(beer.id(), 2, null, List.of()));

        assertThat(sold.finalAmount()).isEqualByComparingTo("14.00");
        assertThat(stockItemService.getById(beerStock.id()).currentStock()).isEqualByComparingTo("32.000");
        assertThat(saleDeltas(beerStock.id())).containsExactly(value("-2.000"));
    }

    @Test
    void picanhaPurchaseSuppliesDirectProductAndJantinhaChoiceAtIndependentSalePrices() {
        StockItemResponse picanhaStock = stock("Picanha", UnitOfMeasure.UN, "5.000", true);
        ExpenseResponse purchase = expenseService.create(purchaseRequest(
                "Compra de Picanha", ExpenseCategory.FOOD, "Frigorifico Serra",
                "20.000", UnitOfMeasure.UN, "7.50", ExpensePaymentMethod.PIX,
                picanhaStock.id(), "20.000"));
        ProductResponse picanha = product("Picanha", "12.90");
        ProductResponse jantinha = product("Jantinha Completa", "34.90");
        stockLinkService.create(picanha.id(), new ProductStockLinkRequest(picanhaStock.id(), value("1.000")));
        ProductOptionGroupResponse skewers = requiredPicanhaChoice(jantinha);
        Long picanhaOptionId = skewers.options().getFirst().id();
        optionStockLinkService.create(jantinha.id(), skewers.id(), picanhaOptionId,
                new ProductOptionStockLinkRequest(picanhaStock.id(), value("1.000")));

        SaleResponse sale = counter();
        SaleResponse directSale = saleService.addItem(sale.id(),
                new AddSaleItemRequest(picanha.id(), 3, null, List.of()));
        SaleResponse combinedSale = saleService.addItem(sale.id(),
                new AddSaleItemRequest(jantinha.id(), 1, null, List.of(picanhaOptionId)));

        assertThat(purchase.unitPrice()).isEqualByComparingTo("7.50");
        assertThat(directSale.items().getFirst().subtotal()).isEqualByComparingTo("38.70");
        assertThat(combinedSale.items()).filteredOn(item -> item.productId().equals(jantinha.id()))
                .singleElement().satisfies(item -> assertThat(item.subtotal()).isEqualByComparingTo("34.90"));
        assertThat(stockItemService.getById(picanhaStock.id()).currentStock()).isEqualByComparingTo("21.000");
        assertThat(movementDelta(purchase.stockMovementId())).isEqualByComparingTo("20.000");
        assertThat(saleDeltas(picanhaStock.id())).containsExactly(value("-3.000"), value("-1.000"));
    }

    @Test
    void calculatesDetailedTotalsWithDecimalPrecision() {
        ExpenseResponse boxes = expenseService.create(new ExpenseRequest(
                LocalDate.of(2026, 8, 10), "Compra em caixas", ExpenseCategory.BEVERAGE, "Fornecedor A",
                ExpenseValueMode.DETAILED, value("5.000"), UnitOfMeasure.CX, value("36.90"), value("999.99"),
                ExpensePaymentMethod.CREDIT_CARD, ExpenseStatus.PAID, false, null, null));
        ExpenseResponse fractional = expenseService.create(new ExpenseRequest(
                LocalDate.of(2026, 8, 11), "Compra fracionada", ExpenseCategory.FOOD, "Fornecedor B",
                ExpenseValueMode.DETAILED, value("12.500"), UnitOfMeasure.KG, value("34.90"), null,
                ExpensePaymentMethod.CASH, ExpenseStatus.PAID, false, null, null));

        assertThat(boxes.totalAmount()).isEqualByComparingTo("184.50");
        assertThat(fractional.totalAmount()).isEqualByComparingTo("436.25");
    }

    @Test
    void preservesAuditableStockHistoryAndBlocksPhysicalOrFinancialRewrites() {
        StockItemResponse stock = stock("Cerveja Lata", UnitOfMeasure.UN, "10.000", true);
        ExpenseRequest purchase = purchaseRequest(
                "Compra de Cerveja Lata", ExpenseCategory.BEVERAGE, "Distribuidora local",
                "3.000", UnitOfMeasure.CX, "36.90", ExpensePaymentMethod.PIX,
                stock.id(), "36.000");
        ExpenseResponse expense = expenseService.create(purchase);

        assertThat(expense.quantity()).isEqualByComparingTo("3.000");
        assertThat(expense.unit()).isEqualTo(UnitOfMeasure.CX);
        assertThat(expense.stockQuantity()).isEqualByComparingTo("36.000");
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("46.000");
        assertThat(stockMovementRepository.findById(expense.stockMovementId()).orElseThrow().getType())
                .isEqualTo(StockMovementType.ENTRY);
        assertThat(movementReason(expense.stockMovementId())).isEqualTo("Compra / Despesa #" + expense.id());

        ExpenseRequest paid = new ExpenseRequest(
                purchase.expenseDate(), "Compra mensal de cerveja", purchase.category(), "Fornecedor atualizado",
                purchase.valueMode(), purchase.quantity(), purchase.unit(), purchase.unitPrice(), null,
                purchase.paymentMethod(), ExpenseStatus.PENDING, true, stock.id(), purchase.stockQuantity());
        ExpenseResponse updated = expenseService.update(expense.id(), paid);
        assertThat(updated.description()).isEqualTo("Compra mensal de cerveja");
        assertThat(updated.status()).isEqualTo(ExpenseStatus.PENDING);
        assertThat(updated.stockMovementId()).isEqualTo(expense.stockMovementId());

        ExpenseRequest changedStockQuantity = new ExpenseRequest(
                purchase.expenseDate(), purchase.description(), purchase.category(), purchase.supplier(),
                purchase.valueMode(), purchase.quantity(), purchase.unit(), value("37.00"), null,
                purchase.paymentMethod(), purchase.status(), true, stock.id(), value("37.000"));
        assertThatThrownBy(() -> expenseService.update(expense.id(), changedStockQuantity))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("entrada");
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("46.000");
        assertThat(stockMovementRepository.count()).isEqualTo(2);
    }

    @Test
    void rollsBackExpenseMovementAndBalanceWhenStockEntryFails() {
        StockItemResponse inactive = stock("Item inativo", UnitOfMeasure.UN, "5.000", false);
        long expensesBefore = expenseRepository.count();
        long movementsBefore = stockMovementRepository.count();

        ExpenseRequest request = new ExpenseRequest(
                LocalDate.now(), "Compra invalida", ExpenseCategory.STOCK_PURCHASE, null,
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
    void filtersRealExpenseCategoriesAndCalculatesExactManagementSummary() {
        StockItemResponse beerStock = stock("Cerveja Lata", UnitOfMeasure.UN, "10.000", true);
        StockItemResponse picanhaStock = stock("Picanha", UnitOfMeasure.UN, "5.000", true);
        expenseService.create(directRequest(
                LocalDate.of(2026, 8, 1), "Conta de energia", ExpenseCategory.UTILITIES,
                ExpensePaymentMethod.PIX, ExpenseStatus.PAID, "850.00"));
        expenseService.create(directRequest(
                LocalDate.of(2026, 8, 2), "Internet", ExpenseCategory.UTILITIES,
                ExpensePaymentMethod.CASH, ExpenseStatus.PENDING, "180.00"));
        expenseService.create(purchaseRequest(
                "Compra de Cerveja Lata", ExpenseCategory.BEVERAGE, "Distribuidora Central",
                "2.000", UnitOfMeasure.CX, "42.00", ExpensePaymentMethod.PIX,
                beerStock.id(), "24.000"));
        expenseService.create(purchaseRequest(
                "Compra de Picanha", ExpenseCategory.FOOD, "Frigorifico Serra",
                "20.000", UnitOfMeasure.UN, "7.50", ExpensePaymentMethod.CREDIT_CARD,
                picanhaStock.id(), "20.000"));

        ExpenseListResponse all = expenseService.list(
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31), null, null, null, null);
        assertThat(all.summary().totalAmount()).isEqualByComparingTo("1264.00");
        assertThat(all.summary().paidAmount()).isEqualByComparingTo("1084.00");
        assertThat(all.summary().pendingAmount()).isEqualByComparingTo("180.00");
        assertThat(all.summary().stockPurchaseAmount()).isEqualByComparingTo("234.00");
        assertThat(all.summary().expenseCount()).isEqualTo(4);

        assertDescriptions(expenseService.list(null, null, ExpenseCategory.BEVERAGE, null, null, null),
                "Compra de Cerveja Lata");
        assertDescriptions(expenseService.list(null, null, ExpenseCategory.UTILITIES, null, null, null),
                "Internet", "Conta de energia");
        assertDescriptions(expenseService.list(null, null, null, ExpenseStatus.PENDING, null, null), "Internet");
        assertDescriptions(expenseService.list(null, null, null, null, ExpensePaymentMethod.CREDIT_CARD, null),
                "Compra de Picanha");
        assertDescriptions(expenseService.list(null, null, null, null, null, "cerveja"),
                "Compra de Cerveja Lata");
        assertDescriptions(expenseService.list(null, null, null, null, null, "picanha"), "Compra de Picanha");
        assertDescriptions(expenseService.list(null, null, null, null, null, "energia"), "Conta de energia");
        assertDescriptions(expenseService.list(null, null, null, null, null, "serra"), "Compra de Picanha");

        assertThatThrownBy(() -> expenseService.list(
                LocalDate.of(2026, 8, 2), LocalDate.of(2026, 8, 1), null, null, null, null))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void fullPurchaseSaleRemovalAndCancellationCycleKeepsExpenseEntriesIntact() {
        StockItemResponse picanhaStock = stock("Picanha", UnitOfMeasure.UN, "5.000", true);
        StockItemResponse beerStock = stock("Cerveja Lata", UnitOfMeasure.UN, "10.000", true);
        ExpenseResponse picanhaPurchase = expenseService.create(purchaseRequest(
                "Compra de Picanha", ExpenseCategory.FOOD, "Frigorifico Serra",
                "20.000", UnitOfMeasure.UN, "7.50", ExpensePaymentMethod.PIX,
                picanhaStock.id(), "20.000"));
        ExpenseResponse beerPurchase = expenseService.create(purchaseRequest(
                "Compra de Cerveja Lata", ExpenseCategory.BEVERAGE, "Distribuidora Central",
                "2.000", UnitOfMeasure.CX, "42.00", ExpensePaymentMethod.PIX,
                beerStock.id(), "24.000"));

        ProductResponse picanha = product("Picanha", "12.90");
        ProductResponse beer = product("Cerveja Lata", "7.00");
        ProductResponse jantinha = product("Jantinha Completa", "34.90");
        stockLinkService.create(picanha.id(), new ProductStockLinkRequest(picanhaStock.id(), value("1.000")));
        stockLinkService.create(beer.id(), new ProductStockLinkRequest(beerStock.id(), value("1.000")));
        ProductOptionGroupResponse skewers = requiredPicanhaChoice(jantinha);
        Long picanhaOptionId = skewers.options().getFirst().id();
        optionStockLinkService.create(jantinha.id(), skewers.id(), picanhaOptionId,
                new ProductOptionStockLinkRequest(picanhaStock.id(), value("1.000")));

        SaleResponse sale = counter();
        saleService.addItem(sale.id(), new AddSaleItemRequest(
                jantinha.id(), 1, null, List.of(picanhaOptionId)));
        SaleResponse withPicanha = saleService.addItem(sale.id(),
                new AddSaleItemRequest(picanha.id(), 2, null, List.of()));
        SaleItemResponse directPicanha = withPicanha.items().stream()
                .filter(item -> item.productId().equals(picanha.id())).findFirst().orElseThrow();
        SaleResponse complete = saleService.addItem(sale.id(),
                new AddSaleItemRequest(beer.id(), 3, null, List.of()));

        assertThat(complete.finalAmount()).isEqualByComparingTo("81.70");
        assertThat(stockItemService.getById(picanhaStock.id()).currentStock()).isEqualByComparingTo("22.000");
        assertThat(stockItemService.getById(beerStock.id()).currentStock()).isEqualByComparingTo("31.000");

        SaleResponse afterRemoval = saleService.removeItem(sale.id(), directPicanha.id());
        assertThat(afterRemoval.finalAmount()).isEqualByComparingTo("55.90");
        assertThat(afterRemoval.items()).extracting(SaleItemResponse::productName)
                .containsExactly("Jantinha Completa", "Cerveja Lata");
        assertThat(stockItemService.getById(picanhaStock.id()).currentStock()).isEqualByComparingTo("24.000");
        assertThat(stockItemService.getById(beerStock.id()).currentStock()).isEqualByComparingTo("31.000");
        assertThat(expenseService.getById(picanhaPurchase.id()).totalAmount()).isEqualByComparingTo("150.00");

        SaleResponse cancelled = saleService.cancel(sale.id(), new CancellationRequest("Cancelamento de teste"));
        assertThat(cancelled.status()).isEqualTo(SaleStatus.CANCELLED);
        assertThat(stockItemService.getById(picanhaStock.id()).currentStock()).isEqualByComparingTo("25.000");
        assertThat(stockItemService.getById(beerStock.id()).currentStock()).isEqualByComparingTo("34.000");
        assertThat(expenseRepository.count()).isEqualTo(2);
        assertThat(movementDelta(picanhaPurchase.stockMovementId())).isEqualByComparingTo("20.000");
        assertThat(movementDelta(beerPurchase.stockMovementId())).isEqualByComparingTo("24.000");
        assertThat(count("stock_movements", "reversed_movement_id = " + picanhaPurchase.stockMovementId())).isZero();
        assertThat(count("stock_movements", "reversed_movement_id = " + beerPurchase.stockMovementId())).isZero();
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

    private ExpenseRequest purchaseRequest(
            String description,
            ExpenseCategory category,
            String supplier,
            String quantity,
            UnitOfMeasure unit,
            String unitPrice,
            ExpensePaymentMethod paymentMethod,
            Long stockItemId,
            String stockQuantity
    ) {
        return new ExpenseRequest(
                LocalDate.of(2026, 8, 12), description, category, supplier,
                ExpenseValueMode.DETAILED, value(quantity), unit, value(unitPrice), null,
                paymentMethod, ExpenseStatus.PAID, true, stockItemId, value(stockQuantity));
    }

    private StockItemResponse stock(String name, UnitOfMeasure unit, String currentStock, boolean active) {
        return stockItemService.create(new StockItemRequest(
                name, null, unit, value(currentStock), BigDecimal.ZERO, active));
    }

    private ProductResponse product(String name, String price) {
        return productService.create(new ProductRequest(null, name, null, value(price), true, true, 0));
    }

    private ProductOptionGroupResponse requiredPicanhaChoice(ProductResponse product) {
        return optionService.createGroup(product.id(), new ProductOptionGroupRequest(
                "Escolha o espeto", 1, 1, 0, true,
                List.of(new ProductOptionRequest("Picanha", BigDecimal.ZERO, 0, true))));
    }

    private SaleResponse counter() {
        return saleService.open(new OpenSaleRequest(
                SaleType.COUNTER, null, null, null, BigDecimal.ZERO, BigDecimal.ZERO));
    }

    private void assertDescriptions(ExpenseListResponse response, String... descriptions) {
        assertThat(response.items()).extracting(ExpenseResponse::description).containsExactly(descriptions);
    }

    private BigDecimal movementDelta(Long movementId) {
        return jdbc.queryForObject(
                "select delta_quantity from stock_movements where id = ?", BigDecimal.class, movementId);
    }

    private String movementReason(Long movementId) {
        return jdbc.queryForObject("select reason from stock_movements where id = ?", String.class, movementId);
    }

    private List<BigDecimal> saleDeltas(Long stockItemId) {
        return jdbc.query(
                "select delta_quantity from stock_movements where stock_item_id = ? and type = 'SALE' order by id",
                (resultSet, row) -> resultSet.getBigDecimal(1), stockItemId);
    }

    private int count(String table, String where) {
        return jdbc.queryForObject("select count(*) from " + table + " where " + where, Integer.class);
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
