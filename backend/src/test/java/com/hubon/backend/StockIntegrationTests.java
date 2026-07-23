package com.hubon.backend;

import com.fasterxml.jackson.databind.JsonNode;
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
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "hubon.security.permit-all=false",
        "hubon.seed.enabled=false"
})
@AutoConfigureMockMvc
class StockIntegrationTests {

    private static final String PASSWORD = "secret123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final List<Long> ingredientIds = new ArrayList<>();
    private final List<Long> productIds = new ArrayList<>();
    private final List<Long> categoryIds = new ArrayList<>();

    private String suffix;
    private String ownerEmail;
    private String cashierEmail;
    private String waiterEmail;

    @BeforeEach
    void setup() {
        suffix = UUID.randomUUID().toString();
        seedRole("OWNER", "Dono");
        seedRole("ADMIN", "Administrador");
        seedRole("WAITER", "Garcom");
        seedRole("KITCHEN", "Cozinha");
        seedRole("CASHIER", "Caixa");

        ownerEmail = insertUser("Owner Stock", "OWNER");
        cashierEmail = insertUser("Cashier Stock", "CASHIER");
        waiterEmail = insertUser("Waiter Stock", "WAITER");
    }

    @AfterEach
    void cleanup() {
        for (Long productId : productIds) {
            jdbcTemplate.update("delete from product_ingredients where product_id = ?", productId);
        }
        for (Long ingredientId : ingredientIds) {
            jdbcTemplate.update("delete from product_ingredients where ingredient_id = ?", ingredientId);
            jdbcTemplate.update("delete from inventory_movements where ingredient_id = ?", ingredientId);
            jdbcTemplate.update("delete from ingredients where id = ?", ingredientId);
        }
        for (Long productId : productIds) {
            jdbcTemplate.update("delete from products where id = ?", productId);
        }
        for (Long categoryId : categoryIds) {
            jdbcTemplate.update("delete from categories where id = ?", categoryId);
        }
        jdbcTemplate.update(
                """
                delete from user_roles
                where user_id in (
                    select id from users where email like '%@stock.hubon.test'
                )
                """
        );
        jdbcTemplate.update("delete from users where email like '%@stock.hubon.test'");
    }

    @Test
    void shouldCreateIngredientWithZeroStockAndStatus() throws Exception {
        Long ingredientId = createIngredient("Stock Test Carne " + suffix, "KG", "1.000", "5.000");

        mockMvc.perform(get("/api/ingredients/{id}", ingredientId)
                        .header("Authorization", bearer(tokenFor(ownerEmail))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Stock Test Carne " + suffix))
                .andExpect(jsonPath("$.unit").value("KG"))
                .andExpect(jsonPath("$.currentStock").value(0))
                .andExpect(jsonPath("$.stockStatus").value("OUT_OF_STOCK"));
    }

    @Test
    void shouldRejectDuplicateIngredientNameIgnoringCase() throws Exception {
        createIngredient("Stock Test Queijo " + suffix, "UN", "2.000", "10.000");

        mockMvc.perform(post("/api/ingredients")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ingredientPayload("stock test queijo " + suffix, "UN", "1.000", "4.000")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Ja existe um ingrediente com este nome"));
    }

    @Test
    void shouldRejectInvalidIngredientStockLevels() throws Exception {
        mockMvc.perform(post("/api/ingredients")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ingredientPayload("Stock Test Negativo " + suffix, "KG", "-1.000", "4.000")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/ingredients")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ingredientPayload("Stock Test Ideal Baixo " + suffix, "KG", "5.000", "4.000")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Estoque ideal nao pode ser menor que o estoque minimo"));
    }

    @Test
    void shouldRegisterEntryWithAuthenticatedUserAndBalances() throws Exception {
        Long ingredientId = createIngredient("Stock Test Pao " + suffix, "UN", "5.000", "20.000");

        mockMvc.perform(post("/api/inventory-movements/entries")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(movementPayload(ingredientId, "10.000", "Entrada manual")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("ENTRY"))
                .andExpect(jsonPath("$.quantity").value(10))
                .andExpect(jsonPath("$.previousStock").value(0))
                .andExpect(jsonPath("$.resultingStock").value(10))
                .andExpect(jsonPath("$.userName").value("Owner Stock"));

        assertMoney("10.000", ingredientStock(ingredientId));
    }

    @Test
    void shouldRegisterExitAndLossReducingStock() throws Exception {
        Long ingredientId = createIngredient("Stock Test Molho " + suffix, "L", "1.000", "5.000");
        registerEntry(ingredientId, "10.000");

        mockMvc.perform(post("/api/inventory-movements/exits")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(movementPayload(ingredientId, "3.000", "Uso manual")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("EXIT"))
                .andExpect(jsonPath("$.previousStock").value(10))
                .andExpect(jsonPath("$.resultingStock").value(7));

        mockMvc.perform(post("/api/inventory-movements/losses")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(movementPayload(ingredientId, "2.000", "Perda no preparo")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("LOSS"))
                .andExpect(jsonPath("$.previousStock").value(7))
                .andExpect(jsonPath("$.resultingStock").value(5));

        assertMoney("5.000", ingredientStock(ingredientId));
    }

    @Test
    void shouldRejectExitAboveCurrentStock() throws Exception {
        Long ingredientId = createIngredient("Stock Test Refrigerante " + suffix, "UN", "3.000", "12.000");
        registerEntry(ingredientId, "2.000");

        mockMvc.perform(post("/api/inventory-movements/exits")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(movementPayload(ingredientId, "3.000", "Saida acima do saldo")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Estoque nao pode ficar negativo"));

        assertMoney("2.000", ingredientStock(ingredientId));
    }

    @Test
    void shouldRejectMovementForInactiveIngredient() throws Exception {
        Long ingredientId = createIngredient("Stock Test Inativo " + suffix, "UN", "3.000", "12.000");

        mockMvc.perform(patch("/api/ingredients/{id}/deactivate", ingredientId)
                        .header("Authorization", bearer(tokenFor(ownerEmail))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post("/api/inventory-movements/entries")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(movementPayload(ingredientId, "2.000", "Ingrediente inativo")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Ingrediente inativo nao pode movimentar estoque"));

        assertMoney("0.000", ingredientStock(ingredientId));
        assertEquals(0, movementCount(ingredientId));
    }

    @Test
    void shouldSerializeConcurrentStockMovements() throws Exception {
        Long ingredientId = createIngredient("Stock Test Concorrencia " + suffix, "UN", "1.000", "10.000");
        registerEntry(ingredientId, "5.000");
        String ownerToken = tokenFor(ownerEmail);

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            Future<MvcResult> first = executor.submit(() -> concurrentExit(ingredientId, ownerToken, ready, start));
            Future<MvcResult> second = executor.submit(() -> concurrentExit(ingredientId, ownerToken, ready, start));

            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();

            int firstStatus = first.get(10, TimeUnit.SECONDS).getResponse().getStatus();
            int secondStatus = second.get(10, TimeUnit.SECONDS).getResponse().getStatus();
            long createdResponses = List.of(firstStatus, secondStatus).stream()
                    .filter(status -> status == 201)
                    .count();
            long rejectedResponses = List.of(firstStatus, secondStatus).stream()
                    .filter(status -> status == 400 || status == 409)
                    .count();

            assertEquals(1, createdResponses);
            assertEquals(1, rejectedResponses);
            assertMoney("2.000", ingredientStock(ingredientId));
            assertEquals(2, movementCount(ingredientId));
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void shouldRegisterAdjustmentUpdatingStock() throws Exception {
        Long ingredientId = createIngredient("Stock Test Embalagem " + suffix, "UN", "10.000", "50.000");
        registerEntry(ingredientId, "12.000");

        mockMvc.perform(post("/api/inventory-movements/adjustments")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(adjustmentPayload(ingredientId, "8.000", "Contagem fisica")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("ADJUSTMENT"))
                .andExpect(jsonPath("$.quantity").value(4))
                .andExpect(jsonPath("$.previousStock").value(12))
                .andExpect(jsonPath("$.resultingStock").value(8));

        assertMoney("8.000", ingredientStock(ingredientId));
    }

    @Test
    void shouldManageProductRecipeWithMultipleIngredientsAndRejectDuplicates() throws Exception {
        Long productId = insertProduct(true);
        Long meatId = createIngredient("Stock Test Receita Carne " + suffix, "KG", "1.000", "5.000");
        Long breadId = createIngredient("Stock Test Receita Pao " + suffix, "UN", "5.000", "20.000");

        mockMvc.perform(put("/api/products/{productId}/ingredients", productId)
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipePayload(
                                List.of(
                                        new RecipeItem(meatId, new BigDecimal("0.180")),
                                        new RecipeItem(breadId, new BigDecimal("1.000"))
                                )
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ingredients", hasSize(2)));

        mockMvc.perform(post("/api/products/{productId}/ingredients", productId)
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipeItemPayload(meatId, "0.200")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Ingrediente ja existe na ficha tecnica deste produto"));
    }

    @Test
    void shouldKeepRecipeUnchangedWhenReplacementFails() throws Exception {
        Long productId = insertProduct(true);
        Long meatId = createIngredient("Stock Test Transacao Carne " + suffix, "KG", "1.000", "5.000");
        Long cheeseId = createIngredient("Stock Test Transacao Queijo " + suffix, "UN", "5.000", "20.000");

        mockMvc.perform(put("/api/products/{productId}/ingredients", productId)
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipePayload(List.of(new RecipeItem(meatId, new BigDecimal("0.180"))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ingredients[0].ingredientId").value(meatId));

        mockMvc.perform(put("/api/products/{productId}/ingredients", productId)
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipePayload(
                                List.of(
                                        new RecipeItem(cheeseId, new BigDecimal("1.000")),
                                        new RecipeItem(cheeseId, new BigDecimal("2.000"))
                                )
                        )))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Ficha tecnica nao pode conter ingredientes duplicados"));

        mockMvc.perform(get("/api/products/{productId}/ingredients", productId)
                        .header("Authorization", bearer(tokenFor(ownerEmail))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ingredients", hasSize(1)))
                .andExpect(jsonPath("$.ingredients[0].ingredientId").value(meatId));
    }

    @Test
    void shouldEnforceStockAuthorization() throws Exception {
        mockMvc.perform(get("/api/ingredients"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));

        mockMvc.perform(get("/api/ingredients")
                        .header("Authorization", bearer(tokenFor(cashierEmail))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/ingredients")
                        .header("Authorization", bearer(tokenFor(cashierEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ingredientPayload("Stock Test Bloqueado " + suffix, "KG", "1.000", "4.000")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        mockMvc.perform(post("/api/inventory-movements/entries")
                        .header("Authorization", bearer(tokenFor(waiterEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(movementPayload(1L, "1.000", "Sem permissao")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    private Long createIngredient(String name, String unit, String minimumStock, String idealStock) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/ingredients")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ingredientPayload(name, unit, minimumStock, idealStock)))
                .andExpect(status().isCreated())
                .andReturn();
        Long id = objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asLong();
        ingredientIds.add(id);
        return id;
    }

    private void registerEntry(Long ingredientId, String quantity) throws Exception {
        mockMvc.perform(post("/api/inventory-movements/entries")
                        .header("Authorization", bearer(tokenFor(ownerEmail)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(movementPayload(ingredientId, quantity, "Entrada de teste")))
                .andExpect(status().isCreated());
    }

    private String ingredientPayload(String name, String unit, String minimumStock, String idealStock) throws Exception {
        return objectMapper.writeValueAsString(new IngredientPayload(
                name,
                "Ingrediente de teste",
                unit,
                new BigDecimal(minimumStock),
                new BigDecimal(idealStock),
                true
        ));
    }

    private String movementPayload(Long ingredientId, String quantity, String reason) throws Exception {
        return objectMapper.writeValueAsString(new MovementPayload(
                ingredientId,
                new BigDecimal(quantity),
                reason
        ));
    }

    private String adjustmentPayload(Long ingredientId, String newStock, String reason) throws Exception {
        return objectMapper.writeValueAsString(new AdjustmentPayload(
                ingredientId,
                new BigDecimal(newStock),
                reason
        ));
    }

    private String recipeItemPayload(Long ingredientId, String quantity) throws Exception {
        return objectMapper.writeValueAsString(new RecipeItem(ingredientId, new BigDecimal(quantity)));
    }

    private String recipePayload(List<RecipeItem> items) throws Exception {
        return objectMapper.writeValueAsString(items);
    }

    private Long insertProduct(boolean active) {
        Long categoryId = jdbcTemplate.queryForObject(
                """
                insert into categories (name, description, active, display_order)
                values (?, ?, true, 0)
                returning id
                """,
                Long.class,
                "Stock Test Categoria " + suffix + " " + categoryIds.size(),
                "Categoria usada em teste de estoque"
        );
        categoryIds.add(categoryId);

        Long productId = jdbcTemplate.queryForObject(
                """
                insert into products (category_id, name, price, active)
                values (?, ?, 25.00, ?)
                returning id
                """,
                Long.class,
                categoryId,
                "Stock Test Produto " + suffix + " " + productIds.size(),
                active
        );
        productIds.add(productId);
        return productId;
    }

    private BigDecimal ingredientStock(Long ingredientId) {
        return jdbcTemplate.queryForObject(
                "select current_stock from ingredients where id = ?",
                BigDecimal.class,
                ingredientId
        );
    }

    private Integer movementCount(Long ingredientId) {
        return jdbcTemplate.queryForObject(
                "select count(*) from inventory_movements where ingredient_id = ?",
                Integer.class,
                ingredientId
        );
    }

    private MvcResult concurrentExit(
            Long ingredientId,
            String token,
            CountDownLatch ready,
            CountDownLatch start
    ) throws Exception {
        ready.countDown();
        if (!start.await(5, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timeout aguardando inicio das movimentacoes concorrentes");
        }

        return mockMvc.perform(post("/api/inventory-movements/exits")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(movementPayload(ingredientId, "3.000", "Saida concorrente")))
                .andReturn();
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
        String email = label.toLowerCase().replace(" ", "-") + "-" + UUID.randomUUID() + "@stock.hubon.test";
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
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "%s"
                                }
                                """.formatted(email, PASSWORD)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode json = objectMapper.readTree(response);
        return json.path("token").asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual));
    }

    private record IngredientPayload(
            String name,
            String description,
            String unit,
            BigDecimal minimumStock,
            BigDecimal idealStock,
            Boolean active
    ) {
    }

    private record MovementPayload(
            Long ingredientId,
            BigDecimal quantity,
            String reason
    ) {
    }

    private record AdjustmentPayload(
            Long ingredientId,
            BigDecimal newStock,
            String reason
    ) {
    }

    private record RecipeItem(
            Long ingredientId,
            BigDecimal quantity
    ) {
    }
}
