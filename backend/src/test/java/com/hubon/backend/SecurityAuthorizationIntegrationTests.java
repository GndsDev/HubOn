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
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "hubon.security.permit-all=false",
        "hubon.seed.enabled=false"
})
@AutoConfigureMockMvc
class SecurityAuthorizationIntegrationTests {

    private static final String PASSWORD = "secret123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String ownerEmail;
    private String adminEmail;
    private String waiterEmail;
    private String kitchenEmail;

    @BeforeEach
    void setup() {
        seedRole("OWNER", "Dono");
        seedRole("ADMIN", "Administrador");
        seedRole("WAITER", "Garçom");
        seedRole("KITCHEN", "Cozinha");
        seedRole("CASHIER", "Caixa");

        ownerEmail = insertUser("Owner", "OWNER");
        adminEmail = insertUser("Admin", "ADMIN");
        waiterEmail = insertUser("Waiter", "WAITER");
        kitchenEmail = insertUser("Kitchen", "KITCHEN");
    }

    @AfterEach
    void cleanup() {
        jdbcTemplate.update(
                """
                delete from user_roles
                where user_id in (
                    select id from users where email like '%@security.hubon.test'
                )
                """
        );
        jdbcTemplate.update("delete from users where email like '%@security.hubon.test'");
    }

    @Test
    void shouldReturnUnauthorizedWithoutToken() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void shouldReturnForbiddenWithInadequateRole() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary")
                        .header("Authorization", bearer(tokenFor(kitchenEmail))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void shouldAllowWaiterToAccessTablesButNotCategories() throws Exception {
        String token = tokenFor(waiterEmail);

        mockMvc.perform(get("/api/tables")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/categories")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldAllowKitchenToListOrdersButNotCreateOrders() throws Exception {
        String token = tokenFor(kitchenEmail);

        mockMvc.perform(get("/api/orders")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/orders")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownerShouldCreateAdminAndOperationalUsersButNotOwner() throws Exception {
        String token = tokenFor(ownerEmail);

        mockMvc.perform(post("/api/users")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(userPayload("created-admin", List.of("ADMIN"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roles[0]").value("ADMIN"));

        mockMvc.perform(post("/api/users")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(userPayload("created-waiter", List.of("WAITER"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roles[0]").value("WAITER"));

        mockMvc.perform(post("/api/users")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(userPayload("blocked-owner", List.of("OWNER"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Não é permitido criar usuário OWNER por este fluxo"));
    }

    @Test
    void adminShouldCreateOnlyOperationalUsers() throws Exception {
        String token = tokenFor(adminEmail);

        mockMvc.perform(post("/api/users")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(userPayload("admin-created-cashier", List.of("CASHIER"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roles[0]").value("CASHIER"));

        mockMvc.perform(post("/api/users")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(userPayload("admin-created-admin", List.of("ADMIN"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("ADMIN não pode criar outro ADMIN"));

        mockMvc.perform(post("/api/users")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(userPayload("admin-created-owner", List.of("OWNER"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Não é permitido criar usuário OWNER por este fluxo"));
    }

    @Test
    void operationalUserShouldNotCreateUsers() throws Exception {
        mockMvc.perform(post("/api/users")
                        .header("Authorization", bearer(tokenFor(waiterEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(userPayload("waiter-created-user", List.of("WAITER"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Acesso negado"));
    }

    @Test
    void loginShouldRejectInvalidPassword() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "wrong-password"
                                }
                                """.formatted(ownerEmail)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", containsString("Credenciais inválidas")));
    }

    @Test
    void meShouldRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void meShouldReturnAuthenticatedUserWithoutPassword() throws Exception {
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", bearer(tokenFor(ownerEmail))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Owner"))
                .andExpect(jsonPath("$.email").value(ownerEmail))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.roles[0]").value("OWNER"))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void changePasswordShouldRequireAuthentication() throws Exception {
        mockMvc.perform(patch("/api/auth/change-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordPayload(PASSWORD, "NewPass123!", "NewPass123!")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void changePasswordShouldRejectInvalidCurrentPassword() throws Exception {
        mockMvc.perform(patch("/api/auth/change-password")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordPayload("wrong-password", "NewPass123!", "NewPass123!")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Senha atual inválida."));
    }

    @Test
    void changePasswordShouldRejectConfirmationMismatch() throws Exception {
        mockMvc.perform(patch("/api/auth/change-password")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordPayload(PASSWORD, "NewPass123!", "OtherPass123!")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("A confirmação da senha não confere."));
    }

    @Test
    void changePasswordShouldRejectSamePassword() throws Exception {
        mockMvc.perform(patch("/api/auth/change-password")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordPayload(PASSWORD, PASSWORD, PASSWORD)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("A nova senha deve ser diferente da senha atual."));
    }

    @Test
    void changePasswordShouldRejectWeakPassword() throws Exception {
        mockMvc.perform(patch("/api/auth/change-password")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordPayload(PASSWORD, "weakpass", "weakpass")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("A nova senha não atende aos requisitos mínimos."));
    }

    @Test
    void changePasswordShouldSaveEncryptedPasswordAndInvalidateOldPassword() throws Exception {
        String newPassword = "NewPass123!";

        mockMvc.perform(patch("/api/auth/change-password")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordPayload(PASSWORD, newPassword, newPassword)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Senha alterada com sucesso."));

        String storedPassword = jdbcTemplate.queryForObject(
                "select password from users where email = ?",
                String.class,
                ownerEmail
        );
        org.assertj.core.api.Assertions.assertThat(storedPassword).isNotEqualTo(newPassword);
        org.assertj.core.api.Assertions.assertThat(passwordEncoder.matches(newPassword, storedPassword)).isTrue();

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "%s"
                                }
                                """.formatted(ownerEmail, PASSWORD)))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "%s"
                                }
                                """.formatted(ownerEmail, newPassword)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString());
    }

    private Long seedRole(String name, String description) {
        return jdbcTemplate.queryForObject(
                """
                insert into roles (name, description)
                values (?, ?)
                on conflict (name) do update set description = excluded.description
                returning id
                """,
                Long.class,
                name,
                description
        );
    }

    private String insertUser(String label, String role) {
        String email = label.toLowerCase() + "-" + UUID.randomUUID() + "@security.hubon.test";
        Long userId = jdbcTemplate.queryForObject(
                """
                insert into users (name, email, password, active)
                values (?, ?, ?, true)
                returning id
                """,
                Long.class,
                label,
                email,
                passwordEncoder.encode(PASSWORD)
        );
        Long roleId = jdbcTemplate.queryForObject(
                "select id from roles where name = ?",
                Long.class,
                role
        );
        jdbcTemplate.update(
                "insert into user_roles (user_id, role_id) values (?, ?)",
                userId,
                roleId
        );
        return email;
    }

    private String tokenFor(String email) throws Exception {
        return tokenFor(email, PASSWORD);
    }

    private String tokenFor(String email, String password) throws Exception {
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "%s"
                                }
                                """.formatted(email, password)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("token").asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String userPayload(String label, List<String> roles) throws Exception {
        return objectMapper.writeValueAsString(new UserPayload(
                "Usuário " + label,
                label + "-" + UUID.randomUUID() + "@security.hubon.test",
                "secret123",
                true,
                roles
        ));
    }

    private String passwordPayload(String currentPassword, String newPassword, String confirmPassword) throws Exception {
        return objectMapper.writeValueAsString(new PasswordPayload(
                currentPassword,
                newPassword,
                confirmPassword
        ));
    }

    private record UserPayload(
            String name,
            String email,
            String password,
            Boolean active,
            List<String> roles
    ) {
    }

    private record PasswordPayload(
            String currentPassword,
            String newPassword,
            String confirmPassword
    ) {
    }
}
