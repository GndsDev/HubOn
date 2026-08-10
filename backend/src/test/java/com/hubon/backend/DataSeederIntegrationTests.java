package com.hubon.backend;

import com.hubon.backend.shared.config.DataSeeder;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "hubon.security.permit-all=false", "hubon.seed.enabled=true",
        "hubon.seed.owner.name=Seed Owner", "hubon.seed.owner.username=Seed-Owner",
        "hubon.seed.owner.password=configured-owner-pass-123", "hubon.seed.admin.enabled=true",
        "hubon.seed.admin.name=Seed Admin", "hubon.seed.admin.username=Seed-Admin",
        "hubon.seed.admin.password=configured-admin-pass-123"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTestDatabaseGuard.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DataSeederIntegrationTests {
    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired DataSeeder dataSeeder;

    @AfterAll
    void cleanup() {
        jdbc.execute("""
                truncate table stock_movements, payments, cash_movements, sale_item_options,
                sale_items, sales, product_option_stock_links, product_stock_links, stock_items, product_options,
                product_option_groups, products, categories, cash_shifts,
                user_roles, users restart identity cascade
                """);
    }

    @Test
    void createsConfiguredUsersCatalogAndInitialStockIdempotently() throws Exception {
        String hash = jdbc.queryForObject("select password from users where username = 'seed-owner'", String.class);
        assertThat(passwordEncoder.matches("configured-owner-pass-123", hash)).isTrue();
        assertThat(jdbc.queryForList("select username from users order by username", String.class))
                .containsExactly("seed-admin", "seed-owner");
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("""
                {"username":"SEED-OWNER","password":"configured-owner-pass-123"}
                """)).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").value("seed-owner"))
                .andExpect(jsonPath("$.user.roles[0]").value("OWNER"));

        Map<String, Object> product = jdbc.queryForMap("select name, price from products where name = 'Refrigerante lata'");
        assertThat(product.get("price")).isEqualTo(new BigDecimal("5.00"));
        Map<String, Object> stock = jdbc.queryForMap("""
                select current_stock, minimum_stock from stock_items where name = 'Jantinha completa'
                """);
        assertThat(stock.get("current_stock")).isEqualTo(new BigDecimal("20.000"));
        assertThat(stock.get("minimum_stock")).isEqualTo(new BigDecimal("5.000"));
        assertThat(count("products")).isEqualTo(56);
        assertThat(count("stock_items")).isEqualTo(56);
        assertThat(count("product_stock_links")).isEqualTo(42);
        assertThat(count("product_option_groups")).isEqualTo(9);
        assertThat(count("product_options")).isEqualTo(52);
        assertThat(count("product_option_stock_links")).isEqualTo(38);
        assertThat(count("stock_movements")).isEqualTo(56);

        Map<String, Object> portion = jdbc.queryForMap("select name, price from products where name = 'Arroz branco'");
        assertThat(portion.get("price")).isEqualTo(new BigDecimal("10.00"));
        assertThat(jdbc.queryForObject("""
                select additional_price from product_options choice
                join product_option_groups question on question.id = choice.option_group_id
                join products product on product.id = question.product_id
                where product.name = 'Arroz branco' and question.name = 'Tamanho' and choice.name = 'Grande'
                """, BigDecimal.class)).isEqualTo(new BigDecimal("8.00"));

        Long directSkewerStockItem = jdbc.queryForObject("""
                select link.stock_item_id from product_stock_links link
                join products product on product.id = link.product_id
                where product.name = 'Picanha montada' and link.active = true
                """, Long.class);
        Long selectedSkewerStockItem = jdbc.queryForObject("""
                select link.stock_item_id from product_option_stock_links link
                join product_options choice on choice.id = link.product_option_id
                join product_option_groups question on question.id = choice.option_group_id
                join products product on product.id = question.product_id
                where product.name = 'Jantinha completa' and choice.name = 'Picanha montada' and link.active = true
                """, Long.class);
        assertThat(selectedSkewerStockItem).isEqualTo(directSkewerStockItem);
        assertThat(jdbc.queryForObject("""
                select count(*) from product_option_stock_links link
                join product_options choice on choice.id = link.product_option_id
                join product_option_groups question on question.id = choice.option_group_id
                where question.name in ('Escolha o feijão', 'Tamanho') and link.active = true
                """, Integer.class)).isZero();
        assertThat(jdbc.queryForObject("""
                select count(*) from product_stock_links link
                join products product on product.id = link.product_id
                where product.name in ('Jantinha completa', 'Carreteiro completo', 'Arroz branco', 'Caipirinha')
                  and link.active = true
                """, Integer.class)).isZero();
        Map<String, Integer> before = counts();
        dataSeeder.run();
        dataSeeder.run();
        assertThat(counts()).isEqualTo(before);
    }

    private Map<String, Integer> counts() {
        return Map.of(
                "categories", count("categories"),
                "products", count("products"),
                "stockItems", count("stock_items"),
                "stockLinks", count("product_stock_links"),
                "optionGroups", count("product_option_groups"),
                "options", count("product_options"),
                "optionStockLinks", count("product_option_stock_links"),
                "stockMovements", count("stock_movements"),
                "users", count("users")
        );
    }

    private int count(String table) { return jdbc.queryForObject("select count(*) from " + table, Integer.class); }
}
