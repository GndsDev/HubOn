package com.hubon.backend.auth.service;

import com.hubon.backend.auth.dto.AuthResponse;
import com.hubon.backend.auth.dto.ChangePasswordRequest;
import com.hubon.backend.auth.dto.LoginRequest;
import com.hubon.backend.auth.dto.PasswordChangeResponse;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.dto.UserResponse;
import com.hubon.backend.user.repository.UserRepository;
import com.hubon.backend.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserService userService;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email().trim().toLowerCase())
                .orElseThrow(() -> new BadCredentialsException("Credenciais inválidas"));

        if (!Boolean.TRUE.equals(user.getActive())
                || !passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BadCredentialsException("Credenciais inválidas");
        }

        JwtService.GeneratedToken generatedToken = jwtService.generateToken(user);
        return new AuthResponse(
                generatedToken.token(),
                "Bearer",
                generatedToken.expiresAt(),
                userService.toResponse(user)
        );
    }

    @Transactional(readOnly = true)
    public UserResponse me() {
        return userService.toResponse(currentAuthenticatedUser());
    }

    @Transactional
    public PasswordChangeResponse changePassword(ChangePasswordRequest request) {
        User user = currentAuthenticatedUser();

        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new BusinessException("Senha atual inválida.");
        }

        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new BusinessException("A confirmação da senha não confere.");
        }

        if (passwordEncoder.matches(request.newPassword(), user.getPassword())) {
            throw new BusinessException("A nova senha deve ser diferente da senha atual.");
        }

        if (!isValidNewPassword(request.newPassword())) {
            throw new BusinessException("A nova senha não atende aos requisitos mínimos.");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        return new PasswordChangeResponse("Senha alterada com sucesso.");
    }

    private User currentAuthenticatedUser() {
        return authenticatedUserProvider.currentUser()
                .orElseThrow(() -> new BadCredentialsException("Autenticação necessária"));
    }

    private boolean isValidNewPassword(String password) {
        if (password == null || password.length() < 8) {
            return false;
        }

        boolean hasLetter = false;
        boolean hasDigit = false;
        boolean hasSpecial = false;

        for (int i = 0; i < password.length(); i++) {
            char character = password.charAt(i);
            if (Character.isLetter(character)) {
                hasLetter = true;
            } else if (Character.isDigit(character)) {
                hasDigit = true;
            } else {
                hasSpecial = true;
            }
        }

        return hasLetter && hasDigit && hasSpecial;
    }
}
