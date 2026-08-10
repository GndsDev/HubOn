package com.hubon.backend.user.domain;

import java.util.Locale;
import java.util.regex.Pattern;

public final class UsernamePolicy {

    public static final String INPUT_PATTERN = "^\\s*[A-Za-z0-9._-]{3,40}\\s*$";
    private static final Pattern NORMALIZED_PATTERN = Pattern.compile("^[a-z0-9._-]{3,40}$");

    private UsernamePolicy() {
    }

    public static String normalize(String username) {
        return username == null ? null : username.trim().toLowerCase(Locale.ROOT);
    }

    public static boolean isValid(String username) {
        String normalized = normalize(username);
        return normalized != null && NORMALIZED_PATTERN.matcher(normalized).matches();
    }
}
