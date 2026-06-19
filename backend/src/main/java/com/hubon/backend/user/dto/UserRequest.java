package com.hubon.backend.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.Set;

public record UserRequest(
        @NotBlank
        @Size(max = 120)
        String name,

        @NotBlank
        @Email
        @Size(max = 160)
        String email,

        @NotBlank
        @Size(min = 6, max = 120)
        String password,

        Boolean active,

        @NotEmpty
        Set<String> roles
) {
}
