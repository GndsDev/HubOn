package com.hubon.backend;

import com.hubon.backend.auth.service.AuthenticatedUser;
import com.hubon.backend.sale.domain.SaleType;
import com.hubon.backend.sale.dto.AddSaleItemRequest;
import com.hubon.backend.sale.dto.OpenSaleRequest;
import com.hubon.backend.sale.dto.SaleItemResponse;
import com.hubon.backend.sale.dto.SaleResponse;
import com.hubon.backend.sale.service.SaleService;
import com.hubon.backend.shared.config.DataSeeder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "hubon.security.permit-all=false", "hubon.seed.enabled=true",
        "hubon.seed.owner.name=Seed Owner", "hubon.seed.owner.username=Seed-Owner",
        "hubon.seed.owner.password=configured-owner-pass-123", "hubon.seed.admin.enabled=true",
        "hubon.seed.admin.name=Seed Admin", "hubon.seed.admin.username=Seed-Admin",
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
    @Autowired UserDetailsService userDetailsService;
    @Autowired SaleService saleService;

    @BeforeEach
    void authenticateSeedOwner() {
        AuthenticatedUser principal = (AuthenticatedUser) userDetailsService.loadUserByUsername("seed-owner");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @AfterAll
    void cleanup() {
        jdbc.execute("""
                truncate table expenses, stock_movements, payments, cash_movements, sale_item_options,
                sale_items, sales, product_option_stock_links, product_stock_links, stock_items, product_options,
                product_option_groups, products, categories, cash_shifts,
                user_roles, users restart identity cascade
                """);
    }

    @Test
    void createsConfiguredUsersCatalogAndInitialStockIdempotently() throws Exception {
        String hash = jdbc.queryForObject("select password from users where username = 'seed-owner'", String.class);
        assertThat(passwordEncoder.matches("configured-owner-pass-123", hash)).isTrue();
        assertThat(jdbc.queryForList("select username from users order by username", String.class))
                .containsExactly("seed-admin", "seed-owner");
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("""
                {"username":"SEED-OWNER","password":"configured-owner-pass-123"}
                """)).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").value("seed-owner"))
                .andExpect(jsonPath("$.user.roles[0]").value("OWNER"));

        assertPrice("Jantinha Completa", "34.90");
        assertPrice("Jantinha Sem Espeto", "22.00");
        assertPrice("Carreteiro Completo", "34.90");
        assertPrice("Choripan", "25.00");
        assertPrice("Batata frita 500 gramas", "25.00");
        assertPrice("Frango a passarinho", "35.00");

        List<String> skewers = List.of(
                "Picanha Montada", "Carne de Sol", "Contra Filé", "Cupim", "Kafta",
                "Kafta com Mussarela", "Medalhão de Carne", "Suína Gourmet", "Meio Asa",
                "Pão de Alho", "Panceta Suína", "Alcatra Magra", "Coração",
                "Linguiça com Pimenta", "Linguiça Toscana", "Medalhão de Frango",
                "Peito de Frango", "Queijo Coalho", "Queijo Provolone"
        );
        assertThat(jdbc.queryForList("""
                select product.name from products product
                join categories category on category.id = product.category_id
                where category.name = 'Espetinhos' and product.active = true
                order by product.display_order
                """, String.class)).containsExactlyElementsOf(skewers);
        skewers.forEach(name -> assertPrice(name, "12.90"));

        Map<String, String> beveragePrices = Map.of(
                "Long Neck", "10.00",
                "Cerveja Lata", "7.00",
                "Água com Gás", "5.00",
                "Água Natural", "4.00",
                "Refri 600ml", "10.00",
                "Refri Lata", "7.00",
                "Suco Lata", "7.00",
                "Suco Laranja 300ml", "7.00",
                "Red Bull", "15.00"
        );
        beveragePrices.forEach(this::assertPrice);

        Map<String, Object> stock = jdbc.queryForMap("""
                select current_stock, minimum_stock from stock_items where name = 'Jantinha Completa'
                """);
        assertThat(stock.get("current_stock")).isEqualTo(new BigDecimal("20.000"));
        assertThat(stock.get("minimum_stock")).isEqualTo(new BigDecimal("5.000"));
        assertThat(count("categories")).isEqualTo(7);
        assertThat(count("products")).isEqualTo(59);
        assertThat(count("stock_items")).isEqualTo(59);
        assertThat(count("product_stock_links")).isEqualTo(43);
        assertThat(count("product_option_groups")).isEqualTo(11);
        assertThat(count("product_options")).isEqualTo(73);
        assertThat(count("product_option_stock_links")).isEqualTo(57);
        assertThat(count("stock_movements")).isEqualTo(59);

        assertThat(jdbc.queryForList("""
                select product.name from products product
                join categories category on category.id = product.category_id
                where category.name = 'Petiscos' order by product.display_order
                """, String.class)).containsExactly("Batata frita 500 gramas", "Frango a passarinho");
        assertThat(jdbc.queryForObject("""
                select count(*) from products
                where active = true and lower(name) like 'suco natural%'
                """, Integer.class)).isZero();

        List<String> portions = List.of(
                "Arroz Branco", "Arroz com Carne", "Feijão Tropeiro", "Mandioca", "Vinagrete");
        for (String portion : portions) {
            assertPrice(portion, "10.00");
            assertChoicePrice(portion, "Tamanho", "Média", "0.00");
            assertChoicePrice(portion, "Tamanho", "Grande", "8.00");
        }

        assertChoices("Jantinha Completa", "Escolha o feijão", List.of("Tropeiro", "De caldo"));
        assertChoices("Jantinha Completa", "Escolha o espeto", skewers);
        assertChoices("Carreteiro Completo", "Escolha o feijão", List.of("Tropeiro", "De caldo"));
        assertChoices("Carreteiro Completo", "Escolha o espeto", skewers);
        assertChoices("Jantinha Sem Espeto", "Escolha o feijão", List.of("Tropeiro", "De caldo"));
        assertThat(activeGroupCount("Jantinha Sem Espeto", "Escolha o espeto")).isZero();
        assertChoices("Choripan", "Escolha o espeto", skewers);
        assertThat(activeOptionCount("Jantinha Completa", "Escolha o feijão", "Nenhum")).isZero();

        Long directSkewerStockItem = jdbc.queryForObject("""
                select link.stock_item_id from product_stock_links link
                join products product on product.id = link.product_id
                where product.name = 'Picanha Montada' and link.active = true
                """, Long.class);
        Long selectedSkewerStockItem = jdbc.queryForObject("""
                select link.stock_item_id from product_option_stock_links link
                join product_options choice on choice.id = link.product_option_id
                join product_option_groups question on question.id = choice.option_group_id
                join products product on product.id = question.product_id
                where product.name = 'Jantinha Completa' and choice.name = 'Picanha Montada' and link.active = true
                """, Long.class);
        assertThat(selectedSkewerStockItem).isEqualTo(directSkewerStockItem);
        assertThat(jdbc.queryForObject("""
                select count(*) from product_option_stock_links link
                join product_options choice on choice.id = link.product_option_id
                join product_option_groups question on question.id = choice.option_group_id
                where question.name in ('Escolha o feijão', 'Tamanho') and link.active = true
                """, Integer.class)).isZero();
        assertThat(jdbc.queryForObject("""
                select count(*) from product_stock_links link
                join products product on product.id = link.product_id
                where product.name in ('Jantinha Completa', 'Jantinha Sem Espeto', 'Carreteiro Completo',
                                       'Choripan', 'Arroz Branco', 'Caipirinha')
                  and link.active = true
                """, Integer.class)).isZero();
        Map<String, Integer> before = counts();
        dataSeeder.run();
        dataSeeder.run();
        assertThat(counts()).isEqualTo(before);

        authenticateSeedOwner();
        assertSeededSalesAndStock();
    }

    private void assertSeededSalesAndStock() {
        BigDecimal picanhaBefore = stock("Picanha Montada");
        SaleResponse jantinha = add(counter(), "Jantinha Completa", 1, "Tropeiro", "Picanha Montada");
        assertThat(item(jantinha, "Jantinha Completa").unitPrice()).isEqualByComparingTo("34.90");
        assertThat(jantinha.finalAmount()).isEqualByComparingTo("34.90");
        assertThat(stock("Picanha Montada")).isEqualByComparingTo(picanhaBefore.subtract(BigDecimal.ONE));

        BigDecimal heartBefore = stock("Coração");
        SaleResponse carreteiro = add(counter(), "Carreteiro Completo", 1, "De caldo", "Coração");
        assertThat(carreteiro.finalAmount()).isEqualByComparingTo("34.90");
        assertThat(stock("Coração")).isEqualByComparingTo(heartBefore.subtract(BigDecimal.ONE));

        BigDecimal picanhaBeforeNoSkewer = stock("Picanha Montada");
        SaleResponse withoutSkewer = add(counter(), "Jantinha Sem Espeto", 1, "Tropeiro");
        SaleItemResponse withoutSkewerItem = item(withoutSkewer, "Jantinha Sem Espeto");
        assertThat(withoutSkewer.finalAmount()).isEqualByComparingTo("22.00");
        assertThat(withoutSkewerItem.options()).singleElement()
                .satisfies(option -> assertThat(option.optionName()).isEqualTo("Tropeiro"));
        assertThat(stock("Picanha Montada")).isEqualByComparingTo(picanhaBeforeNoSkewer);
        assertThat(movementCount(withoutSkewerItem.id())).isZero();

        for (String portion : List.of(
                "Arroz Branco", "Arroz com Carne", "Feijão Tropeiro", "Mandioca", "Vinagrete")) {
            assertThat(add(counter(), portion, 1, "Média").finalAmount()).isEqualByComparingTo("10.00");
            assertThat(add(counter(), portion, 1, "Grande").finalAmount()).isEqualByComparingTo("18.00");
        }

        BigDecimal directBefore = stock("Picanha Montada");
        SaleResponse directSkewer = add(counter(), "Picanha Montada", 2);
        assertThat(directSkewer.finalAmount()).isEqualByComparingTo("25.80");
        assertThat(stock("Picanha Montada")).isEqualByComparingTo(directBefore.subtract(new BigDecimal("2.000")));

        SaleResponse beverages = counter();
        beverages = add(beverages, "Refri Lata", 2);
        beverages = add(beverages, "Red Bull", 1);
        beverages = add(beverages, "Água Natural", 3);
        assertThat(beverages.finalAmount()).isEqualByComparingTo("41.00");

        BigDecimal combinedPicanhaBefore = stock("Picanha Montada");
        SaleResponse combined = counter();
        combined = add(combined, "Jantinha Completa", 1, "Tropeiro", "Picanha Montada");
        combined = add(combined, "Cerveja Lata", 1);
        combined = add(combined, "Água com Gás", 1);
        combined = add(combined, "Picanha Montada", 2);
        assertThat(combined.finalAmount()).isEqualByComparingTo("72.70");
        assertThat(stock("Picanha Montada"))
                .isEqualByComparingTo(combinedPicanhaBefore.subtract(new BigDecimal("3.000")));
    }

    private SaleResponse counter() {
        return saleService.open(new OpenSaleRequest(SaleType.COUNTER, null, null, null,
                BigDecimal.ZERO, BigDecimal.ZERO));
    }

    private SaleResponse add(SaleResponse sale, String productName, int quantity, String... optionNames) {
        Long productId = jdbc.queryForObject(
                "select id from products where name = ? and active = true", Long.class, productName);
        List<Long> optionIds = Arrays.stream(optionNames)
                .map(optionName -> jdbc.queryForObject("""
                        select choice.id from product_options choice
                        join product_option_groups question on question.id = choice.option_group_id
                        where question.product_id = ? and choice.name = ?
                          and question.active = true and choice.active = true
                        """, Long.class, productId, optionName))
                .toList();
        return saleService.addItem(sale.id(), new AddSaleItemRequest(productId, quantity, null, optionIds));
    }

    private SaleItemResponse item(SaleResponse sale, String productName) {
        return sale.items().stream()
                .filter(value -> value.productName().equals(productName))
                .findFirst()
                .orElseThrow();
    }

    private BigDecimal stock(String name) {
        return jdbc.queryForObject("select current_stock from stock_items where name = ?", BigDecimal.class, name);
    }

    private int movementCount(Long saleItemId) {
        return jdbc.queryForObject(
                "select count(*) from stock_movements where sale_item_id = ?", Integer.class, saleItemId);
    }

    private void assertPrice(String productName, String expectedPrice) {
        assertThat(jdbc.queryForObject(
                "select price from products where name = ? and active = true", BigDecimal.class, productName))
                .isEqualByComparingTo(expectedPrice);
    }

    private void assertChoicePrice(String productName, String groupName, String optionName, String expectedPrice) {
        assertThat(jdbc.queryForObject("""
                select choice.additional_price from product_options choice
                join product_option_groups question on question.id = choice.option_group_id
                join products product on product.id = question.product_id
                where product.name = ? and question.name = ? and choice.name = ?
                  and question.active = true and choice.active = true
                """, BigDecimal.class, productName, groupName, optionName))
                .isEqualByComparingTo(expectedPrice);
    }

    private void assertChoices(String productName, String groupName, List<String> expectedChoices) {
        assertThat(jdbc.queryForList("""
                select choice.name from product_options choice
                join product_option_groups question on question.id = choice.option_group_id
                join products product on product.id = question.product_id
                where product.name = ? and question.name = ?
                  and question.active = true and choice.active = true
                order by choice.display_order
                """, String.class, productName, groupName)).containsExactlyElementsOf(expectedChoices);
    }

    private int activeGroupCount(String productName, String groupName) {
        return jdbc.queryForObject("""
                select count(*) from product_option_groups question
                join products product on product.id = question.product_id
                where product.name = ? and question.name = ? and question.active = true
                """, Integer.class, productName, groupName);
    }

    private int activeOptionCount(String productName, String groupName, String optionName) {
        return jdbc.queryForObject("""
                select count(*) from product_options choice
                join product_option_groups question on question.id = choice.option_group_id
                join products product on product.id = question.product_id
                where product.name = ? and question.name = ? and choice.name = ? and choice.active = true
                """, Integer.class, productName, groupName, optionName);
    }

    private Map<String, Integer> counts() {
        return Map.of(
                "categories", count("categories"),
                "products", count("products"),
                "stockItems", count("stock_items"),
                "stockLinks", count("product_stock_links"),
                "optionGroups", count("product_option_groups"),
                "options", count("product_options"),
                "optionStockLinks", count("product_option_stock_links"),
                "stockMovements", count("stock_movements"),
                "users", count("users")
        );
    }

    private int count(String table) { return jdbc.queryForObject("select count(*) from " + table, Integer.class); }
}
