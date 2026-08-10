package com.hubon.backend.auth.dto;

import com.hubon.backend.user.domain.UsernamePolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record LoginRequest(
        @NotBlank
        @Pattern(regexp = UsernamePolicy.INPUT_PATTERN, message = "Nome de usuário inválido")
        String username,

        @NotBlank
        String password
) {
}
