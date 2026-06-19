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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

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
    private final PasswordEncoder passwordEncoder;

    @Value("${hubon.seed.owner.name:}")
    private String ownerName;

    @Value("${hubon.seed.owner.email:}")
    private String ownerEmail;

    @Value("${hubon.seed.owner.password:}")
    private String ownerPassword;

    @Value("${hubon.seed.admin.enabled:true}")
    private boolean adminSeedEnabled;

    @Value("${hubon.seed.admin.name:}")
    private String adminName;

    @Value("${hubon.seed.admin.email:}")
    private String adminEmail;

    @Value("${hubon.seed.admin.password:}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        Role owner = createRoleIfNotExists("OWNER", "Dono ou responsável máximo pelo sistema");
        Role admin = createRoleIfNotExists("ADMIN", "Administrador do sistema");
        createRoleIfNotExists("WAITER", "Garçom");
        createRoleIfNotExists("KITCHEN", "Cozinha");
        createRoleIfNotExists("CASHIER", "Caixa");

        validateSeedUser("OWNER", ownerName, ownerEmail, ownerPassword);
        createUserIfNotExistsOrUpgradePassword(
                ownerName,
                ownerEmail,
                ownerPassword,
                Set.of(owner)
        );
        if (adminSeedEnabled) {
            validateSeedUser("ADMIN", adminName, adminEmail, adminPassword);
            createUserIfNotExistsOrUpgradePassword(
                    adminName,
                    adminEmail,
                    adminPassword,
                    Set.of(admin)
            );
        }
        seedCatalogIfEmpty();
        seedTablesIfEmpty();
    }

    private void validateSeedUser(String role, String name, String email, String password) {
        if (!StringUtils.hasText(name) || !StringUtils.hasText(email) || !StringUtils.hasText(password)) {
            throw new IllegalStateException(
                    "Configuração hubon.seed.%s.* incompleta para criar usuário inicial".formatted(role.toLowerCase())
            );
        }
    }

    private Role createRoleIfNotExists(String name, String description) {
        return roleRepository.findByName(name)
                .orElseGet(() -> roleRepository.save(Role.builder()
                    .name(name)
                    .description(description)
                    .build()));
    }

    private void createUserIfNotExistsOrUpgradePassword(
            String name,
            String email,
            String password,
            Set<Role> roles
    ) {
        userRepository.findByEmail(email).ifPresentOrElse(existingUser -> {
            if (existingUser.getPassword().startsWith("{noop}")) {
                existingUser.setPassword(passwordEncoder.encode(password));
                userRepository.save(existingUser);
            }
        }, () -> {
            User user = User.builder()
                    .name(name)
                    .email(email)
                    .password(passwordEncoder.encode(password))
                    .active(true)
                    .roles(roles)
                    .build();

            userRepository.save(user);
        });
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
