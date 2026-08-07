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
        "hubon.seed.owner.name=Seed Owner", "hubon.seed.owner.email=seed-owner@seed.hubon.test",
        "hubon.seed.owner.password=configured-owner-pass-123", "hubon.seed.admin.enabled=true",
        "hubon.seed.admin.name=Seed Admin", "hubon.seed.admin.email=seed-admin@seed.hubon.test",
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
                sale_items, sales, product_stock_links, stock_items, product_options,
                product_option_groups, products, categories, restaurant_tables, cash_shifts,
                user_roles, users restart identity cascade
                """);
    }

    @Test
    void createsConfiguredUsersAndDirectlyPricedProductsIdempotently() throws Exception {
        String hash = jdbc.queryForObject("select password from users where email = 'seed-owner@seed.hubon.test'", String.class);
        assertThat(passwordEncoder.matches("configured-owner-pass-123", hash)).isTrue();
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("""
                {"email":"seed-owner@seed.hubon.test","password":"configured-owner-pass-123"}
                """)).andExpect(status().isOk()).andExpect(jsonPath("$.user.roles[0]").value("OWNER"));

        Map<String, Object> product = jdbc.queryForMap("select name, price from products where name = 'Refrigerante lata'");
        assertThat(product.get("price")).isEqualTo(new BigDecimal("7.50"));
        assertThat(jdbc.queryForObject("select count(*) from product_option_groups", Integer.class)).isZero();
        Map<String, Integer> before = counts();
        dataSeeder.run();
        dataSeeder.run();
        assertThat(counts()).isEqualTo(before);
    }

    private Map<String, Integer> counts() {
        return Map.of("categories", count("categories"), "products", count("products"),
                "users", count("users"), "tables", count("restaurant_tables"));
    }

    private int count(String table) { return jdbc.queryForObject("select count(*) from " + table, Integer.class); }
}
