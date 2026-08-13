package com.hubon.backend;

import com.hubon.backend.auth.service.AuthenticatedUser;
import com.hubon.backend.product.dto.ProductOptionGroupRequest;
import com.hubon.backend.product.dto.ProductOptionGroupResponse;
import com.hubon.backend.product.dto.ProductOptionRequest;
import com.hubon.backend.product.dto.ProductRequest;
import com.hubon.backend.product.dto.ProductResponse;
import com.hubon.backend.product.service.ProductOptionService;
import com.hubon.backend.product.service.ProductService;
import com.hubon.backend.role.domain.Role;
import com.hubon.backend.role.repository.RoleRepository;
import com.hubon.backend.sale.dto.AddSaleItemRequest;
import com.hubon.backend.sale.dto.CancellationRequest;
import com.hubon.backend.sale.dto.OpenSaleRequest;
import com.hubon.backend.sale.dto.SaleItemResponse;
import com.hubon.backend.sale.dto.SaleResponse;
import com.hubon.backend.sale.dto.UpdateSaleItemQuantityRequest;
import com.hubon.backend.sale.repository.SaleItemRepository;
import com.hubon.backend.sale.service.SaleService;
import com.hubon.backend.sale.domain.SaleType;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.stock.domain.UnitOfMeasure;
import com.hubon.backend.stock.dto.ProductOptionStockLinkRequest;
import com.hubon.backend.stock.dto.ProductStockLinkRequest;
import com.hubon.backend.stock.dto.StockItemRequest;
import com.hubon.backend.stock.dto.StockItemResponse;
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
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.LockSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {"spring.jpa.show-sql=false", "hubon.seed.enabled=false"})
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTestDatabaseGuard.class)
class StockLinkIntegrityIntegrationTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;
    @Autowired RoleRepository roleRepository;
    @Autowired UserRepository userRepository;
    @Autowired ProductService productService;
    @Autowired ProductOptionService optionService;
    @Autowired StockItemService stockItemService;
    @Autowired ProductStockLinkService productStockLinkService;
    @Autowired ProductOptionStockLinkService optionStockLinkService;
    @Autowired SaleService saleService;
    @Autowired SaleItemRepository saleItemRepository;

    private User user;

    @BeforeEach
    void setup() {
        clearDatabase();
        Role owner = roleRepository.findByName("OWNER").orElseThrow();
        user = userRepository.save(User.builder()
                .name("Auditoria de estoque")
                .username("stock-audit")
                .password("unused")
                .active(true)
                .roles(Set.of(owner))
                .build());
        authenticate();
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        clearDatabase();
    }

    @Test
    void effectiveSchemaAllowsLedgerDeltasAndEnforcesStockLinkIntegrity() {
        ProductResponse product = product("Produto auditado");
        ProductOptionGroupResponse group = requiredChoice(product, "Escolha", "Opcao auditada");
        Long optionId = group.options().getFirst().id();
        StockItemResponse stock = stock("Estoque auditado", "10.000");

        assertThat(jdbc.queryForObject("""
                select count(*) from pg_indexes
                where schemaname = 'public' and indexname = 'uq_stock_movements_sale_per_item'
                """, Integer.class)).isZero();
        assertThat(indexDefinition("uq_product_stock_links_active_product"))
                .contains("UNIQUE", "WHERE (active = true)");
        assertThat(indexDefinition("uq_product_option_stock_links_active_option"))
                .contains("UNIQUE", "WHERE (active = true)");

        productStockLinkService.create(product.id(), new ProductStockLinkRequest(stock.id(), value("0.125")));
        optionStockLinkService.create(product.id(), group.id(), optionId,
                new ProductOptionStockLinkRequest(stock.id(), value("0.250")));

        assertThatThrownBy(() -> productStockLinkService.create(
                product.id(), new ProductStockLinkRequest(stock.id(), BigDecimal.ONE)))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> optionStockLinkService.create(
                product.id(), group.id(), optionId,
                new ProductOptionStockLinkRequest(stock.id(), BigDecimal.ONE)))
                .isInstanceOf(BusinessException.class);
        assertSqlRejected("""
                insert into product_stock_links
                    (product_id, stock_item_id, quantity_per_sale, active)
                values (?, ?, 1, true)
                """, product.id(), stock.id());
        assertSqlRejected("""
                insert into product_option_stock_links
                    (product_option_id, stock_item_id, quantity_per_selection, active)
                values (?, ?, 1, true)
                """, optionId, stock.id());

        assertSqlRejected("""
                insert into product_stock_links
                    (product_id, stock_item_id, quantity_per_sale, active)
                values (?, ?, 0, false)
                """, product.id(), stock.id());
        assertSqlRejected("""
                insert into product_stock_links
                    (product_id, stock_item_id, quantity_per_sale, active)
                values (?, ?, -1, false)
                """, product.id(), stock.id());
        assertSqlRejected("""
                insert into product_stock_links
                    (product_id, stock_item_id, quantity_per_sale, active)
                values (?, ?, null, false)
                """, product.id(), stock.id());
        assertSqlRejected("""
                insert into product_option_stock_links
                    (product_option_id, stock_item_id, quantity_per_selection, active)
                values (?, ?, 0, false)
                """, optionId, stock.id());
        assertSqlRejected("""
                insert into stock_movements
                    (stock_item_id, type, delta_quantity, previous_balance, resulting_balance, created_by_user_id)
                values (?, 'ENTRY', -1, 10, 9, ?)
                """, stock.id(), user.getId());
        assertSqlRejected("""
                insert into stock_movements
                    (stock_item_id, type, delta_quantity, previous_balance, resulting_balance, created_by_user_id)
                values (?, 'ENTRY', 1, 10, 12, ?)
                """, stock.id(), user.getId());
        assertSqlRejected("""
                insert into stock_movements
                    (stock_item_id, type, delta_quantity, previous_balance, resulting_balance, created_by_user_id)
                values (?, 'EXIT', -11, 10, -1, ?)
                """, stock.id(), user.getId());
        assertSqlRejected("""
                insert into stock_movements
                    (stock_item_id, type, delta_quantity, previous_balance, resulting_balance, created_by_user_id)
                values (?, 'SALE', -1, 10, 9, ?)
                """, stock.id(), user.getId());

        productStockLinkService.deactivate(product.id());
        productStockLinkService.create(product.id(), new ProductStockLinkRequest(stock.id(), value("0.500")));
        optionStockLinkService.deactivate(product.id(), group.id(), optionId);
        optionStockLinkService.create(product.id(), group.id(), optionId,
                new ProductOptionStockLinkRequest(stock.id(), value("0.500")));

        assertThat(count("product_stock_links", "product_id = " + product.id())).isEqualTo(2);
        assertThat(count("product_stock_links", "product_id = " + product.id() + " and active")).isEqualTo(1);
        assertThat(count("product_option_stock_links", "product_option_id = " + optionId)).isEqualTo(2);
        assertThat(count("product_option_stock_links", "product_option_id = " + optionId + " and active"))
                .isEqualTo(1);
        assertSqlRejected("delete from stock_items where id = ?", stock.id());
        assertSqlRejected("delete from products where id = ?", product.id());
    }

    @Test
    void twoStockItemsFollowQuantityDeltasRemovalAndIdempotentReversal() {
        ProductResponse product = product("Jantinha");
        ProductOptionGroupResponse group = requiredChoice(product, "Escolha o espeto", "Picanha");
        Long optionId = group.options().getFirst().id();
        StockItemResponse packageStock = stock("Embalagem", "10.000");
        StockItemResponse meatStock = stock("Picanha", "10.000");
        productStockLinkService.create(product.id(),
                new ProductStockLinkRequest(packageStock.id(), BigDecimal.ONE));
        optionStockLinkService.create(product.id(), group.id(), optionId,
                new ProductOptionStockLinkRequest(meatStock.id(), BigDecimal.ONE));
        SaleResponse sale = counter();

        SaleItemResponse item = saleService.addItem(sale.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of(optionId)))
                .items().getFirst();
        assertBalances(packageStock, "9.000", meatStock, "9.000");
        assertThat(saleMovementStockIds(item.id(), "SALE"))
                .containsExactlyInAnyOrder(packageStock.id(), meatStock.id());

        saleService.updateItemQuantity(sale.id(), item.id(), new UpdateSaleItemQuantityRequest(3));
        assertBalances(packageStock, "7.000", meatStock, "7.000");
        assertThat(count("stock_movements", "sale_item_id = " + item.id() + " and type = 'SALE'"))
                .isEqualTo(4);

        saleService.updateItemQuantity(sale.id(), item.id(), new UpdateSaleItemQuantityRequest(2));
        assertBalances(packageStock, "8.000", meatStock, "8.000");
        assertThat(count("stock_movements", "sale_item_id = " + item.id() + " and type = 'SALE_REVERSAL'"))
                .isEqualTo(2);

        saleService.removeItem(sale.id(), item.id());
        assertBalances(packageStock, "10.000", meatStock, "10.000");
        assertThat(count("stock_movements", "sale_item_id = " + item.id())).isEqualTo(8);
        assertThat(jdbc.queryForObject("""
                select count(*)
                from stock_movements reversal
                join stock_movements original on original.id = reversal.reversed_movement_id
                where reversal.sale_item_id = ? and reversal.type = 'SALE_REVERSAL'
                  and (original.type <> 'SALE'
                    or original.sale_item_id <> reversal.sale_item_id
                    or original.stock_item_id <> reversal.stock_item_id)
                """, Integer.class, item.id())).isZero();
        assertLedgerBalances(item.id(), packageStock.id(), meatStock.id());

        saleService.removeItem(sale.id(), item.id());
        assertThat(count("stock_movements", "sale_item_id = " + item.id())).isEqualTo(8);

        SaleResponse cancelledSale = counter();
        SaleItemResponse cancelledItem = saleService.addItem(cancelledSale.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of(optionId)))
                .items().getFirst();
        saleService.cancelItem(cancelledSale.id(), cancelledItem.id(),
                new CancellationRequest("Cancelamento com dois estoques"));
        saleService.cancelItem(cancelledSale.id(), cancelledItem.id(),
                new CancellationRequest("Repeticao idempotente"));
        assertBalances(packageStock, "10.000", meatStock, "10.000");
        assertThat(saleMovementStockIds(cancelledItem.id(), "SALE"))
                .containsExactlyInAnyOrder(packageStock.id(), meatStock.id());
        assertThat(saleMovementStockIds(cancelledItem.id(), "SALE_REVERSAL"))
                .containsExactlyInAnyOrder(packageStock.id(), meatStock.id());
        assertThat(jdbc.queryForList("""
                select reason from stock_movements
                where sale_item_id = ? and type = 'SALE_REVERSAL'
                """, String.class, cancelledItem.id()))
                .containsOnly("Cancelamento com dois estoques");
        assertLedgerBalances(cancelledItem.id(), packageStock.id(), meatStock.id());
    }

    @Test
    void productAndOptionConsumptionForTheSameStockItemIsIntentionallyAggregated() {
        ProductResponse product = product("Combo fracionado");
        ProductOptionGroupResponse group = requiredChoice(product, "Complemento", "Porcao extra");
        Long optionId = group.options().getFirst().id();
        StockItemResponse stock = stock("Insumo fracionado", "10.000");
        productStockLinkService.create(product.id(),
                new ProductStockLinkRequest(stock.id(), value("0.500")));
        optionStockLinkService.create(product.id(), group.id(), optionId,
                new ProductOptionStockLinkRequest(stock.id(), value("0.250")));
        SaleResponse sale = counter();

        SaleItemResponse item = saleService.addItem(sale.id(),
                new AddSaleItemRequest(product.id(), 2, null, List.of(optionId)))
                .items().getFirst();

        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("8.500");
        assertThat(count("stock_movements", "sale_item_id = " + item.id() + " and type = 'SALE'"))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("""
                select delta_quantity from stock_movements
                where sale_item_id = ? and type = 'SALE'
                """, BigDecimal.class, item.id())).isEqualByComparingTo("-1.500");

        saleService.cancelItem(sale.id(), item.id(), new CancellationRequest("Cancelamento auditado"));
        saleService.cancelItem(sale.id(), item.id(), new CancellationRequest("Repeticao"));
        assertThat(stockItemService.getById(stock.id()).currentStock()).isEqualByComparingTo("10.000");
        assertThat(count("stock_movements", "sale_item_id = " + item.id() + " and type = 'SALE_REVERSAL'"))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("""
                select reason from stock_movements
                where sale_item_id = ? and type = 'SALE_REVERSAL'
                """, String.class, item.id())).isEqualTo("Cancelamento auditado");
        assertLedgerBalances(item.id(), stock.id());
    }

    @Test
    void historicalLedgerDrivesReversalAfterLinkChangeAndStockItemDeactivation() {
        ProductResponse product = product("Produto com troca de estoque");
        StockItemResponse originalStock = stock("Estoque original", "10.000");
        StockItemResponse currentStock = stock("Estoque atual", "10.000");
        productStockLinkService.create(product.id(),
                new ProductStockLinkRequest(originalStock.id(), BigDecimal.ONE));

        SaleResponse oldSale = counter();
        SaleItemResponse oldItem = saleService.addItem(oldSale.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of()))
                .items().getFirst();
        productStockLinkService.update(product.id(),
                new ProductStockLinkRequest(currentStock.id(), value("2.000")));
        stockItemService.deactivate(originalStock.id());

        saleService.removeItem(oldSale.id(), oldItem.id());
        assertThat(stockItemService.getById(originalStock.id()).currentStock()).isEqualByComparingTo("10.000");
        assertThat(stockItemService.getById(originalStock.id()).active()).isFalse();
        assertThat(stockItemService.getById(currentStock.id()).currentStock()).isEqualByComparingTo("10.000");

        SaleResponse currentSale = counter();
        SaleItemResponse currentItem = saleService.addItem(currentSale.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of()))
                .items().getFirst();
        assertThat(stockItemService.getById(currentStock.id()).currentStock()).isEqualByComparingTo("8.000");

        jdbc.update("update stock_items set active = false where id = ?", currentStock.id());
        SaleResponse rejectedSale = counter();
        assertThatThrownBy(() -> saleService.addItem(rejectedSale.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of())))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("inativo");
        assertThat(saleItemRepository.countBySaleIdAndCancelledAtIsNullAndRemovedAtIsNull(rejectedSale.id()))
                .isZero();
        assertThat(stockItemService.getById(currentStock.id()).currentStock()).isEqualByComparingTo("8.000");

        saleService.cancelItem(currentSale.id(), currentItem.id(), new CancellationRequest("Devolver inativo"));
        assertThat(stockItemService.getById(currentStock.id()).currentStock()).isEqualByComparingTo("10.000");
        assertLedgerBalances(oldItem.id(), originalStock.id());
        assertLedgerBalances(currentItem.id(), currentStock.id());
    }

    @Test
    void insufficientStockInOneOfMultipleLinksRollsBackTheWholeSaleItem() {
        ProductResponse product = product("Combo atomico");
        ProductOptionGroupResponse group = requiredChoice(product, "Escolha", "Sem saldo");
        Long optionId = group.options().getFirst().id();
        StockItemResponse available = stock("Disponivel", "100.000");
        StockItemResponse unavailable = stock("Indisponivel", "0.000");
        productStockLinkService.create(product.id(),
                new ProductStockLinkRequest(available.id(), BigDecimal.ONE));
        optionStockLinkService.create(product.id(), group.id(), optionId,
                new ProductOptionStockLinkRequest(unavailable.id(), BigDecimal.ONE));
        SaleResponse sale = counter();

        assertThatThrownBy(() -> saleService.addItem(sale.id(),
                new AddSaleItemRequest(product.id(), 1, null, List.of(optionId))))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Indisponivel");

        assertBalances(available, "100.000", unavailable, "0.000");
        assertThat(count("sale_items", "sale_id = " + sale.id())).isZero();
        assertThat(count("stock_movements", "stock_item_id in (" + available.id() + "," + unavailable.id()
                + ") and type in ('SALE', 'SALE_REVERSAL')"))
                .isZero();
    }

    @Test
    void concurrentSalesCannotConsumeTheSameLastUnit() throws Exception {
        ProductResponse product = product("Produto concorrente");
        ProductOptionGroupResponse group = requiredChoice(product, "Escolha", "Ultima unidade");
        Long optionId = group.options().getFirst().id();
        StockItemResponse stock = stock("Estoque concorrente", "1.000");
        optionStockLinkService.create(product.id(), group.id(), optionId,
                new ProductOptionStockLinkRequest(stock.id(), BigDecimal.ONE));
        SaleResponse firstSale = counter();
        SaleResponse secondSale = counter();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (Connection blocker = dataSource.getConnection();
             PreparedStatement lock = blocker.prepareStatement(
                     "select id from stock_items where id = ? for update")) {
            blocker.setAutoCommit(false);
            lock.setLong(1, stock.id());
            lock.executeQuery().close();

            Future<Throwable> first = executor.submit(() -> attemptSale(firstSale.id(), product.id(), optionId, ready, start));
            Future<Throwable> second = executor.submit(() -> attemptSale(secondSale.id(), product.id(), optionId, ready, start));
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            awaitBlockedStockConsumers(2, Duration.ofSeconds(5));
            blocker.commit();

            List<Throwable> failures = Arrays.asList(
                    first.get(10, TimeUnit.SECONDS),
                    second.get(10, TimeUnit.SECONDS)
            );
            assertThat(failures).filteredOn(failure -> failure == null).hasSize(1);
            assertThat(failures).filteredOn(failure -> failure instanceof BusinessException).hasSize(1);
        } finally {
            start.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }

        assertThat(stockItemService.getById(stock.id()).currentStock()).isZero();
        assertThat(count("stock_movements", "stock_item_id = " + stock.id() + " and type = 'SALE'"))
                .isEqualTo(1);
        assertThat(count("sale_items", "sale_id in (" + firstSale.id() + "," + secondSale.id() + ")"))
                .isEqualTo(1);
    }

    private Throwable attemptSale(
            Long saleId,
            Long productId,
            Long optionId,
            CountDownLatch ready,
            CountDownLatch start
    ) {
        authenticate();
        ready.countDown();
        try {
            if (!start.await(5, TimeUnit.SECONDS)) {
                return new IllegalStateException("Inicio concorrente nao liberado");
            }
            saleService.addItem(saleId, new AddSaleItemRequest(productId, 1, null, List.of(optionId)));
            return null;
        } catch (Throwable failure) {
            return failure;
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private void awaitBlockedStockConsumers(int expected, Duration timeout) {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            Integer blocked = jdbc.queryForObject("""
                    select count(*)
                    from pg_stat_activity
                    where datname = current_database()
                      and pid <> pg_backend_pid()
                      and wait_event_type = 'Lock'
                      and query ilike '%stock_items%'
                    """, Integer.class);
            if (blocked != null && blocked >= expected) return;
            LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(10));
        }
        throw new AssertionError("Operacoes concorrentes nao aguardaram o lock de estoque");
    }

    private void authenticate() {
        AuthenticatedUser principal = new AuthenticatedUser(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private ProductResponse product(String name) {
        return productService.create(new ProductRequest(
                null, name, null, value("20.00"), true, true, 0));
    }

    private ProductOptionGroupResponse requiredChoice(ProductResponse product, String groupName, String optionName) {
        return optionService.createGroup(product.id(), new ProductOptionGroupRequest(
                groupName, 1, 1, 0, true,
                List.of(new ProductOptionRequest(optionName, BigDecimal.ZERO, 0, true))));
    }

    private StockItemResponse stock(String name, String currentStock) {
        return stockItemService.create(new StockItemRequest(
                name, null, UnitOfMeasure.UN, value(currentStock), BigDecimal.ZERO, true));
    }

    private SaleResponse counter() {
        return saleService.open(new OpenSaleRequest(
                SaleType.COUNTER, null, null, null, BigDecimal.ZERO, BigDecimal.ZERO));
    }

    private void assertBalances(
            StockItemResponse first,
            String firstBalance,
            StockItemResponse second,
            String secondBalance
    ) {
        assertThat(stockItemService.getById(first.id()).currentStock()).isEqualByComparingTo(firstBalance);
        assertThat(stockItemService.getById(second.id()).currentStock()).isEqualByComparingTo(secondBalance);
    }

    private List<Long> saleMovementStockIds(Long saleItemId, String type) {
        return jdbc.queryForList("""
                select stock_item_id from stock_movements
                where sale_item_id = ? and type = ? order by stock_item_id
                """, Long.class, saleItemId, type);
    }

    private void assertLedgerBalances(Long saleItemId, Long... stockItemIds) {
        for (Long stockItemId : stockItemIds) {
            assertThat(jdbc.queryForObject("""
                    select coalesce(sum(delta_quantity), 0)
                    from stock_movements
                    where sale_item_id = ? and stock_item_id = ?
                    """, BigDecimal.class, saleItemId, stockItemId)).isZero();
        }
    }

    private String indexDefinition(String indexName) {
        return jdbc.queryForObject("""
                select indexdef from pg_indexes
                where schemaname = 'public' and indexname = ?
                """, String.class, indexName);
    }

    private void assertSqlRejected(String sql, Object... arguments) {
        assertThatThrownBy(() -> jdbc.update(sql, arguments)).isInstanceOf(DataAccessException.class);
    }

    private int count(String table, String where) {
        return jdbc.queryForObject("select count(*) from " + table + " where " + where, Integer.class);
    }

    private BigDecimal value(String value) {
        return new BigDecimal(value);
    }

    private void clearDatabase() {
        jdbc.execute("""
                truncate table stock_movements, payments, cash_movements, sale_item_options,
                sale_items, sales, product_option_stock_links, product_stock_links, stock_items, product_options,
                product_option_groups, products, categories, cash_shifts,
                user_roles, users restart identity cascade
                """);
    }
}
