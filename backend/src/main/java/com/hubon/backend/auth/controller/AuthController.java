package com.hubon.backend.auth.controller;

import com.hubon.backend.auth.dto.AuthResponse;
import com.hubon.backend.auth.dto.ChangePasswordRequest;
import com.hubon.backend.auth.dto.LoginRequest;
import com.hubon.backend.auth.dto.PasswordChangeResponse;
import com.hubon.backend.auth.service.AuthService;
import com.hubon.backend.user.dto.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public UserResponse me() {
        return authService.me();
    }

    @PatchMapping("/change-password")
    public PasswordChangeResponse changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        return authService.changePassword(request);
    }
}
