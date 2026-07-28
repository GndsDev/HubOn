package com.hubon.backend;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;

import javax.sql.DataSource;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "hubon.seed.enabled=false"
})
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTestDatabaseGuard.class)
class LegacyDirectServiceMigrationIntegrationTests {

    private static final AtomicInteger TABLE_NUMBER = new AtomicInteger(95_000);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private DataSource dataSource;

    private String userEmail;
    private Long userId;
    private Long categoryId;
    private Long tableId;
    private Long tabId;
    private Long directProductId;
    private Long directVariantId;
    private Long preparationProductId;
    private Long preparationVariantId;

    @BeforeEach
    void setup() {
        String suffix = UUID.randomUUID().toString();
        jdbcTemplate.update(
                """
                insert into roles (name, description)
                values ('OWNER', 'Dono')
                on conflict (name) do nothing
                """
        );
        userEmail = "migration-" + suffix + "@migration.hubon.test";
        userId = jdbcTemplate.queryForObject(
                """
                insert into users (name, email, password, active)
                values ('Migration Owner', ?, 'not-used', true)
                returning id
                """,
                Long.class,
                userEmail
        );
        Long ownerRoleId = jdbcTemplate.queryForObject(
                "select id from roles where name = 'OWNER'",
                Long.class
        );
        jdbcTemplate.update("insert into user_roles (user_id, role_id) values (?, ?)", userId, ownerRoleId);

        categoryId = jdbcTemplate.queryForObject(
                """
                insert into categories (name, description, active, display_order)
                values (?, 'Migration V6', true, 0)
                returning id
                """,
                Long.class,
                "Migration " + suffix
        );
        tableId = jdbcTemplate.queryForObject(
                """
                insert into restaurant_tables (number, name, status, active)
                values (?, 'Mesa migration', 'OCCUPIED', true)
                returning id
                """,
                Long.class,
                TABLE_NUMBER.incrementAndGet()
        );
        tabId = jdbcTemplate.queryForObject(
                """
                insert into tabs (
                    restaurant_table_id, status, opened_by_user_id,
                    total_amount, service_fee, discount_amount, final_amount
                )
                values (?, 'OPEN', ?, 0, 0, 0, 0)
                returning id
                """,
                Long.class,
                tableId,
                userId
        );
        directProductId = insertProduct("Direto " + suffix, "DIRECT_SERVICE");
        directVariantId = insertVariant(directProductId);
        preparationProductId = insertProduct("Preparo " + suffix, "REQUIRES_PREPARATION");
        preparationVariantId = insertVariant(preparationProductId);
    }

    @AfterEach
    void cleanup() {
        jdbcTemplate.update("delete from order_item_options where order_item_id in (select item.id from order_items item join orders order_record on order_record.id = item.order_id where order_record.tab_id = ?)", tabId);
        jdbcTemplate.update("delete from order_items where order_id in (select id from orders where tab_id = ?)", tabId);
        jdbcTemplate.update("delete from orders where tab_id = ?", tabId);
        jdbcTemplate.update("delete from tabs where id = ?", tabId);
        jdbcTemplate.update("delete from restaurant_tables where id = ?", tableId);
        jdbcTemplate.update("delete from product_variants where product_id in (?, ?)", directProductId, preparationProductId);
        jdbcTemplate.update("delete from products where id in (?, ?)", directProductId, preparationProductId);
        jdbcTemplate.update("delete from categories where id = ?", categoryId);
        jdbcTemplate.update("delete from user_roles where user_id = ?", userId);
        jdbcTemplate.update("delete from users where email = ?", userEmail);
    }

    @Test
    void shouldCorrectOnlyLegacyDirectServicePreparationStates() {
        Long directOrderId = insertOrder("SENT_TO_KITCHEN");
        Long directItemId = insertItem(
                directOrderId,
                directProductId,
                directVariantId,
                "DIRECT_SERVICE",
                "WAITING_PREPARATION"
        );

        Long mixedOrderId = insertOrder("PREPARING");
        Long mixedDirectItemId = insertItem(
                mixedOrderId,
                directProductId,
                directVariantId,
                "DIRECT_SERVICE",
                "IN_PREPARATION"
        );
        Long mixedPreparationItemId = insertItem(
                mixedOrderId,
                preparationProductId,
                preparationVariantId,
                "REQUIRES_PREPARATION",
                "WAITING_PREPARATION"
        );

        Long canceledOrderId = insertOrder("CANCELLED");
        Long canceledItemId = insertItem(
                canceledOrderId,
                directProductId,
                directVariantId,
                "DIRECT_SERVICE",
                "CANCELED"
        );
        Long deliveredOrderId = insertOrder("DELIVERED");
        Long deliveredItemId = insertItem(
                deliveredOrderId,
                directProductId,
                directVariantId,
                "DIRECT_SERVICE",
                "DELIVERED"
        );

        new ResourceDatabasePopulator(
                new ClassPathResource("db/migration/V6__correct_legacy_direct_service_order_status.sql")
        ).execute(dataSource);

        assertThat(itemStatus(directItemId)).isEqualTo("READY");
        assertThat(orderStatus(directOrderId)).isEqualTo("READY");
        assertThat(itemStatus(mixedDirectItemId)).isEqualTo("READY");
        assertThat(itemStatus(mixedPreparationItemId)).isEqualTo("WAITING_PREPARATION");
        assertThat(orderStatus(mixedOrderId)).isEqualTo("PREPARING");
        assertThat(itemStatus(canceledItemId)).isEqualTo("CANCELED");
        assertThat(orderStatus(canceledOrderId)).isEqualTo("CANCELLED");
        assertThat(itemStatus(deliveredItemId)).isEqualTo("DELIVERED");
        assertThat(orderStatus(deliveredOrderId)).isEqualTo("DELIVERED");
        assertThat(jdbcTemplate.queryForObject(
                "select success from flyway_schema_history where version = '6'",
                Boolean.class
        )).isTrue();
    }

    private Long insertProduct(String name, String preparationFlow) {
        return jdbcTemplate.queryForObject(
                """
                insert into products (
                    category_id, name, description, preparation_flow,
                    active, available, display_order
                )
                values (?, ?, 'Migration V6', ?, true, true, 0)
                returning id
                """,
                Long.class,
                categoryId,
                name,
                preparationFlow
        );
    }

    private Long insertVariant(Long productId) {
        return jdbcTemplate.queryForObject(
                """
                insert into product_variants (
                    product_id, name, price, active, available, display_order
                )
                values (?, 'Padrao', 10, true, true, 0)
                returning id
                """,
                Long.class,
                productId
        );
    }

    private Long insertOrder(String status) {
        return jdbcTemplate.queryForObject(
                """
                insert into orders (tab_id, status, type, created_by_user_id, confirmed_at)
                values (?, ?, 'TABLE', ?, current_timestamp)
                returning id
                """,
                Long.class,
                tabId,
                status,
                userId
        );
    }

    private Long insertItem(
            Long orderId,
            Long productId,
            Long variantId,
            String preparationFlow,
            String status
    ) {
        return jdbcTemplate.queryForObject(
                """
                insert into order_items (
                    order_id, product_id, product_variant_id,
                    product_name_snapshot, product_variant_name_snapshot,
                    category_name_snapshot, preparation_flow_snapshot,
                    unit_price_snapshot, quantity, status, subtotal
                )
                values (?, ?, ?, 'Produto legado', 'Padrao', 'Migration', ?, 10, 1, ?, 10)
                returning id
                """,
                Long.class,
                orderId,
                productId,
                variantId,
                preparationFlow,
                status
        );
    }

    private String itemStatus(Long itemId) {
        return jdbcTemplate.queryForObject(
                "select status from order_items where id = ?",
                String.class,
                itemId
        );
    }

    private String orderStatus(Long orderId) {
        return jdbcTemplate.queryForObject(
                "select status from orders where id = ?",
                String.class,
                orderId
        );
    }
}
