package com.hubon.backend.shared.config;

import com.hubon.backend.category.domain.Category;
import com.hubon.backend.category.repository.CategoryRepository;
import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.domain.ProductOption;
import com.hubon.backend.product.domain.ProductOptionGroup;
import com.hubon.backend.product.repository.ProductOptionGroupRepository;
import com.hubon.backend.product.repository.ProductOptionRepository;
import com.hubon.backend.product.repository.ProductRepository;
import com.hubon.backend.stock.domain.ProductOptionStockLink;
import com.hubon.backend.stock.domain.ProductStockLink;
import com.hubon.backend.stock.domain.StockItem;
import com.hubon.backend.stock.domain.StockMovement;
import com.hubon.backend.stock.domain.StockMovementType;
import com.hubon.backend.stock.domain.UnitOfMeasure;
import com.hubon.backend.stock.repository.ProductOptionStockLinkRepository;
import com.hubon.backend.stock.repository.ProductStockLinkRepository;
import com.hubon.backend.stock.repository.StockItemRepository;
import com.hubon.backend.stock.repository.StockMovementRepository;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Component
@RequiredArgsConstructor
public class InitialCatalogSeeder {

    private static final BigDecimal ONE = BigDecimal.ONE;
    private static final List<String> SKEWERS = List.of(
            "Picanha Montada",
            "Carne de Sol",
            "Contra Filé",
            "Cupim",
            "Kafta",
            "Kafta com Mussarela",
            "Medalhão de Carne",
            "Suína Gourmet",
            "Meio Asa",
            "Pão de Alho",
            "Panceta Suína",
            "Alcatra Magra",
            "Coração",
            "Linguiça com Pimenta",
            "Linguiça Toscana",
            "Medalhão de Frango",
            "Peito de Frango",
            "Queijo Coalho",
            "Queijo Provolone"
    );
    private static final List<String> SEPARATED_PORTIONS = List.of(
            "Arroz branco (grande)",
            "Arroz branco (média)",
            "Arroz com carne (grande)",
            "Arroz com carne (média)",
            "Feijão tropeiro (grande)",
            "Feijão tropeiro (média)",
            "Mandioca (grande)",
            "Mandioca (média)",
            "Vinagrete (grande)",
            "Vinagrete (média)"
    );

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final ProductOptionGroupRepository optionGroupRepository;
    private final ProductOptionRepository optionRepository;
    private final StockItemRepository stockItemRepository;
    private final ProductStockLinkRepository productStockLinkRepository;
    private final ProductOptionStockLinkRepository optionStockLinkRepository;
    private final StockMovementRepository stockMovementRepository;
    private final UserRepository userRepository;

    @Transactional
    public void seed(User owner) {
        User seedOwner = userRepository.getReferenceById(owner.getId());
        migratePreviousDemoCatalog();
        migrateSeparatedPortions();
        migrateCurrentMenuCategoryOrder();
        migrateCurrentMenuCatalog();
        migrateCurrentMenuChoices();

        Map<String, Category> categories = new HashMap<>();
        categoryRepository.findAll().forEach(category -> categories.put(key(category.getName()), category));

        Map<String, List<Product>> products = new HashMap<>();
        productRepository.findAll().forEach(product -> products
                .computeIfAbsent(key(product.getName()), ignored -> new ArrayList<>())
                .add(product));

        Map<String, StockItem> stockItems = new HashMap<>();
        stockItemRepository.findAll().forEach(item -> stockItems.put(key(item.getName()), item));

        Map<String, ProductOptionGroup> groups = new HashMap<>();
        optionGroupRepository.findAll().forEach(group -> groups.put(groupKey(group.getProduct(), group.getName()), group));

        Map<String, ProductOption> options = new HashMap<>();
        optionRepository.findAll().forEach(option -> options.put(optionKey(option.getGroup(), option.getName()), option));

        List<SeededProduct> seededProducts = new ArrayList<>();
        int categoryOrder = 0;
        for (CategorySeed categorySeed : catalog()) {
            Category category = ensureCategory(categories, categorySeed, categoryOrder++);
            int productOrder = 0;
            for (ProductSeed productSeed : categorySeed.products()) {
                Product product = ensureProduct(products, category, productSeed, productOrder++);
                StockItem stockItem = ensureStockItem(stockItems, productSeed, seedOwner);
                configureProductStockLink(product, stockItem, productSeed.automaticStock());
                seededProducts.add(new SeededProduct(product, productSeed));
            }
        }
        seededProducts.forEach(entry -> ensureChoices(
                entry.product(), entry.seed(), groups, options, stockItems));
    }

    private Category ensureCategory(Map<String, Category> categories, CategorySeed seed, int displayOrder) {
        Category category = categories.get(key(seed.name()));
        if (category != null) return category;
        category = categoryRepository.save(Category.builder()
                .name(seed.name())
                .displayOrder(displayOrder)
                .active(true)
                .build());
        categories.put(key(seed.name()), category);
        return category;
    }

    private Product ensureProduct(
            Map<String, List<Product>> products,
            Category category,
            ProductSeed seed,
            int displayOrder
    ) {
        Product product = findProduct(products, category, seed.name());
        if (product != null) return product;
        product = productRepository.save(Product.builder()
                .category(category)
                .name(seed.name())
                .description(seed.description())
                .price(money(seed.price()))
                .active(true)
                .available(true)
                .displayOrder(displayOrder)
                .build());
        products.computeIfAbsent(key(product.getName()), ignored -> new ArrayList<>()).add(product);
        return product;
    }

    private StockItem ensureStockItem(Map<String, StockItem> stockItems, ProductSeed seed, User owner) {
        StockItem stockItem = stockItems.get(key(seed.name()));
        if (stockItem != null) return stockItem;
        stockItem = stockItemRepository.save(StockItem.builder()
                .name(seed.name())
                .description("Controle unitário do produto " + seed.name())
                .unit(UnitOfMeasure.UN)
                .currentStock(quantity(seed.initialStock()))
                .minimumStock(quantity(seed.minimumStock()))
                .active(true)
                .build());
        stockItems.put(key(stockItem.getName()), stockItem);
        createInitialMovement(stockItem, owner, seed.initialStock());
        return stockItem;
    }

    private void configureProductStockLink(Product product, StockItem stockItem, boolean automatic) {
        ProductStockLink link = productStockLinkRepository.findByProductIdAndActiveTrue(product.getId()).orElse(null);
        if (!automatic) {
            if (link != null) link.setActive(false);
            return;
        }
        if (link == null) {
            productStockLinkRepository.save(ProductStockLink.builder()
                    .product(product)
                    .stockItem(stockItem)
                    .quantityPerSale(ONE)
                    .active(true)
                    .build());
            return;
        }
        link.setStockItem(stockItem);
        link.setQuantityPerSale(ONE);
    }

    private void ensureChoices(
            Product product,
            ProductSeed productSeed,
            Map<String, ProductOptionGroup> groups,
            Map<String, ProductOption> options,
            Map<String, StockItem> stockItems
    ) {
        int groupOrder = 0;
        for (ChoiceGroupSeed groupSeed : productSeed.choiceGroups()) {
            String groupKey = groupKey(product, groupSeed.name());
            ProductOptionGroup group = groups.get(groupKey);
            if (group == null) {
                group = optionGroupRepository.save(ProductOptionGroup.builder()
                        .product(product)
                        .name(groupSeed.name())
                        .minimumSelections(groupSeed.minimumSelections())
                        .maximumSelections(groupSeed.maximumSelections())
                        .displayOrder(groupOrder)
                        .active(true)
                        .build());
                groups.put(groupKey, group);
            } else {
                group.setMinimumSelections(groupSeed.minimumSelections());
                group.setMaximumSelections(groupSeed.maximumSelections());
            }

            int optionOrder = 0;
            for (ChoiceSeed choiceSeed : groupSeed.choices()) {
                String optionKey = optionKey(group, choiceSeed.name());
                ProductOption option = options.get(optionKey);
                if (option == null) {
                    option = optionRepository.save(ProductOption.builder()
                            .group(group)
                            .name(choiceSeed.name())
                            .additionalPrice(money(choiceSeed.additionalPrice()))
                            .displayOrder(optionOrder)
                            .active(true)
                            .build());
                    options.put(optionKey, option);
                } else {
                    option.setAdditionalPrice(money(choiceSeed.additionalPrice()));
                }
                configureOptionStockLink(option, choiceSeed, stockItems);
                optionOrder++;
            }
            groupOrder++;
        }
    }

    private void configureOptionStockLink(
            ProductOption option,
            ChoiceSeed choiceSeed,
            Map<String, StockItem> stockItems
    ) {
        ProductOptionStockLink link = optionStockLinkRepository
                .findByProductOptionIdAndActiveTrue(option.getId())
                .orElse(null);
        if (choiceSeed.stockItemName() == null) {
            if (link != null) link.setActive(false);
            return;
        }

        StockItem stockItem = stockItems.get(key(choiceSeed.stockItemName()));
        if (stockItem == null) {
            throw new IllegalStateException("Item de estoque do cardápio não encontrado: " + choiceSeed.stockItemName());
        }
        if (link == null) {
            optionStockLinkRepository.save(ProductOptionStockLink.builder()
                    .productOption(option)
                    .stockItem(stockItem)
                    .quantityPerSelection(ONE)
                    .active(true)
                    .build());
            return;
        }
        link.setStockItem(stockItem);
        link.setQuantityPerSelection(ONE);
    }

    private Product findProduct(Map<String, List<Product>> products, Category category, String name) {
        return products.getOrDefault(key(name), List.of()).stream()
                .filter(product -> product.getCategory() != null && product.getCategory().getId().equals(category.getId()))
                .findFirst()
                .orElse(null);
    }

    private void createInitialMovement(StockItem stockItem, User owner, int initialStock) {
        stockMovementRepository.save(StockMovement.builder()
                .stockItem(stockItem)
                .type(StockMovementType.ENTRY)
                .deltaQuantity(quantity(initialStock))
                .previousBalance(BigDecimal.ZERO)
                .resultingBalance(quantity(initialStock))
                .reason("Estoque inicial do cardápio")
                .createdByUser(owner)
                .build());
    }

    private void migratePreviousDemoCatalog() {
        productRepository.findAll().forEach(product -> {
            if (matches(product, "Refrigerante lata", "Lata 350ml", "7.50")) {
                product.setPrice(money("5.00"));
            } else if (matches(product, "Suco natural", "Suco natural da casa", "9.90")
                    || matches(product, "Executivo da casa", "Prato executivo com acompanhamento", "32.90")) {
                deactivateSeedProduct(product);
            }
        });
    }

    private void migrateSeparatedPortions() {
        productRepository.findAll().stream()
                .filter(product -> product.getCategory() != null)
                .filter(product -> "Porções".equalsIgnoreCase(product.getCategory().getName()))
                .filter(product -> SEPARATED_PORTIONS.stream().anyMatch(name -> name.equalsIgnoreCase(product.getName())))
                .filter(product -> product.getDescription() == null)
                .filter(product -> product.getPrice().compareTo(money(product.getName().contains("(grande)") ? "18.00" : "10.00")) == 0)
                .forEach(this::deactivateSeedProduct);

        stockItemRepository.findAll().stream()
                .filter(item -> SEPARATED_PORTIONS.stream().anyMatch(name -> name.equalsIgnoreCase(item.getName())))
                .filter(item -> ("Controle unitário do produto " + item.getName()).equals(item.getDescription()))
                .forEach(item -> item.setActive(false));
    }

    private void migrateCurrentMenuCatalog() {
        List<Product> products = productRepository.findAll();
        List<StockItem> stockItems = stockItemRepository.findAll();
        for (ProductMigration migration : currentMenuMigrations()) {
            products.stream()
                    .filter(product -> hasCategory(product, migration.currentCategory()))
                    .filter(product -> product.getName().equalsIgnoreCase(migration.currentName()))
                    .filter(product -> Objects.equals(product.getDescription(), migration.currentDescription()))
                    .filter(product -> product.getPrice().compareTo(money(migration.currentPrice())) == 0)
                    .forEach(product -> {
                        product.setCategory(category(migration.targetCategory()));
                        product.setName(migration.targetName());
                        product.setDescription(migration.targetDescription());
                        product.setPrice(money(migration.targetPrice()));
                    });

            stockItems.stream()
                    .filter(item -> item.getName().equalsIgnoreCase(migration.currentName()))
                    .filter(item -> ("Controle unitário do produto " + migration.currentName())
                            .equalsIgnoreCase(item.getDescription()))
                    .forEach(item -> {
                        item.setName(migration.targetName());
                        item.setDescription("Controle unitário do produto " + migration.targetName());
                    });
        }
    }

    private void migrateCurrentMenuCategoryOrder() {
        Map<String, Integer> previousOrders = Map.of(
                key("Porções"), 1,
                key("Espetinhos"), 2,
                key("Bebidas"), 3,
                key("Drinks"), 4,
                key("Caldos"), 5
        );
        categoryRepository.findAll().forEach(category -> {
            Integer previousOrder = previousOrders.get(key(category.getName()));
            if (previousOrder != null && category.getDisplayOrder().equals(previousOrder)) {
                category.setDisplayOrder(previousOrder + 1);
            }
        });
    }

    private void migrateCurrentMenuChoices() {
        Map<String, String> skewerNames = new HashMap<>();
        SKEWERS.forEach(name -> skewerNames.put(key(name), name));

        optionRepository.findAll().forEach(option -> {
            ProductOptionGroup group = option.getGroup();
            Product product = group.getProduct();
            if (!hasCategory(product, "Pratos")) return;

            if ("Escolha o feijão".equalsIgnoreCase(group.getName())) {
                if ("Feijão tropeiro".equalsIgnoreCase(option.getName())) {
                    option.setName("Tropeiro");
                } else if ("Feijão de caldo".equalsIgnoreCase(option.getName())) {
                    option.setName("De caldo");
                } else if ("Jantinha Completa".equalsIgnoreCase(product.getName())
                        && "Nenhum".equalsIgnoreCase(option.getName())) {
                    option.setActive(false);
                    optionStockLinkRepository.findByProductOptionIdAndActiveTrue(option.getId())
                            .ifPresent(link -> link.setActive(false));
                }
                return;
            }

            if ("Escolha o espeto".equalsIgnoreCase(group.getName())) {
                String normalizedName = skewerNames.get(key(option.getName()));
                if (normalizedName != null) option.setName(normalizedName);
            }
        });
    }

    private Category category(String name) {
        return categoryRepository.findAll().stream()
                .filter(category -> category.getName().equalsIgnoreCase(name))
                .findFirst()
                .orElseGet(() -> categoryRepository.save(Category.builder()
                        .name(name)
                        .displayOrder("Petiscos".equalsIgnoreCase(name)
                                ? 1
                                : categoryRepository.findAll().size())
                        .active(true)
                        .build()));
    }

    private boolean hasCategory(Product product, String categoryName) {
        return product.getCategory() != null
                && product.getCategory().getName().equalsIgnoreCase(categoryName);
    }

    private void deactivateSeedProduct(Product product) {
        product.setActive(false);
        product.setAvailable(false);
        productStockLinkRepository.findByProductIdAndActiveTrue(product.getId())
                .ifPresent(link -> link.setActive(false));
    }

    private boolean matches(Product product, String name, String description, String price) {
        return product.getName().equalsIgnoreCase(name)
                && description.equals(product.getDescription())
                && product.getPrice().compareTo(money(price)) == 0;
    }

    private static List<CategorySeed> catalog() {
        return List.of(
                category("Pratos",
                        item("Jantinha Completa", "Arroz branco, feijão tropeiro ou de caldo, mandioca, vinagrete e 1 espeto", "34.90", 20, 5, false,
                                beanChoice(), skewerChoice()),
                        item("Carreteiro Completo", "Arroz carreteiro, feijão tropeiro ou de caldo, mandioca, vinagrete e 1 espeto", "34.90", 20, 5, false,
                                beanChoice(), skewerChoice()),
                        item("Jantinha Sem Espeto", "Arroz branco, feijão tropeiro ou de caldo, mandioca e vinagrete", "22.00", 20, 5, false,
                                beanChoice()),
                        item("Choripan", "1 espeto de preferência, molho da casa, tomate, cebola e mussarela", "25.00", 15, 5, false,
                                skewerChoice())),
                category("Petiscos",
                        item("Batata frita 500 gramas", null, "25.00", 15, 5, false),
                        item("Frango a passarinho", null, "35.00", 15, 5, false)),
                category("Porções",
                        sizedPortion("Arroz Branco"),
                        sizedPortion("Arroz com Carne"),
                        sizedPortion("Feijão Tropeiro"),
                        sizedPortion("Mandioca"),
                        sizedPortion("Vinagrete")),
                category("Espetinhos", SKEWERS.stream()
                        .map(name -> item(name, null, "12.90", 25, 5, true))
                        .toArray(ProductSeed[]::new)),
                category("Bebidas",
                        item("Antarctica 600ml", null, "12.00", 24, 8, true),
                        item("Amstel 600ml", null, "12.00", 24, 8, true),
                        item("Brahma Chopp 600ml", null, "12.00", 24, 8, true),
                        item("Original 600ml", null, "12.00", 24, 8, true),
                        item("Budweiser long neck", null, "10.00", 24, 8, true),
                        item("Amstel long neck", null, "10.00", 24, 8, true),
                        item("Corona long neck", null, "10.00", 24, 8, true),
                        item("Heineken long neck", null, "10.00", 24, 8, true),
                        item("Long Neck", null, "10.00", 24, 8, true),
                        item("Cerveja Lata", null, "7.00", 24, 8, true),
                        item("Água com Gás", null, "5.00", 24, 8, true),
                        item("Água Natural", null, "4.00", 30, 8, true),
                        item("Água de coco", null, "5.00", 18, 5, true),
                        item("Coca-Cola KS", null, "5.00", 24, 8, true),
                        item("Refrigerante 2L", null, "12.00", 12, 3, true),
                        item("ICE", null, "10.00", 24, 5, true),
                        item("H2O", null, "8.00", 24, 8, true),
                        item("Refri 600ml", null, "10.00", 24, 8, true),
                        item("Refri Lata", null, "7.00", 24, 8, true),
                        item("Suco Lata", null, "7.00", 24, 5, true),
                        item("Suco Laranja 300ml", null, "7.00", 18, 5, true),
                        item("Monster latão", null, "13.00", 12, 3, true),
                        item("Red Bull", null, "15.00", 12, 3, true),
                        item("Schweppes lata", null, "5.00", 24, 5, true)),
                category("Drinks",
                        item("Caipirinha", null, "15.00", 20, 5, false),
                        item("Caipifruta", null, "20.00", 20, 5, false),
                        item("Caipivodka", null, "20.00", 20, 5, false),
                        item("Cozumel", null, "15.00", 20, 5, false)),
                category("Caldos",
                        item("Caldo do dia", "Consultar sabores", "20.00", 10, 3, false))
        );
    }

    private static ProductSeed sizedPortion(String name) {
        return item(name, null, "10.00", 15, 5, false,
                choiceGroup("Tamanho", 1, 1,
                        choice("Média", "0.00", null),
                        choice("Grande", "8.00", null)));
    }

    private static ChoiceGroupSeed beanChoice() {
        return choiceGroup("Escolha o feijão", 1, 1,
                choice("Tropeiro", "0.00", null),
                choice("De caldo", "0.00", null));
    }

    private static List<ProductMigration> currentMenuMigrations() {
        List<ProductMigration> migrations = new ArrayList<>(List.of(
                migration("Pratos", "Jantinha completa", "Arroz branco, feijão tropeiro ou de caldo, mandioca, vinagrete e 1 espeto", "30.00",
                        "Pratos", "Jantinha Completa", "Arroz branco, feijão tropeiro ou de caldo, mandioca, vinagrete e 1 espeto", "34.90"),
                migration("Pratos", "Carreteiro completo", "Arroz carreteiro, feijão tropeiro ou de caldo, mandioca, vinagrete e 1 espeto", "30.00",
                        "Pratos", "Carreteiro Completo", "Arroz carreteiro, feijão tropeiro ou de caldo, mandioca, vinagrete e 1 espeto", "34.90"),
                migration("Porções", "Batata frita 500g", null, "25.00",
                        "Petiscos", "Batata frita 500 gramas", null, "25.00"),
                migration("Porções", "Frango a passarinho", null, "35.00",
                        "Petiscos", "Frango a passarinho", null, "35.00"),
                migration("Porções", "Arroz branco", null, "10.00",
                        "Porções", "Arroz Branco", null, "10.00"),
                migration("Porções", "Arroz com carne", null, "10.00",
                        "Porções", "Arroz com Carne", null, "10.00"),
                migration("Porções", "Feijão tropeiro", null, "10.00",
                        "Porções", "Feijão Tropeiro", null, "10.00"),
                migration("Bebidas", "Cerveja lata", null, "5.00",
                        "Bebidas", "Cerveja Lata", null, "7.00"),
                migration("Bebidas", "Água com gás", null, "5.00",
                        "Bebidas", "Água com Gás", null, "5.00"),
                migration("Bebidas", "Água natural", null, "4.00",
                        "Bebidas", "Água Natural", null, "4.00"),
                migration("Bebidas", "Refrigerante 600ml", null, "7.00",
                        "Bebidas", "Refri 600ml", null, "10.00"),
                migration("Bebidas", "Refrigerante lata", "Lata 350ml", "5.00",
                        "Bebidas", "Refri Lata", null, "7.00"),
                migration("Bebidas", "Suco lata", null, "5.00",
                        "Bebidas", "Suco Lata", null, "7.00"),
                migration("Bebidas", "Suco de laranja 300ml", null, "5.00",
                        "Bebidas", "Suco Laranja 300ml", null, "7.00")
        ));
        SKEWERS.forEach(name -> migrations.add(migration(
                "Espetinhos", name, null, "12.00",
                "Espetinhos", name, null, "12.90")));
        return migrations;
    }

    private static ProductMigration migration(
            String currentCategory,
            String currentName,
            String currentDescription,
            String currentPrice,
            String targetCategory,
            String targetName,
            String targetDescription,
            String targetPrice
    ) {
        return new ProductMigration(currentCategory, currentName, currentDescription, currentPrice,
                targetCategory, targetName, targetDescription, targetPrice);
    }

    private static ChoiceGroupSeed skewerChoice() {
        return choiceGroup("Escolha o espeto", 1, 1, SKEWERS.stream()
                .map(name -> choice(name, "0.00", name))
                .toArray(ChoiceSeed[]::new));
    }

    private static CategorySeed category(String name, ProductSeed... products) {
        return new CategorySeed(name, List.of(products));
    }

    private static ProductSeed item(
            String name,
            String description,
            String price,
            int initialStock,
            int minimumStock,
            boolean automaticStock,
            ChoiceGroupSeed... choiceGroups
    ) {
        return new ProductSeed(name, description, price, initialStock, minimumStock,
                automaticStock, List.of(choiceGroups));
    }

    private static ChoiceGroupSeed choiceGroup(
            String name,
            int minimumSelections,
            int maximumSelections,
            ChoiceSeed... choices
    ) {
        return new ChoiceGroupSeed(name, minimumSelections, maximumSelections, List.of(choices));
    }

    private static ChoiceSeed choice(String name, String additionalPrice, String stockItemName) {
        return new ChoiceSeed(name, additionalPrice, stockItemName);
    }

    private static BigDecimal money(String value) {
        return new BigDecimal(value);
    }

    private static BigDecimal quantity(int value) {
        return BigDecimal.valueOf(value).setScale(3);
    }

    private static String key(String value) {
        return value.toLowerCase(Locale.ROOT).trim();
    }

    private static String groupKey(Product product, String name) {
        return product.getId() + "|" + key(name);
    }

    private static String optionKey(ProductOptionGroup group, String name) {
        return group.getId() + "|" + key(name);
    }

    private record CategorySeed(String name, List<ProductSeed> products) {
    }

    private record ProductSeed(
            String name,
            String description,
            String price,
            int initialStock,
            int minimumStock,
            boolean automaticStock,
            List<ChoiceGroupSeed> choiceGroups
    ) {
    }

    private record ChoiceGroupSeed(
            String name,
            int minimumSelections,
            int maximumSelections,
            List<ChoiceSeed> choices
    ) {
    }

    private record ChoiceSeed(
            String name,
            String additionalPrice,
            String stockItemName
    ) {
    }

    private record ProductMigration(
            String currentCategory,
            String currentName,
            String currentDescription,
            String currentPrice,
            String targetCategory,
            String targetName,
            String targetDescription,
            String targetPrice
    ) {
    }

    private record SeededProduct(Product product, ProductSeed seed) {
    }
}
