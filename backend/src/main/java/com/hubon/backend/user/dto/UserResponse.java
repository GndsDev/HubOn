package com.hubon.backend.user.dto;

import java.util.Set;

public record UserResponse(
        Long id,
        String name,
        String username,
        Boolean active,
        Set<String> roles
) {
}
