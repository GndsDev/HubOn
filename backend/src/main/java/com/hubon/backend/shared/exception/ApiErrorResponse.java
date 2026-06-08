package com.hubon.backend.shared.exception;

import java.time.LocalDateTime;

public record ApiErrorResponse(
        String message,
        int status,
        LocalDateTime timestamp
) {
}
