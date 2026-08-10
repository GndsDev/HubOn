package com.hubon.backend.shared.config;

import com.hubon.backend.role.domain.Role;
import com.hubon.backend.role.repository.RoleRepository;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.domain.UsernamePolicy;
import com.hubon.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Set;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "hubon.seed.enabled", havingValue = "true")
public class DataSeeder implements CommandLineRunner {
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final InitialCatalogSeeder initialCatalogSeeder;
    private final PasswordEncoder passwordEncoder;

    @Value("${hubon.seed.owner.name:}") private String ownerName;
    @Value("${hubon.seed.owner.username:}") private String ownerUsername;
    @Value("${hubon.seed.owner.password:}") private String ownerPassword;
    @Value("${hubon.seed.admin.enabled:true}") private boolean adminSeedEnabled;
    @Value("${hubon.seed.admin.name:}") private String adminName;
    @Value("${hubon.seed.admin.username:}") private String adminUsername;
    @Value("${hubon.seed.admin.password:}") private String adminPassword;

    @Override
    public void run(String... args) {
        Role owner = role("OWNER", "Dono ou responsavel maximo pelo sistema");
        Role admin = role("ADMIN", "Administrador do sistema");
        role("WAITER", "Atendimento");
        role("KITCHEN", "Perfil estrutural legado");
        role("CASHIER", "Caixa");
        validateUser("OWNER", ownerName, ownerUsername, ownerPassword);
        User ownerUser = user(ownerName, ownerUsername, ownerPassword, Set.of(owner));
        if (adminSeedEnabled) {
            validateUser("ADMIN", adminName, adminUsername, adminPassword);
            user(adminName, adminUsername, adminPassword, Set.of(admin));
        }
        initialCatalogSeeder.seed(ownerUser);
    }

    private Role role(String name, String description) {
        return roleRepository.findByName(name).orElseGet(() -> roleRepository.save(Role.builder().name(name).description(description).build()));
    }

    private void validateUser(String role, String name, String username, String password) {
        if (!StringUtils.hasText(name) || !StringUtils.hasText(username) || !StringUtils.hasText(password)) {
            throw new IllegalStateException("Configuracao hubon.seed.%s.* incompleta".formatted(role.toLowerCase()));
        }
        if (!UsernamePolicy.isValid(username)) {
            throw new IllegalStateException("Nome de usuario do seed %s invalido".formatted(role));
        }
    }

    private User user(String name, String username, String password, Set<Role> roles) {
        String normalizedUsername = UsernamePolicy.normalize(username);
        return userRepository.findByUsernameIgnoreCase(normalizedUsername).map(existing -> {
            if (existing.getPassword().startsWith("{noop}")) {
                existing.setPassword(passwordEncoder.encode(password));
                return userRepository.save(existing);
            }
            return existing;
        }).orElseGet(() -> userRepository.save(User.builder().name(name.trim()).username(normalizedUsername)
                .password(passwordEncoder.encode(password)).active(true).roles(roles).build()));
    }
}
