package com.hubon.backend.user.dto;

import com.hubon.backend.user.domain.UsernamePolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Set;

public record UserRequest(
        @NotBlank
        @Size(max = 120)
        String name,

        @NotBlank
        @Pattern(
                regexp = UsernamePolicy.INPUT_PATTERN,
                message = "Nome de usuário deve ter de 3 a 40 caracteres e usar apenas letras, números, ponto, hífen ou sublinhado"
        )
        String username,

        @NotBlank
        @Size(min = 6, max = 120)
        String password,

        Boolean active,

        @NotEmpty
        Set<String> roles
) {
}
