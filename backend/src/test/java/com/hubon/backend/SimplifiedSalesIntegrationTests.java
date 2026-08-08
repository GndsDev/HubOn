package com.hubon.backend;

import com.hubon.backend.auth.service.AuthenticatedUser;
import com.hubon.backend.cash.domain.CashMovementType;
import com.hubon.backend.cash.dto.CashMovementRequest;
import com.hubon.backend.cash.dto.CloseCashShiftRequest;
import com.hubon.backend.cash.dto.OpenCashShiftRequest;
import com.hubon.backend.cash.service.CashShiftService;
import com.hubon.backend.category.dto.CategoryRequest;
import com.hubon.backend.category.dto.CategoryResponse;
import com.hubon.backend.category.service.CategoryService;
import com.hubon.backend.dashboard.service.DashboardService;
import com.hubon.backend.payment.domain.PaymentMethod;
import com.hubon.backend.payment.dto.PaymentRequest;
import com.hubon.backend.payment.service.PaymentService;
import com.hubon.backend.product.dto.*;
import com.hubon.backend.product.service.ProductOptionService;
import com.hubon.backend.product.service.ProductService;
import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.service.MonthlyReportService;
import com.hubon.backend.role.domain.Role;
import com.hubon.backend.role.repository.RoleRepository;
import com.hubon.backend.sale.domain.SaleStatus;
import com.hubon.backend.sale.domain.SaleItem;
import com.hubon.backend.sale.domain.SaleType;
import com.hubon.backend.sale.dto.*;
import com.hubon.backend.sale.repository.SaleItemRepository;
import com.hubon.backend.sale.repository.SaleRepository;
import com.hubon.backend.sale.service.SaleQueryService;
import com.hubon.backend.sale.service.SaleService;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.stock.domain.UnitOfMeasure;
import com.hubon.backend.stock.dto.ProductStockLinkRequest;
import com.hubon.backend.stock.dto.StockItemRequest;
import com.hubon.backend.stock.service.ProductStockLinkService;
import com.hubon.backend.stock.service.StockItemService;
import com.hubon.backend.table.dto.RestaurantTableRequest;
import com.hubon.backend.table.dto.RestaurantTableState;
import com.hubon.backend.table.service.RestaurantTableService;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {"spring.jpa.show-sql=false", "hubon.seed.enabled=false"})
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTestDatabaseGuard.class)
class SimplifiedSalesIntegrationTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired RoleRepository roleRepository;
    @Autowired UserRepository userRepository;
    @Autowired CategoryService categoryService;
    @Autowired ProductService productService;
    @Autowired ProductOptionService optionService;
    @Autowired RestaurantTableService tableService;
    @Autowired SaleService saleService;
    @Autowired SaleQueryService saleQueryService;
    @Autowired PaymentService paymentService;
    @Autowired StockItemService stockItemService;
    @Autowired ProductStockLinkService stockLinkService;
    @Autowired CashShiftService cashShiftService;
    @Autowired DashboardService dashboardService;
    @Autowired SaleRepository saleRepository;
    @Autowired SaleItemRepository saleItemRepository;
    @Autowired MonthlyReportService reportService;
    @Autowired Clock businessClock;

    @BeforeEach
    void setup() {
        clearDatabase();
        Role owner = roleRepository.findByName("OWNER").orElseThrow();
        User user = userRepository.save(User.builder().name("Operador de teste")
                .email("operator@sales.hubon.test").password("unused").active(true).roles(Set.of(owner)).build());
        AuthenticatedUser principal = new AuthenticatedUser(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private void clearDatabase() {
        jdbc.execute("""
                truncate table stock_movements, payments, cash_movements, sale_item_options,
                sale_items, sales, product_stock_links, stock_items, product_options,
                product_option_groups, products, categories, restaurant_tables, cash_shifts,
                user_roles, users restart identity cascade
                """);
    }

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
        clearDatabase();
    }

    @Test
    void productWithoutCategoryAndOptionsCreateImmutableSnapshots() {
        ProductResponse product = product(null, "Jantinha", "20.00");
        ProductOptionGroupResponse group = optionService.createGroup(product.id(), new ProductOptionGroupRequest(
                "Escolha o espeto", 1, 1, 0, true,
                List.of(new ProductOptionRequest("Coracao", money("2.00"), 0, true))));
        SaleResponse sale = counter();

        assertThatThrownBy(() -> saleService.addItem(sale.id(), new AddSaleItemRequest(product.id(), 1, null, List.of())))
                .isInstanceOf(BusinessException.class).hasMessageContaining("pelo menos");

        Long optionId = group.options().getFirst().id();
        SaleResponse withItem = saleService.addItem(sale.id(),
                new AddSaleItemRequest(product.id(), 2, "Sem cebola", List.of(optionId)));
        SaleItemResponse snapshot = withItem.items().getFirst();
        assertThat(snapshot.categoryName()).isNull();
        assertThat(snapshot.baseUnitPrice()).isEqualByComparingTo("20.00");
        assertThat(snapshot.unitPrice()).isEqualByComparingTo("22.00");
        assertThat(snapshot.subtotal()).isEqualByComparingTo("44.00");
        assertThat(snapshot.options().getFirst().additionalPrice()).isEqualByComparingTo("2.00");

        productService.update(product.id(), new ProductRequest(null, "Jantinha nova", null,
                money("30.00"), true, true, 0));
        optionService.updateOption(product.id(), group.id(), optionId,
                new ProductOptionRequest("Coracao premium", money("4.00"), 0, true));
        SaleItemResponse historical = saleQueryService.get(sale.id()).items().getFirst();
        assertThat(historical.productName()).isEqualTo("Jantinha");
        assertThat(historical.unitPrice()).isEqualByComparingTo("22.00");
        assertThat(historical.options().getFirst().optionName()).isEqualTo("Coracao");
    }

    @Test
    void tableOccupancyIsDerivedAndOnlyOneOpenSaleIsAllowed() {
        var table = tableService.create(new RestaurantTableRequest(12, "Varanda", true));
        SaleResponse sale = saleService.open(new OpenSaleRequest(SaleType.TABLE, table.id(), null, null,
                BigDecimal.ZERO, BigDecimal.ZERO));
        assertThat(tableService.getById(table.id()).state()).isEqualTo(RestaurantTableState.OCCUPIED);
        assertThatThrownBy(() -> saleService.open(new OpenSaleRequest(SaleType.TABLE, table.id(), null, null,
                BigDecimal.ZERO, BigDecimal.ZERO))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> tableService.update(table.id(), new RestaurantTableRequest(13, "Varanda", true)))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> tableService.update(table.id(), new RestaurantTableRequest(12, "Varanda", false)))
                .isInstanceOf(BusinessException.class);
        saleService.cancel(sale.id(), new CancellationRequest("Cliente desistiu"));
        assertThat(tableService.getById(table.id()).state()).isEqualTo(RestaurantTableState.FREE);
    }

    @Test
    void stockDebitRollbackAndCancelNewQuantityStrategyAreAuditable() {
        ProductResponse product = product(null, "Refrigerante", "8.00");
        var stock = stockItemService.create(new StockItemRequest("Lata", null, UnitOfMeasure.UN,
                money("10.000"), money("2.000"), true));
        stockLinkService.create(product.id(), new ProductStockLinkRequest(stock.id(), money("2.000")));
        SaleResponse sale = counter();
        SaleItemResponse first = saleService.addItem(sale.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of())).items().getFirst();
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("8.000");

        saleService.cancelItem(sale.id(), first.id(), new CancellationRequest("Corrigir quantidade"));
        saleService.cancelItem(sale.id(), first.id(), new CancellationRequest("Repeticao idempotente"));
        SaleResponse corrected = saleService.addItem(sale.id(),
                new AddSaleItemRequest(product.id(), 2, null, List.of()));
        assertThat(corrected.items()).hasSize(2);
        assertThat(corrected.items().stream().filter(item -> item.cancelledAt() == null)).singleElement()
                .satisfies(item -> assertThat(item.quantity()).isEqualTo(2));
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("6.000");
        assertThat(count("stock_movements", "type = 'SALE_REVERSAL'")).isEqualTo(1);

        assertThatThrownBy(() -> saleService.addItem(sale.id(),
                new AddSaleItemRequest(product.id(), 4, null, List.of())))
                .isInstanceOf(BusinessException.class).hasMessageContaining("Estoque insuficiente");
        assertThat(saleItemRepository.countBySaleIdAndCancelledAtIsNull(sale.id())).isEqualTo(1);
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("6.000");
    }

    @Test
    void partialPaymentsLockItemsAndCounterClosesOnlyOnPositiveFullPayment() {
        ProductResponse product = product(null, "Combo", "10.00");
        SaleResponse sale = counter();
        SaleItemResponse item = saleService.addItem(sale.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of())).items().getFirst();
        openCash("0.00");
        paymentService.create(sale.id(), new PaymentRequest(PaymentMethod.PIX, money("4.00"), null));
        assertThat(saleQueryService.get(sale.id()).status()).isEqualTo(SaleStatus.OPEN);
        assertThatThrownBy(() -> saleService.addItem(sale.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of()))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> saleService.cancelItem(sale.id(), item.id(), new CancellationRequest("Erro")))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> saleService.cancel(sale.id(), new CancellationRequest("Erro")))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> paymentService.create(sale.id(),
                new PaymentRequest(PaymentMethod.CASH, money("7.00"), null))).isInstanceOf(BusinessException.class);
        paymentService.create(sale.id(), new PaymentRequest(PaymentMethod.CASH, money("6.00"), null));
        SaleResponse closed = saleQueryService.get(sale.id());
        assertThat(closed.status()).isEqualTo(SaleStatus.CLOSED);
        assertThat(closed.paidAmount()).isEqualByComparingTo("10.00");
        assertThat(closed.remainingAmount()).isZero();
        assertThatThrownBy(() -> paymentService.create(sale.id(),
                new PaymentRequest(PaymentMethod.PIX, money("1.00"), null))).isInstanceOf(BusinessException.class);
    }

    @Test
    void tableAndZeroValueSalesRequireExplicitCloseAndEmptySalesNeverClose() {
        ProductResponse regular = product(null, "Cafe", "5.00");
        ProductResponse free = product(null, "Cortesia", "0.00");
        var table = tableService.create(new RestaurantTableRequest(1, null, true));
        SaleResponse tableSale = saleService.open(new OpenSaleRequest(SaleType.TABLE, table.id(), null, null,
                BigDecimal.ZERO, BigDecimal.ZERO));
        saleService.addItem(tableSale.id(), new AddSaleItemRequest(regular.id(), 1, null, List.of()));
        openCash("0.00");
        paymentService.create(tableSale.id(), new PaymentRequest(PaymentMethod.PIX, money("5.00"), null));
        assertThat(saleQueryService.get(tableSale.id()).status()).isEqualTo(SaleStatus.OPEN);
        assertThat(saleService.close(tableSale.id()).status()).isEqualTo(SaleStatus.CLOSED);

        SaleResponse zeroCounter = counter();
        saleService.addItem(zeroCounter.id(), new AddSaleItemRequest(free.id(), 1, null, List.of()));
        assertThat(saleQueryService.get(zeroCounter.id()).status()).isEqualTo(SaleStatus.OPEN);
        assertThat(saleService.close(zeroCounter.id()).status()).isEqualTo(SaleStatus.CLOSED);

        SaleResponse empty = counter();
        assertThatThrownBy(() -> saleService.close(empty.id())).isInstanceOf(BusinessException.class)
                .hasMessageContaining("vazia");
    }

    @Test
    void closedAndCancelledSalesAreImmutable() {
        ProductResponse product = product(null, "Agua", "3.00");
        SaleResponse cancelled = counter();
        saleService.addItem(cancelled.id(), new AddSaleItemRequest(product.id(), 1, null, List.of()));
        saleService.cancel(cancelled.id(), new CancellationRequest("Cancelamento operacional"));
        assertThatThrownBy(() -> saleService.addItem(cancelled.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of()))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> saleService.close(cancelled.id())).isInstanceOf(BusinessException.class);

        SaleResponse closed = counter();
        saleService.addItem(closed.id(), new AddSaleItemRequest(product.id(), 1, null, List.of()));
        openCash("0.00");
        paymentService.create(closed.id(), new PaymentRequest(PaymentMethod.PIX, money("3.00"), null));
        assertThatThrownBy(() -> saleService.cancel(closed.id(), new CancellationRequest("Tentar cancelar")))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void reportsIgnoreCancelledItemsAndCashReconcilesPaymentsAndManualMovements() {
        ProductResponse cancelledProduct = product(null, "Cancelado", "10.00");
        ProductResponse soldProduct = product(null, "Vendido", "5.00");
        var shift = openCash("5.00");
        SaleResponse sale = counter();
        SaleItemResponse cancelled = saleService.addItem(sale.id(),
                new AddSaleItemRequest(cancelledProduct.id(), 1, null, List.of())).items().getFirst();
        SaleItemResponse sold = saleService.addItem(sale.id(),
                new AddSaleItemRequest(soldProduct.id(), 2, null, List.of())).items().stream()
                .filter(item -> item.productId().equals(soldProduct.id())).findFirst().orElseThrow();
        saleService.cancelItem(sale.id(), sold.id(), new CancellationRequest(SaleItem.QUANTITY_ADJUSTMENT_REASON));
        saleService.addItem(sale.id(), new AddSaleItemRequest(soldProduct.id(), 2, null, List.of()));
        saleService.cancelItem(sale.id(), cancelled.id(), new CancellationRequest("Cliente mudou de ideia"));
        cashShiftService.addMovement(shift.id(), new CashMovementRequest(CashMovementType.SUPPLY, money("2.00"), "Troco"));
        cashShiftService.addMovement(shift.id(), new CashMovementRequest(CashMovementType.WITHDRAWAL, money("1.00"), "Sangria"));
        paymentService.create(sale.id(), new PaymentRequest(PaymentMethod.CASH, money("10.00"), null));

        var report = reportService.generateDaily(LocalDate.now(businessClock), ReportChannel.ALL);
        assertThat(report.summary().grossRevenue()).isEqualByComparingTo("10.00");
        assertThat(report.summary().itemsSold()).isEqualTo(2);
        assertThat(report.products()).singleElement().satisfies(value -> assertThat(value.productName()).isEqualTo("Vendido"));
        assertThat(report.cancellations().cancelledItems()).isEqualTo(1);
        assertThat(report.cancellations().cancelledAmount()).isEqualByComparingTo("10.00");
        assertThat(dashboardService.getSummary().cashSummary().cancelledAmount()).isEqualByComparingTo("10.00");

        var current = cashShiftService.getCurrent().orElseThrow();
        assertThat(current.receivedTotal()).isEqualByComparingTo("10.00");
        assertThat(current.expectedCash()).isEqualByComparingTo("16.00");
        assertThat(current.cancellationAmount()).isEqualByComparingTo("10.00");
        assertThat(current.movements().stream().filter(movement -> movement.type().equals("CANCELLATION")))
                .singleElement().satisfies(movement -> {
                    assertThat(movement.amount()).isEqualByComparingTo("10.00");
                    assertThat(movement.observation()).isEqualTo("Cliente mudou de ideia");
                });
        var closedShift = cashShiftService.close(shift.id(), new CloseCashShiftRequest(money("16.00"), null));
        assertThat(closedShift.differenceAmount()).isZero();
    }

    private ProductResponse product(Long categoryId, String name, String price) {
        return productService.create(new ProductRequest(categoryId, name, null, money(price), true, true, 0));
    }

    private SaleResponse counter() {
        return saleService.open(new OpenSaleRequest(SaleType.COUNTER, null, null, null,
                BigDecimal.ZERO, BigDecimal.ZERO));
    }

    private com.hubon.backend.cash.dto.CashShiftResponse openCash(String opening) {
        return cashShiftService.open(new OpenCashShiftRequest(money(opening)));
    }

    private int count(String table, String where) {
        return jdbc.queryForObject("select count(*) from " + table + " where " + where, Integer.class);
    }

    private BigDecimal money(String value) { return new BigDecimal(value); }
}
