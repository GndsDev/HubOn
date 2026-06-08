package com.hubon.backend.table.dto;

import com.hubon.backend.table.domain.TableStatus;
import jakarta.validation.constraints.NotNull;

public record TableStatusRequest(
        @NotNull
        TableStatus status
) {
}
