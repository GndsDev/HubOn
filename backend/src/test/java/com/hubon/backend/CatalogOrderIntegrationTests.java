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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "hubon.security.permit-all=false",
        "hubon.seed.enabled=false"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTestDatabaseGuard.class)
class CatalogOrderIntegrationTests {

    private static final String PASSWORD = "secret123";
    private static final AtomicInteger TABLE_NUMBER = new AtomicInteger(70_000);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final List<Long> productIds = new ArrayList<>();
    private final List<Long> orderIds = new ArrayList<>();
    private String suffix;
    private String token;
    private Long categoryId;
    private Long tableId;
    private Long tabId;

    @BeforeEach
    void setup() throws Exception {
        suffix = UUID.randomUUID().toString();
        seedRole("OWNER", "Dono");
        String email = insertOwner();
        token = tokenFor(email);
        categoryId = jdbcTemplate.queryForObject(
                """
                insert into categories (name, description, active, display_order)
                values (?, 'Categoria de integracao', true, 0)
                returning id
                """,
                Long.class,
                "Catalogo " + suffix
        );
        tableId = jdbcTemplate.queryForObject(
                """
                insert into restaurant_tables (number, name, status, active)
                values (?, 'Mesa catalogo', 'OCCUPIED', true)
                returning id
                """,
                Long.class,
                TABLE_NUMBER.incrementAndGet()
        );
        Long ownerId = jdbcTemplate.queryForObject(
                "select id from users where email = ?",
                Long.class,
                email
        );
        tabId = jdbcTemplate.queryForObject(
                """
                insert into tabs (
                    restaurant_table_id, status, opened_by_user_id,
                    total_amount, service_fee, discount_amount, final_amount
                )
                values (?, 'OPEN', ?, 0, 0, 0, 0)
                returning id
                """,
                Long.class,
                tableId,
                ownerId
        );
    }

    @AfterEach
    void cleanup() {
        for (Long orderId : orderIds) {
            jdbcTemplate.update("delete from inventory_movements where order_id = ?", orderId);
            jdbcTemplate.update("delete from order_item_options where order_item_id in (select id from order_items where order_id = ?)", orderId);
            jdbcTemplate.update("delete from order_items where order_id = ?", orderId);
            jdbcTemplate.update("delete from orders where id = ?", orderId);
        }
        jdbcTemplate.update("delete from payments where tab_id = ?", tabId);
        jdbcTemplate.update("delete from tabs where id = ?", tabId);
        jdbcTemplate.update("delete from restaurant_tables where id = ?", tableId);
        for (Long productId : productIds) {
            jdbcTemplate.update("delete from product_stock_links where product_variant_id in (select id from product_variants where product_id = ?)", productId);
            jdbcTemplate.update("delete from product_options where group_id in (select id from product_option_groups where product_id = ?)", productId);
            jdbcTemplate.update("delete from product_option_groups where product_id = ?", productId);
            jdbcTemplate.update("delete from product_variants where product_id = ?", productId);
            jdbcTemplate.update("delete from products where id = ?", productId);
        }
        jdbcTemplate.update("delete from categories where id = ?", categoryId);
        jdbcTemplate.update("delete from user_roles where user_id in (select id from users where email like ?)", "%@catalog.hubon.test");
        jdbcTemplate.update("delete from users where email like ?", "%@catalog.hubon.test");
    }

    @Test
    void shouldCreateBaseProductsWithoutPriceForBothPreparationFlows() throws Exception {
        JsonNode preparation = createBaseProduct("Espeto", "REQUIRES_PREPARATION", true);
        JsonNode direct = createBaseProduct("Agua", "DIRECT_SERVICE", true);

        assertFalse(preparation.has("price"));
        assertEquals("REQUIRES_PREPARATION", preparation.path("preparationFlow").asText());
        assertFalse(preparation.path("complete").asBoolean());
        assertEquals(0, preparation.path("variantCount").asInt());
        assertEquals("DIRECT_SERVICE", direct.path("preparationFlow").asText());
        assertEquals(0, jdbcTemplate.queryForObject(
                "select count(*) from information_schema.columns where table_name = 'products' and column_name = 'price'",
                Integer.class
        ));
    }

    @Test
    void shouldRegisterDefaultAndMultipleVariantsAndRejectInvalidPricesOrDuplicates() throws Exception {
        JsonNode simple = registerProduct(
                "Espeto simples",
                "REQUIRES_PREPARATION",
                true,
                List.of(variant("Padrao", "12.00", true)),
                List.of()
        );
        JsonNode multiple = registerProduct(
                "Coca-Cola",
                "DIRECT_SERVICE",
                true,
                List.of(variant("Lata", "5.00", true), variant("2 L", "12.00", true)),
                List.of()
        );

        assertTrue(simple.path("complete").asBoolean());
        assertEquals(1, simple.path("variantCount").asInt());
        assertMoney("12.00", simple.path("minimumVariantPrice").decimalValue());
        assertEquals(2, multiple.path("variantCount").asInt());
        assertMoney("5.00", multiple.path("minimumVariantPrice").decimalValue());
        assertMoney("12.00", multiple.path("maximumVariantPrice").decimalValue());

        MvcResult duplicate = registerProductRequest(
                "Duplicado",
                "DIRECT_SERVICE",
                true,
                List.of(variant("Lata", "5.00", true), variant("lata", "6.00", true)),
                List.of()
        );
        assertEquals(400, duplicate.getResponse().getStatus());
        assertTrue(responseJson(duplicate).path("message").asText().contains("repita variacoes"));

        MvcResult negative = registerProductRequest(
                "Preco negativo",
                "DIRECT_SERVICE",
                true,
                List.of(variant("Padrao", "-1.00", true)),
                List.of()
        );
        assertEquals(400, negative.getResponse().getStatus());
    }

    @Test
    void shouldRequireSellableProductAndExplicitVariantWhenThereAreMultipleChoices() throws Exception {
        JsonNode incomplete = createBaseProduct("Sem variacao", "DIRECT_SERVICE", true);
        assertEquals(400, createOrderRequest(List.of(orderItem(incomplete.path("id").asLong(), null, 1, List.of()))).getResponse().getStatus());

        JsonNode oneVariant = registerProduct(
                "Agua mineral",
                "DIRECT_SERVICE",
                true,
                List.of(variant("Padrao", "4.00", true)),
                List.of()
        );
        JsonNode oneVariantOrder = createOrder(List.of(orderItem(oneVariant.path("id").asLong(), null, 1, List.of())));
        assertEquals(oneVariant.path("variants").get(0).path("id").asLong(), oneVariantOrder.path("items").get(0).path("variantId").asLong());

        JsonNode multiple = registerProduct(
                "Refrigerante",
                "DIRECT_SERVICE",
                true,
                List.of(variant("Lata", "5.00", true), variant("600 mL", "7.00", true)),
                List.of()
        );
        assertEquals(400, createOrderRequest(List.of(orderItem(multiple.path("id").asLong(), null, 1, List.of()))).getResponse().getStatus());

        long firstVariantId = multiple.path("variants").get(0).path("id").asLong();
        patchOk("/api/products/%d/unavailable".formatted(multiple.path("id").asLong()));
        assertEquals(400, createOrderRequest(List.of(orderItem(multiple.path("id").asLong(), firstVariantId, 1, List.of()))).getResponse().getStatus());
        patchOk("/api/products/%d/available".formatted(multiple.path("id").asLong()));
        patchOk("/api/products/%d/variants/%d/unavailable".formatted(multiple.path("id").asLong(), firstVariantId));
        assertEquals(400, createOrderRequest(List.of(orderItem(multiple.path("id").asLong(), firstVariantId, 1, List.of()))).getResponse().getStatus());
    }

    @Test
    void shouldValidateRequiredOptionsSelectionLimitsAndProductOwnership() throws Exception {
        JsonNode configured = registerProduct(
                "Jantinha",
                "REQUIRES_PREPARATION",
                true,
                List.of(variant("Padrao", "20.00", true)),
                List.of(group("Acompanhamento", true, 1, 1, List.of(option("Tropeiro", "0"), option("Caldo", "2.00"))))
        );
        long productId = configured.path("id").asLong();
        long variantId = configured.path("variants").get(0).path("id").asLong();
        long optionId = configured.path("optionGroups").get(0).path("options").get(0).path("id").asLong();

        assertEquals(400, createOrderRequest(List.of(orderItem(productId, variantId, 1, List.of()))).getResponse().getStatus());
        JsonNode valid = createOrder(List.of(orderItem(productId, variantId, 1, List.of(optionId))));
        assertEquals("Acompanhamento", valid.path("items").get(0).path("options").get(0).path("groupName").asText());
        assertEquals("Tropeiro", valid.path("items").get(0).path("options").get(0).path("optionName").asText());

        JsonNode other = registerProduct(
                "Outro produto",
                "REQUIRES_PREPARATION",
                true,
                List.of(variant("Padrao", "10.00", true)),
                List.of(group("Molho", false, 0, 1, List.of(option("Picante", "0"))))
        );
        long foreignOptionId = other.path("optionGroups").get(0).path("options").get(0).path("id").asLong();
        assertEquals(400, createOrderRequest(List.of(orderItem(productId, variantId, 1, List.of(foreignOptionId)))).getResponse().getStatus());

        JsonNode limited = registerProduct(
                "Combo",
                "REQUIRES_PREPARATION",
                true,
                List.of(variant("Padrao", "15.00", true)),
                List.of(group("Escolhas", false, 2, 2, List.of(
                        option("A", "0"), option("B", "0"), option("C", "0")
                )))
        );
        JsonNode options = limited.path("optionGroups").get(0).path("options");
        long limitedProductId = limited.path("id").asLong();
        long limitedVariantId = limited.path("variants").get(0).path("id").asLong();
        assertEquals(400, createOrderRequest(List.of(orderItem(
                limitedProductId,
                limitedVariantId,
                1,
                List.of(options.get(0).path("id").asLong())
        ))).getResponse().getStatus());
        assertEquals(400, createOrderRequest(List.of(orderItem(
                limitedProductId,
                limitedVariantId,
                1,
                List.of(
                        options.get(0).path("id").asLong(),
                        options.get(1).path("id").asLong(),
                        options.get(2).path("id").asLong()
                )
        ))).getResponse().getStatus());
    }

    @Test
    void shouldKeepVariantPriceAndChoiceSnapshotsAfterCatalogChanges() throws Exception {
        JsonNode product = registerProduct(
                "Porcao",
                "REQUIRES_PREPARATION",
                true,
                List.of(variant("Grande", "30.00", true)),
                List.of(group("Molho", false, 0, 1, List.of(option("Especial", "3.00"))))
        );
        long productId = product.path("id").asLong();
        long variantId = product.path("variants").get(0).path("id").asLong();
        long optionId = product.path("optionGroups").get(0).path("options").get(0).path("id").asLong();
        JsonNode order = createOrder(List.of(orderItem(productId, variantId, 2, List.of(optionId))));
        long orderId = order.path("id").asLong();

        Map<String, Object> update = new LinkedHashMap<>();
        update.put("name", "Grande renomeada");
        update.put("sku", null);
        update.put("price", new BigDecimal("99.00"));
        update.put("active", true);
        update.put("available", true);
        update.put("displayOrder", 0);
        MvcResult updated = mockMvc.perform(put("/api/products/{productId}/variants/{variantId}", productId, variantId)
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andReturn();
        assertEquals(200, updated.getResponse().getStatus());

        JsonNode historical = getJson("/api/orders/" + orderId);
        JsonNode item = historical.path("items").get(0);
        assertEquals("Grande", item.path("variantNameSnapshot").asText());
        assertMoney("33.00", item.path("unitPriceSnapshot").decimalValue());
        assertMoney("66.00", item.path("subtotal").decimalValue());
        assertEquals("Especial", item.path("options").get(0).path("optionName").asText());
    }

    @Test
    void shouldConfirmDirectOrderOnlyOnceWithoutSendingItToPreparationQueue() throws Exception {
        JsonNode direct = registerProduct(
                "Cerveja pronta",
                "DIRECT_SERVICE",
                true,
                List.of(variant("Long neck", "9.00", true)),
                List.of()
        );
        JsonNode order = createOrder(List.of(orderItem(
                direct.path("id").asLong(),
                direct.path("variants").get(0).path("id").asLong(),
                2,
                List.of()
        )));
        long orderId = order.path("id").asLong();

        JsonNode confirmed = postWithoutBody("/api/orders/" + orderId + "/confirm");
        java.time.LocalDateTime firstConfirmation = jdbcTemplate.queryForObject(
                "select confirmed_at from orders where id = ?",
                java.time.LocalDateTime.class,
                orderId
        );
        JsonNode repeated = postWithoutBody("/api/orders/" + orderId + "/confirm");
        java.time.LocalDateTime repeatedConfirmation = jdbcTemplate.queryForObject(
                "select confirmed_at from orders where id = ?",
                java.time.LocalDateTime.class,
                orderId
        );
        assertEquals("READY", confirmed.path("status").asText());
        assertEquals("READY", confirmed.path("items").get(0).path("status").asText());
        assertNotNull(repeated.path("confirmedAt").asText());
        assertEquals(firstConfirmation, repeatedConfirmation);
        assertFalse(containsOrder(getJson("/api/orders/preparation-queue"), orderId));
    }

    @Test
    void shouldQueueOnlyPreparationItemsFromMixedOrdersAndRemoveCanceledItems() throws Exception {
        JsonNode prepared = registerProduct(
                "Espeto misto",
                "REQUIRES_PREPARATION",
                true,
                List.of(variant("Padrao", "12.00", true)),
                List.of()
        );
        JsonNode direct = registerProduct(
                "Refrigerante misto",
                "DIRECT_SERVICE",
                true,
                List.of(variant("Lata", "5.00", true)),
                List.of()
        );
        JsonNode order = createOrder(List.of(
                orderItem(prepared.path("id").asLong(), prepared.path("variants").get(0).path("id").asLong(), 1, List.of()),
                orderItem(direct.path("id").asLong(), direct.path("variants").get(0).path("id").asLong(), 1, List.of())
        ));
        long orderId = order.path("id").asLong();
        JsonNode confirmed = postWithoutBody("/api/orders/" + orderId + "/confirm");
        JsonNode preparationItem = findItemByFlow(confirmed, "REQUIRES_PREPARATION");
        JsonNode directItem = findItemByFlow(confirmed, "DIRECT_SERVICE");

        assertEquals("SENT_TO_KITCHEN", confirmed.path("status").asText());
        assertNotNull(preparationItem);
        assertNotNull(directItem);
        assertEquals("WAITING_PREPARATION", preparationItem.path("status").asText());
        assertEquals("READY", directItem.path("status").asText());
        JsonNode queue = getJson("/api/orders/preparation-queue");
        JsonNode queuedOrder = findOrder(queue, orderId);
        assertNotNull(queuedOrder);
        assertEquals(1, queuedOrder.path("items").size());
        assertEquals("REQUIRES_PREPARATION", queuedOrder.path("items").get(0).path("preparationFlow").asText());

        long preparationItemId = preparationItem.path("id").asLong();
        patchJson("/api/orders/%d/items/%d/status".formatted(orderId, preparationItemId), Map.of("status", "IN_PREPARATION"), 200);
        postJson("/api/orders/%d/items/%d/cancel".formatted(orderId, preparationItemId), Map.of("reason", "Cliente desistiu"), 200);
        assertFalse(containsOrder(getJson("/api/orders/preparation-queue"), orderId));
        assertEquals("CANCELED", findItemById(getJson("/api/orders/" + orderId), preparationItemId).path("status").asText());
    }

    @Test
    void shouldHaveAppliedTheVariantMigrationWithoutKeepingBaseProductPrice() {
        assertTrue(Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "select success from flyway_schema_history where version = '4'",
                Boolean.class
        )));
        assertEquals(1, jdbcTemplate.queryForObject(
                "select count(*) from information_schema.tables where table_name = 'product_variants'",
                Integer.class
        ));
        assertEquals(0, jdbcTemplate.queryForObject(
                "select count(*) from information_schema.columns where table_name = 'products' and column_name = 'price'",
                Integer.class
        ));
    }

    private JsonNode createBaseProduct(String name, String flow, boolean available) throws Exception {
        MvcResult result = postJson("/api/products", product(name, flow, available), 201);
        JsonNode json = responseJson(result);
        productIds.add(json.path("id").asLong());
        return json;
    }

    private JsonNode registerProduct(
            String name,
            String flow,
            boolean available,
            List<Map<String, Object>> variants,
            List<Map<String, Object>> groups
    ) throws Exception {
        MvcResult result = registerProductRequest(name, flow, available, variants, groups);
        assertEquals(201, result.getResponse().getStatus(), result.getResponse().getContentAsString());
        JsonNode json = responseJson(result);
        productIds.add(json.path("id").asLong());
        return json;
    }

    private MvcResult registerProductRequest(
            String name,
            String flow,
            boolean available,
            List<Map<String, Object>> variants,
            List<Map<String, Object>> groups
    ) throws Exception {
        return postJson("/api/products/registration", Map.of(
                "product", product(name, flow, available),
                "variants", variants,
                "optionGroups", groups
        ), null);
    }

    private Map<String, Object> product(String name, String flow, boolean available) {
        Map<String, Object> product = new LinkedHashMap<>();
        product.put("categoryId", categoryId);
        product.put("name", name + " " + suffix);
        product.put("description", "Produto de integracao");
        product.put("preparationFlow", flow);
        product.put("active", true);
        product.put("available", available);
        product.put("displayOrder", 0);
        product.put("imageUrl", null);
        return product;
    }

    private Map<String, Object> variant(String name, String price, boolean available) {
        Map<String, Object> variant = new LinkedHashMap<>();
        variant.put("name", name);
        variant.put("sku", null);
        variant.put("price", new BigDecimal(price));
        variant.put("active", true);
        variant.put("available", available);
        variant.put("displayOrder", 0);
        Map<String, Object> registration = new LinkedHashMap<>();
        registration.put("variant", variant);
        registration.put("stockItemId", null);
        registration.put("quantityPerSale", null);
        return registration;
    }

    private Map<String, Object> group(
            String name,
            boolean required,
            int minimum,
            int maximum,
            List<Map<String, Object>> options
    ) {
        Map<String, Object> group = new LinkedHashMap<>();
        group.put("name", name);
        group.put("required", required);
        group.put("minimumSelections", minimum);
        group.put("maximumSelections", maximum);
        group.put("displayOrder", 0);
        group.put("active", true);
        group.put("options", options);
        return group;
    }

    private Map<String, Object> option(String name, String additionalPrice) {
        return Map.of(
                "name", name,
                "additionalPrice", new BigDecimal(additionalPrice),
                "displayOrder", 0,
                "active", true
        );
    }

    private Map<String, Object> orderItem(Long productId, Long variantId, int quantity, List<Long> optionIds) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("productId", productId);
        item.put("variantId", variantId);
        item.put("quantity", quantity);
        item.put("notes", "Observacao preservada");
        item.put("optionIds", optionIds);
        return item;
    }

    private JsonNode createOrder(List<Map<String, Object>> items) throws Exception {
        MvcResult result = createOrderRequest(items);
        assertEquals(201, result.getResponse().getStatus(), result.getResponse().getContentAsString());
        JsonNode json = responseJson(result);
        orderIds.add(json.path("id").asLong());
        return json;
    }

    private MvcResult createOrderRequest(List<Map<String, Object>> items) throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("tabId", tabId);
        request.put("createdByUserId", Long.MAX_VALUE);
        request.put("type", "TABLE");
        request.put("notes", "Pedido de integracao");
        request.put("items", items);
        return postJson("/api/orders", request, null);
    }

    private JsonNode postWithoutBody(String path) throws Exception {
        MvcResult result = mockMvc.perform(post(path).header("Authorization", bearer())).andReturn();
        assertEquals(200, result.getResponse().getStatus(), result.getResponse().getContentAsString());
        return responseJson(result);
    }

    private MvcResult postJson(String path, Object body, Integer expectedStatus) throws Exception {
        MvcResult result = mockMvc.perform(post(path)
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();
        if (expectedStatus != null) {
            assertEquals(expectedStatus, result.getResponse().getStatus(), result.getResponse().getContentAsString());
        }
        return result;
    }

    private void patchJson(String path, Object body, int expectedStatus) throws Exception {
        MvcResult result = mockMvc.perform(patch(path)
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();
        assertEquals(expectedStatus, result.getResponse().getStatus(), result.getResponse().getContentAsString());
    }

    private void patchOk(String path) throws Exception {
        MvcResult result = mockMvc.perform(patch(path).header("Authorization", bearer())).andReturn();
        assertEquals(200, result.getResponse().getStatus(), result.getResponse().getContentAsString());
    }

    private JsonNode getJson(String path) throws Exception {
        MvcResult result = mockMvc.perform(get(path).header("Authorization", bearer())).andReturn();
        assertEquals(200, result.getResponse().getStatus(), result.getResponse().getContentAsString());
        return responseJson(result);
    }

    private JsonNode responseJson(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private boolean containsOrder(JsonNode orders, long orderId) {
        return findOrder(orders, orderId) != null;
    }

    private JsonNode findOrder(JsonNode orders, long orderId) {
        for (JsonNode order : orders) {
            if (order.path("id").asLong() == orderId) return order;
        }
        return null;
    }

    private JsonNode findItemByFlow(JsonNode order, String flow) {
        for (JsonNode item : order.path("items")) {
            if (flow.equals(item.path("preparationFlow").asText())) return item;
        }
        return null;
    }

    private JsonNode findItemById(JsonNode order, long itemId) {
        for (JsonNode item : order.path("items")) {
            if (item.path("id").asLong() == itemId) return item;
        }
        return null;
    }

    private void seedRole(String name, String description) {
        jdbcTemplate.update(
                """
                insert into roles (name, description)
                values (?, ?)
                on conflict (name) do update set description = excluded.description
                """,
                name,
                description
        );
    }

    private String insertOwner() {
        String email = "owner-" + suffix + "@catalog.hubon.test";
        Long userId = jdbcTemplate.queryForObject(
                """
                insert into users (name, email, password, active)
                values ('Owner Catalogo', ?, ?, true)
                returning id
                """,
                Long.class,
                email,
                passwordEncoder.encode(PASSWORD)
        );
        Long roleId = jdbcTemplate.queryForObject("select id from roles where name = 'OWNER'", Long.class);
        jdbcTemplate.update("insert into user_roles (user_id, role_id) values (?, ?)", userId, roleId);
        return email;
    }

    private String tokenFor(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", PASSWORD
                        ))))
                .andReturn();
        assertEquals(200, result.getResponse().getStatus());
        return responseJson(result).path("token").asText();
    }

    private String bearer() {
        return "Bearer " + token;
    }

    private void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual));
    }
}
