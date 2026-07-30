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

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.hamcrest.Matchers.containsString;
import static org.assertj.core.api.Assertions.assertThat;
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
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTestDatabaseGuard.class)
class SecurityAuthorizationIntegrationTests {

    private static final String PASSWORD = "secret123";
    private static final AtomicInteger TABLE_NUMBER = new AtomicInteger(90_000);

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
    private String cashierEmail;
    private Long testCategoryId;
    private Long testTableId;
    private Long testTabId;
    private Long testOrderId;
    private final List<Long> testProductIds = new java.util.ArrayList<>();

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
        cashierEmail = insertUser("Cashier", "CASHIER");
    }

    @AfterEach
    void cleanup() {
        if (testOrderId != null) {
            jdbcTemplate.update("delete from order_item_options where order_item_id in (select id from order_items where order_id = ?)", testOrderId);
            jdbcTemplate.update("delete from order_items where order_id = ?", testOrderId);
            jdbcTemplate.update("delete from orders where id = ?", testOrderId);
        }
        if (testTabId != null) jdbcTemplate.update("delete from tabs where id = ?", testTabId);
        if (testTableId != null) jdbcTemplate.update("delete from restaurant_tables where id = ?", testTableId);
        for (Long productId : testProductIds) {
            jdbcTemplate.update("delete from product_variants where product_id = ?", productId);
            jdbcTemplate.update("delete from products where id = ?", productId);
        }
        if (testCategoryId != null) jdbcTemplate.update("delete from categories where id = ?", testCategoryId);
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
    void counterSaleShouldRequireAuthenticationAndRejectWaiter() throws Exception {
        String payload = "{\"customerName\":\"Cliente\",\"serviceFee\":0,\"discountAmount\":0}";
        mockMvc.perform(post("/api/tabs/counter").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/tabs/counter")
                        .header("Authorization", bearer(tokenFor(waiterEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/tabs/counter/active")
                        .header("Authorization", bearer(tokenFor(waiterEmail))))
                .andExpect(status().isForbidden());
    }

    @Test
    void cashierShouldCreateIndependentCounterSaleWithAuthenticatedIdentity() throws Exception {
        String body = mockMvc.perform(post("/api/tabs/counter")
                        .header("Authorization", bearer(tokenFor(cashierEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerName\":\"  Ana  \",\"customerPhone\":\" 62999990000 \",\"identificationNote\":\" Camiseta azul \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("COUNTER"))
                .andExpect(jsonPath("$.tableId").doesNotExist())
                .andExpect(jsonPath("$.customerName").value("Ana"))
                .andExpect(jsonPath("$.openedByUserName").value("Cashier"))
                .andExpect(jsonPath("$.displayLabel", containsString("Balcão #")))
                .andReturn().getResponse().getContentAsString();
        testTabId = objectMapper.readTree(body).path("id").asLong();

        mockMvc.perform(get("/api/tabs/counter/active")
                        .header("Authorization", bearer(tokenFor(cashierEmail))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(testTabId));

        mockMvc.perform(get("/api/tabs/counter/{id}", testTabId)
                        .header("Authorization", bearer(tokenFor(cashierEmail))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.id").value(testTabId));

        mockMvc.perform(get("/api/tabs/{id}", testTabId)
                        .header("Authorization", bearer(tokenFor(waiterEmail))))
                .andExpect(status().isForbidden());
    }

    @Test
    void monthlyReportShouldAllowOwnerAndAdminButRejectOperationalRoles() throws Exception {
        for (String email : List.of(ownerEmail, adminEmail)) {
            mockMvc.perform(get("/api/reports/monthly?year=2026&month=7")
                            .header("Authorization", bearer(tokenFor(email))))
                    .andExpect(status().isOk());
        }
        for (String email : List.of(waiterEmail, kitchenEmail, cashierEmail)) {
            mockMvc.perform(get("/api/reports/monthly?year=2026&month=7")
                            .header("Authorization", bearer(tokenFor(email))))
                    .andExpect(status().isForbidden());
        }
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
    void shouldAllowKitchenToUseOnlyPreparationQueueAndItemStatus() throws Exception {
        String token = tokenFor(kitchenEmail);
        OrderFixture order = insertMixedPreparationOrder();

        mockMvc.perform(get("/api/orders/preparation-queue")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].items[0].id").value(order.preparationItemId()));

        mockMvc.perform(patch("/api/orders/{orderId}/items/{itemId}/status", order.orderId(), order.preparationItemId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PREPARATION\"}"))
                .andExpect(status().isOk());
        assertThat(jdbcTemplate.queryForObject(
                "select status from order_items where id = ?",
                String.class,
                order.preparationItemId()
        )).isEqualTo("IN_PREPARATION");

        mockMvc.perform(patch("/api/orders/{orderId}/items/{itemId}/status", order.orderId(), order.directItemId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PREPARATION\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/api/orders/{orderId}/status", order.orderId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DELIVERED\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/orders")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/ingredients")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/inventory-movements")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/orders")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/orders/{orderId}/confirm", order.orderId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/orders/{orderId}/cancel", order.orderId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Operacao nao permitida\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldKeepOwnerAndAdminAccessToAdministrativeEndpoints() throws Exception {
        for (String email : List.of(ownerEmail, adminEmail)) {
            String token = tokenFor(email);

            mockMvc.perform(get("/api/categories")
                            .header("Authorization", bearer(token)))
                    .andExpect(status().isOk());

            mockMvc.perform(get("/api/ingredients")
                            .header("Authorization", bearer(token)))
                    .andExpect(status().isOk());
        }
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

    private OrderFixture insertMixedPreparationOrder() {
        String suffix = UUID.randomUUID().toString();
        testCategoryId = jdbcTemplate.queryForObject(
                """
                insert into categories (name, description, active, display_order)
                values (?, 'Categoria para seguranca', true, 0)
                returning id
                """,
                Long.class,
                "Seguranca " + suffix
        );
        Long preparationProductId = insertProduct("Produto preparo " + suffix, "REQUIRES_PREPARATION");
        Long directProductId = insertProduct("Produto direto " + suffix, "DIRECT_SERVICE");
        Long preparationVariantId = insertVariant(preparationProductId);
        Long directVariantId = insertVariant(directProductId);

        testTableId = jdbcTemplate.queryForObject(
                """
                insert into restaurant_tables (number, name, status, active)
                values (?, 'Mesa seguranca', 'OCCUPIED', true)
                returning id
                """,
                Long.class,
                TABLE_NUMBER.incrementAndGet()
        );
        Long ownerId = jdbcTemplate.queryForObject(
                "select id from users where email = ?",
                Long.class,
                ownerEmail
        );
        testTabId = jdbcTemplate.queryForObject(
                """
                insert into tabs (
                    restaurant_table_id, status, opened_by_user_id,
                    total_amount, service_fee, discount_amount, final_amount
                )
                values (?, 'OPEN', ?, 15, 0, 0, 15)
                returning id
                """,
                Long.class,
                testTableId,
                ownerId
        );
        testOrderId = jdbcTemplate.queryForObject(
                """
                insert into orders (tab_id, status, type, created_by_user_id, confirmed_at)
                values (?, 'SENT_TO_KITCHEN', 'TABLE', ?, current_timestamp)
                returning id
                """,
                Long.class,
                testTabId,
                ownerId
        );
        Long preparationItemId = insertOrderItem(
                preparationProductId,
                preparationVariantId,
                "Produto preparo " + suffix,
                "REQUIRES_PREPARATION",
                "WAITING_PREPARATION",
                "10.00"
        );
        Long directItemId = insertOrderItem(
                directProductId,
                directVariantId,
                "Produto direto " + suffix,
                "DIRECT_SERVICE",
                "READY",
                "5.00"
        );
        return new OrderFixture(testOrderId, preparationItemId, directItemId);
    }

    private Long insertProduct(String name, String preparationFlow) {
        Long productId = jdbcTemplate.queryForObject(
                """
                insert into products (
                    category_id, name, description, preparation_flow,
                    active, available, display_order
                )
                values (?, ?, 'Produto para teste de seguranca', ?, true, true, 0)
                returning id
                """,
                Long.class,
                testCategoryId,
                name,
                preparationFlow
        );
        testProductIds.add(productId);
        return productId;
    }

    private Long insertVariant(Long productId) {
        return jdbcTemplate.queryForObject(
                """
                insert into product_variants (
                    product_id, name, price, active, available, display_order
                )
                values (?, 'Padrao', 5, true, true, 0)
                returning id
                """,
                Long.class,
                productId
        );
    }

    private Long insertOrderItem(
            Long productId,
            Long variantId,
            String productName,
            String preparationFlow,
            String status,
            String price
    ) {
        return jdbcTemplate.queryForObject(
                """
                insert into order_items (
                    order_id, product_id, product_variant_id,
                    product_name_snapshot, product_variant_name_snapshot,
                    category_name_snapshot, preparation_flow_snapshot,
                    unit_price_snapshot, quantity, status, subtotal
                )
                values (?, ?, ?, ?, 'Padrao', 'Seguranca', ?, cast(? as numeric), 1, ?, cast(? as numeric))
                returning id
                """,
                Long.class,
                testOrderId,
                productId,
                variantId,
                productName,
                preparationFlow,
                price,
                status,
                price
        );
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

    private record OrderFixture(Long orderId, Long preparationItemId, Long directItemId) {
    }
}
