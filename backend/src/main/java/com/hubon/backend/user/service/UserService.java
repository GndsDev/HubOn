package com.hubon.backend.user.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.role.domain.Role;
import com.hubon.backend.role.domain.RoleName;
import com.hubon.backend.role.repository.RoleRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.domain.UsernamePolicy;
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
                .orElseThrow(
                        () -> new ResourceNotFoundException(
                                "Usuário não encontrado"
                        )
                );
    }

    @Transactional
    public UserResponse create(UserRequest request) {
        User creator = authenticatedUserProvider.currentUser()
                .orElseThrow(
                        () -> new BusinessException(
                                "Usuário autenticado é obrigatório para criar usuários"
                        )
                );

        Set<RoleName> requestedRoles =
                normalizeRoleNames(request.roles());

        validateUserCreation(
                creator,
                requestedRoles
        );

        String username = UsernamePolicy.normalize(request.username());

        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new BusinessException(
                    "Nome de usuário já está cadastrado"
            );
        }

        Set<Role> roles = requestedRoles.stream()
                .map(roleName ->
                        roleRepository.findByName(
                                        roleName.name()
                                )
                                .orElseThrow(() ->new ResourceNotFoundException("Perfil não encontrado: " + roleName.name()))
                )
                .collect(Collectors.toCollection(HashSet::new)
                );

        User user = User.builder()
                .name(request.name().trim())
                .username(username)
                .password(
                        passwordEncoder.encode(
                                request.password()
                        )
                )
                .active(
                        request.active() == null ||
                                request.active()
                )
                .roles(roles)
                .build();

        return toResponse(
                userRepository.save(user)
        );
    }

    public UserResponse toResponse(User user) {
        Set<String> roles = user.getRoles()
                .stream()
                .map(Role::getName)
                .collect(Collectors.toSet());

        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getUsername(),
                user.getActive(),
                roles
        );
    }

    private Set<RoleName> normalizeRoleNames(
            Set<String> roles
    ) {
        if (roles == null || roles.isEmpty()) {
            throw new BusinessException(
                    "É obrigatório informar um perfil"
            );
        }

        return roles.stream()
                .map(role -> {
                    if (role == null || role.isBlank()) {
                        throw new BusinessException(
                                "Perfil inválido"
                        );
                    }

                    return role.trim().toUpperCase();
                })
                .map(role -> {
                    try {
                        return RoleName.valueOf(role);
                    } catch (
                            IllegalArgumentException exception
                    ) {
                        throw new BusinessException(
                                "Perfil inválido: " + role
                        );
                    }
                })
                .collect(Collectors.toCollection(() ->EnumSet.noneOf(RoleName.class))
                );
    }

    private void validateUserCreation(
            User creator,
            Set<RoleName> requestedRoles
    ) {
        Set<RoleName> creatorRoles =
                normalizeRoleNames(
                        creator.getRoles()
                                .stream()
                                .map(Role::getName)
                                .collect(
                                        Collectors.toSet()
                                )
                );

        if (
                !creatorRoles.contains(
                        RoleName.OWNER
                )
        ) {
            throw new BusinessException(
                    "Somente o dono pode criar novos usuários"
            );
        }

        if (
                requestedRoles.size() != 1 ||
                        !requestedRoles.contains(
                                RoleName.ADMIN
                        )
        ) {
            if (
                    requestedRoles.contains(
                            RoleName.OWNER
                    )
            ) {
                throw new BusinessException(
                        "Não é permitido criar outro usuário dono por este fluxo"
                );
            }

            throw new BusinessException(
                    "Novos usuários podem receber somente o perfil de gerente"
            );
        }
    }
}
