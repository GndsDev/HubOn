package com.hubon.backend.order.domain;

public enum OrderStatus {
    CREATED,
    SENT_TO_KITCHEN,
    PREPARING,
    READY,
    DELIVERED,
    CANCELLED
}