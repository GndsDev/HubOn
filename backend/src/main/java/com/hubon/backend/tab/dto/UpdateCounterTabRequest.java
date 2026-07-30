package com.hubon.backend.tab.dto;

import jakarta.validation.constraints.Size;

public record UpdateCounterTabRequest(
        @Size(max = 120)
        String customerName,

        @Size(max = 30)
        String customerPhone,

        @Size(max = 160)
        String identificationNote
) {
}
