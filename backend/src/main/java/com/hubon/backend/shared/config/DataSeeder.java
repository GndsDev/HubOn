package com.hubon.backend.shared.config;

import com.hubon.backend.role.domain.Role;
import com.hubon.backend.role.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final RoleRepository roleRepository;

    @Override
    public void run(String... args) {
        createRoleIfNotExists("ADMIN", "Administrador do sistema");
        createRoleIfNotExists("WAITER", "Garçom");
        createRoleIfNotExists("KITCHEN", "Cozinha");
        createRoleIfNotExists("CASHIER", "Caixa");
    }

    private void createRoleIfNotExists(String name, String description) {
        if (!roleRepository.existsByName(name)) {
            Role role = Role.builder()
                    .name(name)
                    .description(description)
                    .build();

            roleRepository.save(role);
        }
    }
}