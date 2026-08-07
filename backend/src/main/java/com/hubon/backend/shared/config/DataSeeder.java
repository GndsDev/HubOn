package com.hubon.backend.shared.config;

import com.hubon.backend.category.domain.Category;
import com.hubon.backend.category.repository.CategoryRepository;
import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.repository.ProductRepository;
import com.hubon.backend.role.domain.Role;
import com.hubon.backend.role.repository.RoleRepository;
import com.hubon.backend.table.domain.RestaurantTable;
import com.hubon.backend.table.repository.RestaurantTableRepository;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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

    @Value("${hubon.seed.owner.name:}") private String ownerName;
    @Value("${hubon.seed.owner.email:}") private String ownerEmail;
    @Value("${hubon.seed.owner.password:}") private String ownerPassword;
    @Value("${hubon.seed.admin.enabled:true}") private boolean adminSeedEnabled;
    @Value("${hubon.seed.admin.name:}") private String adminName;
    @Value("${hubon.seed.admin.email:}") private String adminEmail;
    @Value("${hubon.seed.admin.password:}") private String adminPassword;

    @Override
    public void run(String... args) {
        Role owner = role("OWNER", "Dono ou responsavel maximo pelo sistema");
        Role admin = role("ADMIN", "Administrador do sistema");
        role("WAITER", "Atendimento");
        role("KITCHEN", "Perfil estrutural legado");
        role("CASHIER", "Caixa");
        validateUser("OWNER", ownerName, ownerEmail, ownerPassword);
        user(ownerName, ownerEmail, ownerPassword, Set.of(owner));
        if (adminSeedEnabled) {
            validateUser("ADMIN", adminName, adminEmail, adminPassword);
            user(adminName, adminEmail, adminPassword, Set.of(admin));
        }
        seedCatalog();
        seedTables();
    }

    private Role role(String name, String description) {
        return roleRepository.findByName(name).orElseGet(() -> roleRepository.save(Role.builder().name(name).description(description).build()));
    }

    private void validateUser(String role, String name, String email, String password) {
        if (!StringUtils.hasText(name) || !StringUtils.hasText(email) || !StringUtils.hasText(password)) {
            throw new IllegalStateException("Configuracao hubon.seed.%s.* incompleta".formatted(role.toLowerCase()));
        }
    }

    private void user(String name, String email, String password, Set<Role> roles) {
        userRepository.findByEmail(email).ifPresentOrElse(existing -> {
            if (existing.getPassword().startsWith("{noop}")) existing.setPassword(passwordEncoder.encode(password));
        }, () -> userRepository.save(User.builder().name(name).email(email)
                .password(passwordEncoder.encode(password)).active(true).roles(roles).build()));
    }

    private void seedCatalog() {
        if (productRepository.count() > 0) return;
        Category beverages = categoryRepository.save(Category.builder().name("Bebidas").displayOrder(1).active(true).build());
        Category meals = categoryRepository.save(Category.builder().name("Pratos").displayOrder(2).active(true).build());
        product(beverages, "Refrigerante lata", "Lata 350ml", "7.50");
        product(beverages, "Suco natural", "Suco natural da casa", "9.90");
        product(meals, "Executivo da casa", "Prato executivo com acompanhamento", "32.90");
    }

    private void product(Category category, String name, String description, String price) {
        productRepository.save(Product.builder().category(category).name(name).description(description)
                .price(new BigDecimal(price)).active(true).available(true).displayOrder(0).build());
    }

    private void seedTables() {
        if (tableRepository.count() > 0) return;
        for (int number = 1; number <= 8; number++) {
            tableRepository.save(RestaurantTable.builder().number(number).label("Mesa " + number).active(true).build());
        }
    }
}
