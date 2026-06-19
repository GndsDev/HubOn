package com.hubon.backend;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

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

    private String passwordHashFor(String email) {
        return jdbcTemplate.queryForObject(
                "select password from users where email = ?",
                String.class,
                email
        );
    }
}
