package com.hubon.backend.user.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.role.domain.Role;
import com.hubon.backend.role.domain.RoleName;
import com.hubon.backend.role.repository.RoleRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.dto.UserRequest;
import com.hubon.backend.user.dto.UserResponse;
import com.hubon.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    private static final Set<RoleName> OWNER_CREATABLE_ROLES = EnumSet.of(
            RoleName.ADMIN,
            RoleName.WAITER,
            RoleName.KITCHEN,
            RoleName.CASHIER
    );
    private static final Set<RoleName> ADMIN_CREATABLE_ROLES = EnumSet.of(
            RoleName.WAITER,
            RoleName.KITCHEN,
            RoleName.CASHIER
    );

    @Transactional(readOnly = true)
    public List<UserResponse> listAll() {
        return userRepository.findAll(Sort.by("name"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public User findEntityById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));
    }

    @Transactional
    public UserResponse create(UserRequest request) {
        User creator = authenticatedUserProvider.currentUser()
                .orElseThrow(() -> new BusinessException("Usuário autenticado é obrigatório para criar usuários"));
        Set<RoleName> requestedRoles = normalizeRoleNames(request.roles());
        validateUserCreation(creator, requestedRoles);

        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new BusinessException("E-mail já está cadastrado");
        }

        Set<Role> roles = requestedRoles.stream()
                .map(roleName -> roleRepository.findByName(roleName.name())
                        .orElseThrow(() -> new ResourceNotFoundException("Perfil não encontrado: " + roleName.name())))
                .collect(Collectors.toCollection(HashSet::new));

        User user = User.builder()
                .name(request.name().trim())
                .email(email)
                .password(passwordEncoder.encode(request.password()))
                .active(request.active() == null || request.active())
                .roles(roles)
                .build();

        return toResponse(userRepository.save(user));
    }

    public UserResponse toResponse(User user) {
        Set<String> roles = user.getRoles()
                .stream()
                .map(role -> role.getName())
                .collect(Collectors.toSet());

        return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getActive(), roles);
    }

    private Set<RoleName> normalizeRoleNames(Set<String> roles) {
        return roles.stream()
                .map(role -> role.trim().toUpperCase())
                .map(role -> {
                    try {
                        return RoleName.valueOf(role);
                    } catch (IllegalArgumentException exception) {
                        throw new BusinessException("Perfil inválido: " + role);
                    }
                })
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(RoleName.class)));
    }

    private void validateUserCreation(User creator, Set<RoleName> requestedRoles) {
        Set<RoleName> creatorRoles = normalizeRoleNames(
                creator.getRoles()
                        .stream()
                        .map(Role::getName)
                        .collect(Collectors.toSet())
        );

        Set<RoleName> allowedRoles;
        if (creatorRoles.contains(RoleName.OWNER)) {
            allowedRoles = OWNER_CREATABLE_ROLES;
        } else if (creatorRoles.contains(RoleName.ADMIN)) {
            allowedRoles = ADMIN_CREATABLE_ROLES;
        } else {
            throw new BusinessException("Perfil operacional não pode criar usuários");
        }

        if (!allowedRoles.containsAll(requestedRoles)) {
            if (requestedRoles.contains(RoleName.OWNER)) {
                throw new BusinessException("Não é permitido criar usuário OWNER por este fluxo");
            }
            if (requestedRoles.contains(RoleName.ADMIN)) {
                throw new BusinessException("ADMIN não pode criar outro ADMIN");
            }
            throw new BusinessException("Você não tem permissão para criar usuário com os perfis solicitados");
        }
    }
}
