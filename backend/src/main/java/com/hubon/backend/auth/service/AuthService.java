package com.hubon.backend.auth.service;

import com.hubon.backend.auth.dto.AuthResponse;
import com.hubon.backend.auth.dto.LoginRequest;
import com.hubon.backend.user.domain.User;
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
}
