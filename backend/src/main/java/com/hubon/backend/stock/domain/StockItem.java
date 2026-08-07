package com.hubon.backend.stock.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "stock_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 255)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private UnitOfMeasure unit;

    @Column(name = "current_stock", nullable = false, precision = 15, scale = 3)
    private BigDecimal currentStock;

    @Column(name = "minimum_stock", nullable = false, precision = 15, scale = 3)
    private BigDecimal minimumStock;

    @Column(nullable = false)
    private Boolean active;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (currentStock == null) currentStock = BigDecimal.ZERO;
        if (minimumStock == null) minimumStock = BigDecimal.ZERO;
        if (active == null) active = true;
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() { updatedAt = LocalDateTime.now(); }
}
