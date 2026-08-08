package com.hubon.backend.stock.domain;

import com.hubon.backend.sale.domain.SaleItem;
import com.hubon.backend.user.domain.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "stock_movements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockMovement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_item_id", nullable = false)
    private StockItem stockItem;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StockMovementType type;

    @Column(name = "delta_quantity", nullable = false, precision = 15, scale = 3)
    private BigDecimal deltaQuantity;

    @Column(name = "previous_balance", nullable = false, precision = 15, scale = 3)
    private BigDecimal previousBalance;

    @Column(name = "resulting_balance", nullable = false, precision = 15, scale = 3)
    private BigDecimal resultingBalance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sale_item_id")
    private SaleItem saleItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reversed_movement_id")
    private StockMovement reversedMovement;

    @Column(length = 500)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdByUser;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
