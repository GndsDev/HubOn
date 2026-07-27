package com.hubon.backend.order.domain;

public enum OrderItemStatus {
    DRAFT,
    WAITING_PREPARATION,
    IN_PREPARATION,
    READY,
    DELIVERED,
    CANCELED
}
