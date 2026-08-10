package com.hubon.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hubon.backend.auth.service.JwtService;
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

import java.util.Locale;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"hubon.security.permit-all=false", "hubon.seed.enabled=false"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTestDatabaseGuard.class)
class UsernameAuthenticationIntegrationTests {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JwtService jwtService;

    private String prefix;
    private String ownerUsername;

    @BeforeEach
    void setup() {
        prefix = "auth-" + UUID.randomUUID().toString().substring(0, 8);
        ownerUsername = prefix + "-owner";
        createUser(ownerUsername, "Correct123!", true, "OWNER");
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from user_roles where user_id in (select id from users where username like ?)", prefix + "%");
        jdbc.update("delete from users where username like ?", prefix + "%");
    }

    @Test
    void loginWithUsernameCreatesJwtAndAuthenticatesProtectedRequest() throws Exception {
        JsonNode login = login(ownerUsername, "Correct123!", 200);

        assertThat(login.path("user").path("username").asText()).isEqualTo(ownerUsername);
        assertThat(login.path("user").has("email")).isFalse();
        String token = login.path("token").asText();
        assertThat(jwtService.parse(token).username()).isEqualTo(ownerUsername);

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(ownerUsername))
                .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    void loginIsCaseInsensitive() throws Exception {
        JsonNode response = login(ownerUsername.toUpperCase(Locale.ROOT), "Correct123!", 200);
        assertThat(response.path("user").path("username").asText()).isEqualTo(ownerUsername);
    }

    @Test
    void wrongPasswordReturnsGenericInvalidCredentialsMessage() throws Exception {
        login(ownerUsername, "Wrong123!", 401);
    }

    @Test
    void unknownUsernameReturnsGenericInvalidCredentialsMessage() throws Exception {
        login(prefix + "-missing", "Correct123!", 401);
    }

    @Test
    void inactiveUserCannotAuthenticate() throws Exception {
        String inactiveUsername = prefix + "-inactive";
        createUser(inactiveUsername, "Correct123!", false, "ADMIN");
        login(inactiveUsername, "Correct123!", 401);
    }

    @Test
    void ownerCreatesNormalizedManagerAndDuplicateIsRejectedCaseInsensitively() throws Exception {
        String token = login(ownerUsername, "Correct123!", 200).path("token").asText();
        String managerUsername = prefix + "-manager";

        mockMvc.perform(post("/api/users")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Gerente de teste",
                                  "username": "%s",
                                  "password": "Manager123!",
                                  "active": true,
                                  "roles": ["ADMIN"]
                                }
                                """.formatted(managerUsername.toUpperCase(Locale.ROOT))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value(managerUsername))
                .andExpect(jsonPath("$.email").doesNotExist());

        mockMvc.perform(post("/api/users")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Gerente duplicado",
                                  "username": "%s",
                                  "password": "Manager123!",
                                  "active": true,
                                  "roles": ["ADMIN"]
                                }
                                """.formatted(managerUsername)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Nome de usuário já está cadastrado"));
    }

    @Test
    void invalidUsernameIsRejected() throws Exception {
        String token = login(ownerUsername, "Correct123!", 200).path("token").asText();

        mockMvc.perform(post("/api/users")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Gerente inválido",
                                  "username": "nome com espaço",
                                  "password": "Manager123!",
                                  "active": true,
                                  "roles": ["ADMIN"]
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("username")));
    }

    @Test
    void loginNoLongerAcceptsEmailPayload() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"legacy@hubon.local\",\"password\":\"Correct123!\"}"))
                .andExpect(status().isBadRequest());
    }

    private JsonNode login(String username, String password, int expectedStatus) throws Exception {
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginPayload(username, password))))
                .andExpect(status().is(expectedStatus))
                .andExpect(expectedStatus == 401
                        ? jsonPath("$.message").value("Credenciais inválidas")
                        : jsonPath("$.status").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response);
    }

    private void createUser(String username, String password, boolean active, String role) {
        Long userId = jdbc.queryForObject(
                "insert into users (name, username, password, active) values (?, ?, ?, ?) returning id",
                Long.class,
                username,
                username,
                passwordEncoder.encode(password),
                active
        );
        Long roleId = jdbc.queryForObject("select id from roles where name = ?", Long.class, role);
        jdbc.update("insert into user_roles (user_id, role_id) values (?, ?)", userId, roleId);
    }

    private record LoginPayload(String username, String password) {
    }
}
