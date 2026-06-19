package com.hubon.backend.auth.service;

import com.hubon.backend.user.domain.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.function.Function;

@Component
public class AuthenticatedUserProvider {

    public Optional<User> currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser principal)) {
            return Optional.empty();
        }
        return Optional.of(principal.user());
    }

    public User currentUserOr(Long fallbackUserId, Function<Long, User> fallbackLoader) {
        return currentUser().orElseGet(() -> fallbackLoader.apply(fallbackUserId));
    }
}
