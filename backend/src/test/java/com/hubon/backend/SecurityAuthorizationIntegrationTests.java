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
    private String ownerUsername;
    private String adminUsername;
    private String waiterUsername;
    private String kitchenUsername;

    @BeforeEach
    void setup() {
        ownerUsername = user("OWNER");
        adminUsername = user("ADMIN");
        waiterUsername = user("WAITER");
        kitchenUsername = user("KITCHEN");
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from sales where opened_by_user_id in (select id from users where username like 'security-%')");
        jdbc.update("delete from user_roles where user_id in (select id from users where username like 'security-%')");
        jdbc.update("delete from users where username like 'security-%'");
    }

    @Test
    void anonymousRequestsAreRejected() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void operationalAccessUsesTheUnifiedSalesRoute() throws Exception {
        mockMvc.perform(post("/api/sales")
                        .header("Authorization", bearer(token(waiterUsername)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"COUNTER\",\"serviceFee\":0,\"discountAmount\":0}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value("COUNTER"));
        mockMvc.perform(get("/api/categories").header("Authorization", bearer(token(waiterUsername))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/sales").header("Authorization", bearer(token(kitchenUsername))))
                .andExpect(status().isForbidden());
    }

    @Test
    void managementRoutesRemainRestrictedToManagementRoles() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary").header("Authorization", bearer(token(ownerUsername))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/reports/daily?date=2026-08-07")
                        .header("Authorization", bearer(token(ownerUsername))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/dashboard/summary").header("Authorization", bearer(token(waiterUsername))))
                .andExpect(status().isForbidden());
    }

    @Test
    void expensesAreRestrictedToOwnerAndAdmin() throws Exception {
        mockMvc.perform(get("/api/expenses").header("Authorization", bearer(token(ownerUsername))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/expenses").header("Authorization", bearer(token(adminUsername))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/expenses").header("Authorization", bearer(token(waiterUsername))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/expenses")
                        .header("Authorization", bearer(token(kitchenUsername)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void stockConfigurationAndManualMovementsAreRestrictedToOwnerAndAdmin() throws Exception {
        String linkBody = "{\"stockItemId\":999,\"quantityPerSale\":1}";
        String optionLinkBody = "{\"stockItemId\":999,\"quantityPerSelection\":1}";
        String movementBody = "{\"stockItemId\":999,\"quantity\":1,\"reason\":\"Auditoria\"}";

        mockMvc.perform(post("/api/products/999/stock-link")
                        .header("Authorization", bearer(token(ownerUsername)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(linkBody))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/products/999/stock-link")
                        .header("Authorization", bearer(token(adminUsername)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(linkBody))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/products/999/stock-link")
                        .header("Authorization", bearer(token(waiterUsername)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(linkBody))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/products/999/option-groups/999/options/999/stock-link")
                        .header("Authorization", bearer(token(waiterUsername)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(optionLinkBody))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/stock-movements/entries")
                        .header("Authorization", bearer(token(waiterUsername)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(movementBody))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/products/999/stock-link")
                        .header("Authorization", bearer(token(ownerUsername)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stockItemId\":999,\"quantityPerSale\":0}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/products/999/option-groups/999/options/999/stock-link")
                        .header("Authorization", bearer(token(ownerUsername)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stockItemId\":999,\"quantityPerSelection\":-1}"))
                .andExpect(status().isBadRequest());
    }

    private String user(String role) {
        String username = "security-" + role.toLowerCase() + "-" + UUID.randomUUID().toString().substring(0, 8);
        Long id = jdbc.queryForObject("insert into users (name, username, password, active) values (?, ?, ?, true) returning id",
                Long.class, role, username, passwordEncoder.encode("secret123"));
        Long roleId = jdbc.queryForObject("select id from roles where name = ?", Long.class, role);
        jdbc.update("insert into user_roles (user_id, role_id) values (?, ?)", id, roleId);
        return username;
    }

    private String token(String username) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"secret123\"}"))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("token").asText();
    }

    private String bearer(String token) { return "Bearer " + token; }
}
