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
import com.hubon.backend.sale.domain.SaleType;
import com.hubon.backend.sale.dto.*;
import com.hubon.backend.sale.repository.SaleItemRepository;
import com.hubon.backend.sale.repository.SaleRepository;
import com.hubon.backend.sale.service.SaleQueryService;
import com.hubon.backend.sale.service.SaleService;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.stock.domain.UnitOfMeasure;
import com.hubon.backend.stock.dto.ProductOptionStockLinkRequest;
import com.hubon.backend.stock.dto.ProductStockLinkRequest;
import com.hubon.backend.stock.dto.StockItemRequest;
import com.hubon.backend.stock.service.ProductOptionStockLinkService;
import com.hubon.backend.stock.service.ProductStockLinkService;
import com.hubon.backend.stock.service.StockItemService;
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
    @Autowired SaleService saleService;
    @Autowired SaleQueryService saleQueryService;
    @Autowired PaymentService paymentService;
    @Autowired StockItemService stockItemService;
    @Autowired ProductStockLinkService stockLinkService;
    @Autowired ProductOptionStockLinkService optionStockLinkService;
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
                .username("operator-sales").password("unused").active(true).roles(Set.of(owner)).build());
        AuthenticatedUser principal = new AuthenticatedUser(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private void clearDatabase() {
        jdbc.execute("""
                truncate table stock_movements, payments, cash_movements, sale_item_options,
                sale_items, sales, product_option_stock_links, product_stock_links, stock_items, product_options,
                product_option_groups, products, categories, cash_shifts,
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
        ProductResponse product = product(null, "Arroz Branco", "10.00");
        ProductOptionGroupResponse group = optionService.createGroup(product.id(), new ProductOptionGroupRequest(
                "Tamanho", 1, 1, 0, true,
                List.of(new ProductOptionRequest("Grande", money("8.00"), 0, true))));
        SaleResponse sale = counter();

        assertThatThrownBy(() -> saleService.addItem(sale.id(), new AddSaleItemRequest(product.id(), 1, null, List.of())))
                .isInstanceOf(BusinessException.class).hasMessageContaining("pelo menos");

        Long optionId = group.options().getFirst().id();
        SaleResponse withItem = saleService.addItem(sale.id(),
                new AddSaleItemRequest(product.id(), 2, null, List.of(optionId)));
        SaleItemResponse snapshot = withItem.items().getFirst();
        assertThat(snapshot.categoryName()).isNull();
        assertThat(snapshot.baseUnitPrice()).isEqualByComparingTo("10.00");
        assertThat(snapshot.unitPrice()).isEqualByComparingTo("18.00");
        assertThat(snapshot.subtotal()).isEqualByComparingTo("36.00");
        assertThat(snapshot.options().getFirst().additionalPrice()).isEqualByComparingTo("8.00");

        productService.update(product.id(), new ProductRequest(null, "Arroz Branco atualizado", null,
                money("12.00"), true, true, 0));
        optionService.updateOption(product.id(), group.id(), optionId,
                new ProductOptionRequest("Grande atualizada", money("10.00"), 0, true));
        SaleItemResponse historical = saleQueryService.get(sale.id()).items().getFirst();
        assertThat(historical.productName()).isEqualTo("Arroz Branco");
        assertThat(historical.unitPrice()).isEqualByComparingTo("18.00");
        assertThat(historical.options().getFirst().optionName()).isEqualTo("Grande");
    }

    @Test
    void tableSalesUseTypedNumberAndOnlyOneOpenSaleIsAllowed() {
        SaleResponse sale = saleService.open(new OpenSaleRequest(SaleType.TABLE, 12, null, null,
                BigDecimal.ZERO, BigDecimal.ZERO));
        assertThat(sale.tableNumber()).isEqualTo(12);
        assertThatThrownBy(() -> saleService.open(new OpenSaleRequest(SaleType.TABLE, 12, null, null,
                BigDecimal.ZERO, BigDecimal.ZERO))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> saleService.open(new OpenSaleRequest(SaleType.TABLE, null, null, null,
                BigDecimal.ZERO, BigDecimal.ZERO)))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> saleService.open(new OpenSaleRequest(SaleType.TABLE, 0, null, null,
                BigDecimal.ZERO, BigDecimal.ZERO)))
                .isInstanceOf(BusinessException.class);
        saleService.cancel(sale.id(), new CancellationRequest("Cliente desistiu"));
        SaleResponse reopened = saleService.open(new OpenSaleRequest(SaleType.TABLE, 12, null, null,
                BigDecimal.ZERO, BigDecimal.ZERO));
        assertThat(reopened.tableNumber()).isEqualTo(12);
    }

    @Test
    void tableNumberCanBeReusedAfterCloseAndCounterHasNoTableNumber() {
        ProductResponse product = product(null, "Agua com gas", "5.00");
        SaleResponse tableSale = saleService.open(new OpenSaleRequest(SaleType.TABLE, 5, null, null,
                BigDecimal.ZERO, BigDecimal.ZERO));
        saleService.addItem(tableSale.id(), new AddSaleItemRequest(product.id(), 1, null, List.of()));
        openCash("0.00");
        paymentService.create(tableSale.id(), new PaymentRequest(PaymentMethod.PIX, money("5.00"), null));
        assertThat(saleService.close(tableSale.id()).status()).isEqualTo(SaleStatus.CLOSED);
        assertThat(saleService.open(new OpenSaleRequest(SaleType.TABLE, 5, null, null,
                BigDecimal.ZERO, BigDecimal.ZERO)).tableNumber()).isEqualTo(5);

        SaleResponse counter = counter();
        assertThat(counter.type()).isEqualTo(SaleType.COUNTER);
        assertThat(counter.tableNumber()).isNull();
        assertThatThrownBy(() -> saleService.open(new OpenSaleRequest(SaleType.COUNTER, 5, null, null,
                BigDecimal.ZERO, BigDecimal.ZERO))).isInstanceOf(BusinessException.class);
    }

    @Test
    void quantityUpdatesKeepTheItemAndApplyOnlyTheStockDelta() {
        ProductResponse product = product(null, "Picanha Montada", "12.90");
        var stock = stockItemService.create(new StockItemRequest("Picanha Montada", null, UnitOfMeasure.UN,
                money("10.000"), money("2.000"), true));
        stockLinkService.create(product.id(), new ProductStockLinkRequest(stock.id(), money("1.000")));
        SaleResponse sale = counter();
        SaleItemResponse first = saleService.addItem(sale.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of())).items().getFirst();
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("9.000");

        SaleResponse increased = saleService.updateItemQuantity(sale.id(), first.id(),
                new UpdateSaleItemQuantityRequest(3));
        assertThat(increased.items()).singleElement().satisfies(item -> {
            assertThat(item.id()).isEqualTo(first.id());
            assertThat(item.quantity()).isEqualTo(3);
            assertThat(item.subtotal()).isEqualByComparingTo("38.70");
            assertThat(item.cancelledAt()).isNull();
            assertThat(item.cancellationReason()).isNull();
        });
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("7.000");

        saleService.updateItemQuantity(sale.id(), first.id(), new UpdateSaleItemQuantityRequest(2));
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("8.000");
        saleService.updateItemQuantity(sale.id(), first.id(), new UpdateSaleItemQuantityRequest(10));
        assertThat(stockItemService.getById(stock.id()).currentStock()).isZero();
        saleService.updateItemQuantity(sale.id(), first.id(), new UpdateSaleItemQuantityRequest(2));
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("8.000");

        int movementsBeforeFailure = count("stock_movements", "sale_item_id = " + first.id());
        assertThatThrownBy(() -> saleService.updateItemQuantity(sale.id(), first.id(),
                new UpdateSaleItemQuantityRequest(11)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("Estoque insuficiente");
        assertThat(saleQueryService.get(sale.id()).items().getFirst().quantity()).isEqualTo(2);
        assertThat(saleItemRepository.countBySaleIdAndCancelledAtIsNullAndRemovedAtIsNull(sale.id())).isEqualTo(1);
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("8.000");
        assertThat(count("stock_movements", "sale_item_id = " + first.id())).isEqualTo(movementsBeforeFailure);

        saleService.cancelItem(sale.id(), first.id(), new CancellationRequest("Cliente desistiu"));
        saleService.cancelItem(sale.id(), first.id(), new CancellationRequest("Repeticao idempotente"));
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("10.000");
        assertThat(count("sale_items", "sale_id = " + sale.id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select sum(delta_quantity) from stock_movements where sale_item_id = ?",
                BigDecimal.class, first.id())).isZero();
    }

    @Test
    void removingAnUnpaidItemRestoresStockWithoutCreatingCancellationData() {
        ProductResponse product = product(null, "Picanha Montada", "12.90");
        var stock = stockItemService.create(new StockItemRequest("Picanha Montada", null, UnitOfMeasure.UN,
                money("10.000"), money("2.000"), true));
        stockLinkService.create(product.id(), new ProductStockLinkRequest(stock.id(), money("1.000")));
        SaleResponse sale = counter();
        SaleItemResponse item = saleService.addItem(sale.id(),
                new AddSaleItemRequest(product.id(), 2, null, List.of())).items().getFirst();
        assertThat(item.subtotal()).isEqualByComparingTo("25.80");
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("8.000");

        SaleResponse updated = saleService.removeItem(sale.id(), item.id());

        assertThat(updated.items()).isEmpty();
        assertThat(updated.subtotal()).isZero();
        assertThat(updated.finalAmount()).isZero();
        assertThat(saleItemRepository.countBySaleIdAndCancelledAtIsNullAndRemovedAtIsNull(sale.id())).isZero();
        assertThat(saleItemRepository.findById(item.id())).get().satisfies(persisted -> {
            assertThat(persisted.isRemoved()).isTrue();
            assertThat(persisted.getRemovedAt()).isNotNull();
            assertThat(persisted.getRemovedByUser()).isNotNull();
            assertThat(persisted.getCancelledAt()).isNull();
            assertThat(persisted.getCancelledByUser()).isNull();
            assertThat(persisted.getCancellationReason()).isNull();
        });
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("10.000");
        assertThat(count("stock_movements", "sale_item_id = " + item.id() + " and type = 'SALE_REVERSAL'"))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("select reason from stock_movements where sale_item_id = ? and type = 'SALE_REVERSAL'",
                String.class, item.id())).isEqualTo("Item removido antes do fechamento");

        var report = reportService.generateDaily(LocalDate.now(businessClock), ReportChannel.ALL);
        assertThat(report.cancellations().cancelledItems()).isZero();
        assertThat(report.cancellations().mainReasons()).isEmpty();

        saleService.removeItem(sale.id(), item.id());
        assertThat(count("stock_movements", "sale_item_id = " + item.id() + " and type = 'SALE_REVERSAL'"))
                .isEqualTo(1);
        assertThatThrownBy(() -> saleService.close(sale.id())).isInstanceOf(BusinessException.class)
                .hasMessageContaining("vazia");
    }

    @Test
    void selectedSkewersShareStockWithDirectSalesAndLedgerDrivesDeltasAndCancellation() {
        ProductResponse jantinha = product(null, "Jantinha Completa", "34.90");
        ProductResponse carreteiro = product(null, "Carreteiro Completo", "34.90");
        ProductResponse picanha = product(null, "Picanha Montada", "12.90");
        ProductResponse otherProduct = product(null, "Outro produto", "5.00");
        var picanhaStock = stockItemService.create(new StockItemRequest(
                "Picanha Montada", null, UnitOfMeasure.UN, money("10.000"), money("2.000"), true));
        var alternateStock = stockItemService.create(new StockItemRequest(
                "Estoque alternativo", null, UnitOfMeasure.UN, money("10.000"), money("2.000"), true));
        stockLinkService.create(picanha.id(), new ProductStockLinkRequest(picanhaStock.id(), money("1.000")));

        ProductOptionGroupResponse jantinhaBeans = requiredChoice(jantinha, "Escolha o feijão", "Tropeiro");
        ProductOptionGroupResponse jantinhaSkewers = requiredChoice(jantinha, "Escolha o espeto", "Picanha Montada");
        ProductOptionGroupResponse carreteiroBeans = requiredChoice(carreteiro, "Escolha o feijão", "De caldo");
        ProductOptionGroupResponse carreteiroSkewers = requiredChoice(carreteiro, "Escolha o espeto", "Picanha Montada");
        ProductOptionGroupResponse unrelated = requiredChoice(otherProduct, "Escolha", "Invalida");
        Long jantinhaSkewerId = jantinhaSkewers.options().getFirst().id();
        Long carreteiroSkewerId = carreteiroSkewers.options().getFirst().id();
        optionStockLinkService.create(jantinha.id(), jantinhaSkewers.id(), jantinhaSkewerId,
                new ProductOptionStockLinkRequest(picanhaStock.id(), money("1.000")));
        optionStockLinkService.create(carreteiro.id(), carreteiroSkewers.id(), carreteiroSkewerId,
                new ProductOptionStockLinkRequest(picanhaStock.id(), money("1.000")));

        SaleResponse sale = counter();
        assertThatThrownBy(() -> saleService.addItem(sale.id(), new AddSaleItemRequest(
                jantinha.id(), 1, null, List.of(jantinhaBeans.options().getFirst().id()))))
                .isInstanceOf(BusinessException.class).hasMessageContaining("Selecione pelo menos");
        assertThatThrownBy(() -> saleService.addItem(sale.id(), new AddSaleItemRequest(
                jantinha.id(), 1, null, List.of(
                        jantinhaBeans.options().getFirst().id(), unrelated.options().getFirst().id()))))
                .isInstanceOf(BusinessException.class).hasMessageContaining("nao pertence");

        SaleItemResponse jantinhaItem = saleService.addItem(sale.id(), new AddSaleItemRequest(
                jantinha.id(), 1, null, List.of(
                        jantinhaBeans.options().getFirst().id(), jantinhaSkewerId)))
                .items().getFirst();
        assertThat(jantinhaItem.unitPrice()).isEqualByComparingTo("34.90");
        assertThat(stockItemService.getById(picanhaStock.id()).currentStock()).isEqualByComparingTo("9.000");
        assertThat(count("stock_movements", "sale_item_id = " + jantinhaItem.id())).isEqualTo(1);

        SaleResponse removalSale = counter();
        SaleItemResponse removableJantinha = saleService.addItem(removalSale.id(), new AddSaleItemRequest(
                jantinha.id(), 1, null, List.of(
                        jantinhaBeans.options().getFirst().id(), jantinhaSkewerId)))
                .items().getFirst();
        assertThat(stockItemService.getById(picanhaStock.id()).currentStock()).isEqualByComparingTo("8.000");
        saleService.removeItem(removalSale.id(), removableJantinha.id());
        assertThat(stockItemService.getById(picanhaStock.id()).currentStock()).isEqualByComparingTo("9.000");
        assertThat(count("stock_movements", "sale_item_id = " + removableJantinha.id() + " and type = 'SALE'"))
                .isEqualTo(1);
        assertThat(count("stock_movements", "sale_item_id = " + removableJantinha.id() + " and type = 'SALE_REVERSAL'"))
                .isEqualTo(1);

        optionStockLinkService.update(jantinha.id(), jantinhaSkewers.id(), jantinhaSkewerId,
                new ProductOptionStockLinkRequest(alternateStock.id(), money("2.000")));
        saleService.updateItemQuantity(sale.id(), jantinhaItem.id(), new UpdateSaleItemQuantityRequest(2));
        assertThat(stockItemService.getById(picanhaStock.id()).currentStock()).isEqualByComparingTo("8.000");
        assertThat(stockItemService.getById(alternateStock.id()).currentStock()).isEqualByComparingTo("10.000");
        saleService.updateItemQuantity(sale.id(), jantinhaItem.id(), new UpdateSaleItemQuantityRequest(1));
        assertThat(stockItemService.getById(picanhaStock.id()).currentStock()).isEqualByComparingTo("9.000");

        SaleItemResponse carreteiroItem = saleService.addItem(sale.id(), new AddSaleItemRequest(
                carreteiro.id(), 1, null, List.of(
                        carreteiroBeans.options().getFirst().id(), carreteiroSkewerId)))
                .items().stream().filter(item -> item.productId().equals(carreteiro.id())).findFirst().orElseThrow();
        SaleItemResponse directItem = saleService.addItem(sale.id(), new AddSaleItemRequest(
                picanha.id(), 1, null, List.of()))
                .items().stream().filter(item -> item.productId().equals(picanha.id())).findFirst().orElseThrow();
        assertThat(carreteiroItem.unitPrice()).isEqualByComparingTo("34.90");
        assertThat(directItem.subtotal()).isEqualByComparingTo("12.90");
        assertThat(stockItemService.getById(picanhaStock.id()).currentStock()).isEqualByComparingTo("7.000");
        assertThat(jdbc.queryForObject("select stock_item_id from stock_movements where sale_item_id = ? and type = 'SALE'",
                Long.class, carreteiroItem.id())).isEqualTo(picanhaStock.id());
        assertThat(jdbc.queryForObject("select stock_item_id from stock_movements where sale_item_id = ? and type = 'SALE'",
                Long.class, directItem.id())).isEqualTo(picanhaStock.id());

        saleService.cancelItem(sale.id(), jantinhaItem.id(), new CancellationRequest("Cliente mudou a escolha"));
        assertThat(stockItemService.getById(picanhaStock.id()).currentStock()).isEqualByComparingTo("8.000");
        assertThat(stockItemService.getById(alternateStock.id()).currentStock()).isEqualByComparingTo("10.000");

        int itemsBeforeFailure = count("sale_items", "sale_id = " + sale.id());
        assertThatThrownBy(() -> saleService.addItem(sale.id(), new AddSaleItemRequest(
                carreteiro.id(), 20, null, List.of(
                        carreteiroBeans.options().getFirst().id(), carreteiroSkewerId))))
                .isInstanceOf(BusinessException.class).hasMessageContaining("Picanha Montada");
        assertThat(stockItemService.getById(picanhaStock.id()).currentStock()).isEqualByComparingTo("8.000");
        assertThat(count("sale_items", "sale_id = " + sale.id())).isEqualTo(itemsBeforeFailure);
    }

    @Test
    void choicesWithoutStockLinksWorkWithoutAutomaticMovement() {
        ProductResponse portion = product(null, "Arroz Branco", "10.00");
        ProductOptionGroupResponse size = optionService.createGroup(portion.id(), new ProductOptionGroupRequest(
                "Tamanho", 1, 1, 0, true,
                List.of(
                        new ProductOptionRequest("Média", money("0.00"), 0, true),
                        new ProductOptionRequest("Grande", money("8.00"), 1, true)
                )));
        SaleResponse sale = counter();

        SaleItemResponse item = saleService.addItem(sale.id(), new AddSaleItemRequest(
                portion.id(), 1, null, List.of(size.options().get(1).id())))
                .items().getFirst();

        assertThat(item.unitPrice()).isEqualByComparingTo("18.00");
        assertThat(item.options()).singleElement().satisfies(option -> assertThat(option.optionName()).isEqualTo("Grande"));
        assertThat(count("stock_movements", "sale_item_id = " + item.id())).isZero();
    }

    @Test
    void packagedBeverageConsumesOneUnitPerSale() {
        ProductResponse beverage = product(null, "Refri Lata", "7.00");
        var stock = stockItemService.create(new StockItemRequest(
                "Refri Lata", null, UnitOfMeasure.UN, money("5.000"), money("1.000"), true));
        stockLinkService.create(beverage.id(), new ProductStockLinkRequest(stock.id(), money("1.000")));

        saleService.addItem(counter().id(), new AddSaleItemRequest(beverage.id(), 1, null, List.of()));

        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("4.000");
    }

    @Test
    void productAndChoiceConsumptionRollbackTogetherWhenEitherStockIsInsufficient() {
        ProductResponse product = product(null, "Combo embalado", "20.00");
        ProductOptionGroupResponse choice = requiredChoice(product, "Escolha o acompanhamento", "Molho");
        var packageStock = stockItemService.create(new StockItemRequest(
                "Embalagem", null, UnitOfMeasure.UN, money("10.000"), money("1.000"), true));
        var sauceStock = stockItemService.create(new StockItemRequest(
                "Molho", null, UnitOfMeasure.UN, money("1.000"), money("0.000"), true));
        stockLinkService.create(product.id(), new ProductStockLinkRequest(packageStock.id(), money("1.000")));
        optionStockLinkService.create(product.id(), choice.id(), choice.options().getFirst().id(),
                new ProductOptionStockLinkRequest(sauceStock.id(), money("1.000")));
        SaleResponse sale = counter();

        assertThatThrownBy(() -> saleService.addItem(sale.id(), new AddSaleItemRequest(
                product.id(), 2, null, List.of(choice.options().getFirst().id()))))
                .isInstanceOf(BusinessException.class).hasMessageContaining("Molho");
        assertThat(stockItemService.getById(packageStock.id()).currentStock()).isEqualByComparingTo("10.000");
        assertThat(stockItemService.getById(sauceStock.id()).currentStock()).isEqualByComparingTo("1.000");
        assertThat(count("sale_items", "sale_id = " + sale.id())).isZero();

        SaleItemResponse item = saleService.addItem(sale.id(), new AddSaleItemRequest(
                product.id(), 1, null, List.of(choice.options().getFirst().id())))
                .items().getFirst();
        assertThat(stockItemService.getById(packageStock.id()).currentStock()).isEqualByComparingTo("9.000");
        assertThat(stockItemService.getById(sauceStock.id()).currentStock()).isZero();
        assertThat(count("stock_movements", "sale_item_id = " + item.id())).isEqualTo(2);
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
        assertThatThrownBy(() -> saleService.removeItem(sale.id(), item.id()))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> saleService.updateItemQuantity(sale.id(), item.id(),
                new UpdateSaleItemQuantityRequest(2))).isInstanceOf(BusinessException.class);
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
        SaleResponse tableSale = saleService.open(new OpenSaleRequest(SaleType.TABLE, 1, null, null,
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
        SaleItemResponse cancelledItem = saleService.addItem(cancelled.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of())).items().getFirst();
        saleService.cancel(cancelled.id(), new CancellationRequest("Cancelamento operacional"));
        assertThatThrownBy(() -> saleService.addItem(cancelled.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of()))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> saleService.updateItemQuantity(cancelled.id(), cancelledItem.id(),
                new UpdateSaleItemQuantityRequest(2))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> saleService.close(cancelled.id())).isInstanceOf(BusinessException.class);

        SaleResponse closed = counter();
        SaleItemResponse closedItem = saleService.addItem(closed.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of())).items().getFirst();
        openCash("0.00");
        paymentService.create(closed.id(), new PaymentRequest(PaymentMethod.PIX, money("3.00"), null));
        assertThatThrownBy(() -> saleService.updateItemQuantity(closed.id(), closedItem.id(),
                new UpdateSaleItemQuantityRequest(2))).isInstanceOf(BusinessException.class);
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
                new AddSaleItemRequest(soldProduct.id(), 1, null, List.of())).items().stream()
                .filter(item -> item.productId().equals(soldProduct.id())).findFirst().orElseThrow();
        saleService.updateItemQuantity(sale.id(), sold.id(), new UpdateSaleItemQuantityRequest(2));
        saleService.cancelItem(sale.id(), cancelled.id(), new CancellationRequest("Cliente mudou de ideia"));
        var supplied = cashShiftService.addMovement(shift.id(),
                new CashMovementRequest(CashMovementType.SUPPLY, money("2.00"), "Troco"));
        assertThat(supplied.supplyAmount()).isEqualByComparingTo("2.00");
        assertThat(supplied.expectedCash()).isEqualByComparingTo("7.00");
        assertThat(supplied.movements().stream().filter(movement -> movement.type().equals("SUPPLY")))
                .singleElement()
                .satisfies(movement -> assertThat(movement.type()).isEqualTo("SUPPLY"));
        var withdrawn = cashShiftService.addMovement(shift.id(),
                new CashMovementRequest(CashMovementType.WITHDRAWAL, money("1.00"), "Sangria"));
        assertThat(withdrawn.withdrawalAmount()).isEqualByComparingTo("1.00");
        assertThat(withdrawn.expectedCash()).isEqualByComparingTo("6.00");
        assertThat(withdrawn.movements().stream()
                .filter(movement -> movement.type().equals("SUPPLY") || movement.type().equals("WITHDRAWAL")))
                .hasSize(2);
        assertThatThrownBy(() -> cashShiftService.addMovement(shift.id(),
                new CashMovementRequest(CashMovementType.SUPPLY, BigDecimal.ZERO, "Troco")))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> cashShiftService.addMovement(shift.id(),
                new CashMovementRequest(CashMovementType.WITHDRAWAL, money("1.00"), " ")))
                .isInstanceOf(BusinessException.class);
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

    private ProductOptionGroupResponse requiredChoice(ProductResponse product, String question, String choice) {
        return optionService.createGroup(product.id(), new ProductOptionGroupRequest(
                question, 1, 1, 0, true,
                List.of(new ProductOptionRequest(choice, BigDecimal.ZERO, 0, true))));
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
