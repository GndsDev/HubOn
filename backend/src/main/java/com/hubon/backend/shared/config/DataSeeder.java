package com.hubon.backend.shared.config;

import com.hubon.backend.category.domain.Category;
import com.hubon.backend.category.repository.CategoryRepository;
import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.repository.ProductRepository;
import com.hubon.backend.role.domain.Role;
import com.hubon.backend.role.repository.RoleRepository;
import com.hubon.backend.table.domain.RestaurantTable;
import com.hubon.backend.table.domain.TableStatus;
import com.hubon.backend.table.repository.RestaurantTableRepository;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "hubon.seed.enabled", havingValue = "true")
public class DataSeeder implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final RestaurantTableRepository tableRepository;

    @Value("${hubon.seed.admin-password}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        Role admin = createRoleIfNotExists("ADMIN", "Administrador do sistema");
        createRoleIfNotExists("WAITER", "Garçom");
        createRoleIfNotExists("KITCHEN", "Cozinha");
        createRoleIfNotExists("CASHIER", "Caixa");

        createAdminUserIfNotExists(admin);
        seedCatalogIfEmpty();
        seedTablesIfEmpty();
    }

    private Role createRoleIfNotExists(String name, String description) {
        return roleRepository.findByName(name)
                .orElseGet(() -> roleRepository.save(Role.builder()
                    .name(name)
                    .description(description)
                    .build()));
    }

    private void createAdminUserIfNotExists(Role admin) {
        if (!userRepository.existsByEmail("admin@hubon.local")) {
            User user = User.builder()
                    .name("Administrador")
                    .email("admin@hubon.local")
                    .password("{noop}" + adminPassword)
                    .active(true)
                    .roles(Set.of(admin))
                    .build();

            userRepository.save(user);
        }
    }

    private void seedCatalogIfEmpty() {
        if (categoryRepository.count() > 0) {
            return;
        }

        Category beverages = categoryRepository.save(Category.builder()
                .name("Bebidas")
                .description("Bebidas frias e quentes")
                .displayOrder(1)
                .active(true)
                .build());

        Category mains = categoryRepository.save(Category.builder()
                .name("Pratos principais")
                .description("Pratos para almoço e jantar")
                .displayOrder(2)
                .active(true)
                .build());

        productRepository.save(Product.builder()
                .category(beverages)
                .name("Suco natural")
                .description("Suco natural da casa")
                .price(new BigDecimal("9.90"))
                .active(true)
                .build());

        productRepository.save(Product.builder()
                .category(beverages)
                .name("Refrigerante lata")
                .description("Lata 350ml")
                .price(new BigDecimal("7.50"))
                .active(true)
                .build());

        productRepository.save(Product.builder()
                .category(mains)
                .name("Executivo da casa")
                .description("Prato executivo com acompanhamento")
                .price(new BigDecimal("32.90"))
                .active(true)
                .build());
    }

    private void seedTablesIfEmpty() {
        if (tableRepository.count() > 0) {
            return;
        }

        for (int number = 1; number <= 8; number++) {
            tableRepository.save(RestaurantTable.builder()
                    .number(number)
                    .name("Mesa " + number)
                    .status(TableStatus.AVAILABLE)
                    .active(true)
                    .build());
        }
    }
}
