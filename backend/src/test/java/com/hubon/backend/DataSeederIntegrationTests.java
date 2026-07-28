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
        "spring.jpa.show-sql=false",
        "hubon.security.permit-all=false",
        "hubon.seed.enabled=true",
        "hubon.seed.owner.name=Seed Owner",
        "hubon.seed.owner.email=seed-owner@seed.hubon.test",
        "hubon.seed.owner.password=configured-owner-pass-123",
        "hubon.seed.admin.enabled=true",
        "hubon.seed.admin.name=Seed Admin",
        "hubon.seed.admin.email=seed-admin@seed.hubon.test",
        "hubon.seed.admin.password=configured-admin-pass-123"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTestDatabaseGuard.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DataSeederIntegrationTests {

    private static final String OWNER_EMAIL = "seed-owner@seed.hubon.test";
    private static final String OWNER_PASSWORD = "configured-owner-pass-123";
    private static final String ADMIN_EMAIL = "seed-admin@seed.hubon.test";
    private static final String ADMIN_PASSWORD = "configured-admin-pass-123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private DataSeeder dataSeeder;

    @AfterAll
    void cleanup() {
        jdbcTemplate.update(
                """
                delete from user_roles
                where user_id in (
                    select id from users where email in (?, ?)
                )
                """,
                OWNER_EMAIL,
                ADMIN_EMAIL
        );
        jdbcTemplate.update("delete from users where email in (?, ?)", OWNER_EMAIL, ADMIN_EMAIL);
    }

    @Test
    void shouldCreateSeedUsersWithConfiguredEncryptedPasswords() {
        String ownerPasswordHash = passwordHashFor(OWNER_EMAIL);
        String adminPasswordHash = passwordHashFor(ADMIN_EMAIL);

        assertThat(ownerPasswordHash).isNotEqualTo(OWNER_PASSWORD);
        assertThat(adminPasswordHash).isNotEqualTo(ADMIN_PASSWORD);
        assertThat(passwordEncoder.matches(OWNER_PASSWORD, ownerPasswordHash)).isTrue();
        assertThat(passwordEncoder.matches(ADMIN_PASSWORD, adminPasswordHash)).isTrue();
    }

    @Test
    void shouldLoginWithConfiguredOwnerCredentials() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "%s"
                                }
                                """.formatted(OWNER_EMAIL, OWNER_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value(OWNER_EMAIL))
                .andExpect(jsonPath("$.user.roles[0]").value("OWNER"));
    }

    @Test
    void shouldSeedExplicitProductFlowsDefaultVariantsAndRemainIdempotent() {
        Map<String, Object> juice = seededProduct("Suco natural");
        Map<String, Object> soda = seededProduct("Refrigerante lata");
        Map<String, Object> executive = seededProduct("Executivo da casa");

        assertThat(juice.get("preparation_flow")).isEqualTo("REQUIRES_PREPARATION");
        assertThat(soda.get("preparation_flow")).isEqualTo("DIRECT_SERVICE");
        assertThat(executive.get("preparation_flow")).isEqualTo("REQUIRES_PREPARATION");
        assertThat(juice.get("variant_name")).isEqualTo("Padr\u00e3o");
        assertThat(soda.get("variant_name")).isEqualTo("Padr\u00e3o");
        assertThat(executive.get("variant_name")).isEqualTo("Padr\u00e3o");
        assertThat((BigDecimal) juice.get("price")).isEqualByComparingTo("9.90");
        assertThat((BigDecimal) soda.get("price")).isEqualByComparingTo("7.50");
        assertThat((BigDecimal) executive.get("price")).isEqualByComparingTo("32.90");

        Map<String, Integer> countsBefore = seedCounts();
        dataSeeder.run();
        dataSeeder.run();

        assertThat(seedCounts()).isEqualTo(countsBefore);
    }

    private String passwordHashFor(String email) {
        return jdbcTemplate.queryForObject(
                "select password from users where email = ?",
                String.class,
                email
        );
    }

    private Map<String, Object> seededProduct(String name) {
        return jdbcTemplate.queryForMap(
                """
                select product.preparation_flow,
                       variant.name as variant_name,
                       variant.price
                from products product
                join product_variants variant on variant.product_id = product.id
                where product.name = ?
                """,
                name
        );
    }

    private Map<String, Integer> seedCounts() {
        return Map.of(
                "categories", count("categories"),
                "products", count("products"),
                "variants", count("product_variants"),
                "users", count("users"),
                "tables", count("restaurant_tables")
        );
    }

    private int count(String table) {
        return jdbcTemplate.queryForObject("select count(*) from " + table, Integer.class);
    }
}
