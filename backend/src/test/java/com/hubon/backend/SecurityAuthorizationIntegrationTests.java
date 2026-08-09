package com.hubon.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"hubon.security.permit-all=false", "hubon.seed.enabled=false"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTestDatabaseGuard.class)
class SecurityAuthorizationIntegrationTests {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    private String ownerEmail;
    private String waiterEmail;
    private String kitchenEmail;

    @BeforeEach
    void setup() {
        ownerEmail = user("OWNER");
        waiterEmail = user("WAITER");
        kitchenEmail = user("KITCHEN");
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from sales where opened_by_user_id in (select id from users where email like '%@security.hubon.test')");
        jdbc.update("delete from user_roles where user_id in (select id from users where email like '%@security.hubon.test')");
        jdbc.update("delete from users where email like '%@security.hubon.test'");
    }

    @Test
    void anonymousRequestsAreRejected() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void operationalAccessUsesTheUnifiedSalesRoute() throws Exception {
        mockMvc.perform(post("/api/sales")
                        .header("Authorization", bearer(token(waiterEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"COUNTER\",\"serviceFee\":0,\"discountAmount\":0}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value("COUNTER"));
        mockMvc.perform(get("/api/categories").header("Authorization", bearer(token(waiterEmail))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/sales").header("Authorization", bearer(token(kitchenEmail))))
                .andExpect(status().isForbidden());
    }

    @Test
    void managementRoutesRemainRestrictedToManagementRoles() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary").header("Authorization", bearer(token(ownerEmail))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/reports/daily?date=2026-08-07")
                        .header("Authorization", bearer(token(ownerEmail))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/dashboard/summary").header("Authorization", bearer(token(waiterEmail))))
                .andExpect(status().isForbidden());
    }

    private String user(String role) {
        String email = role.toLowerCase() + "-" + UUID.randomUUID() + "@security.hubon.test";
        Long id = jdbc.queryForObject("insert into users (name, email, password, active) values (?, ?, ?, true) returning id",
                Long.class, role, email, passwordEncoder.encode("secret123"));
        Long roleId = jdbc.queryForObject("select id from roles where name = ?", Long.class, role);
        jdbc.update("insert into user_roles (user_id, role_id) values (?, ?)", id, roleId);
        return email;
    }

    private String token(String email) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"secret123\"}"))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("token").asText();
    }

    private String bearer(String token) { return "Bearer " + token; }
}
