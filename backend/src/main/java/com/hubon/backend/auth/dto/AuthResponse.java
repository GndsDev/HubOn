package com.hubon.backend.auth.dto;

import com.hubon.backend.user.dto.UserResponse;

import java.time.Instant;

public record AuthResponse(
        String token,
        String tokenType,
        Instant expiresAt,
        UserResponse user
) {
}
