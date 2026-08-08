package com.hubon.backend.sale.domain;

import com.hubon.backend.product.domain.Product;
import com.hubon.backend.user.domain.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "sale_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaleItem {
    public static final String QUANTITY_ADJUSTMENT_REASON = "Ajuste de quantidade";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sale_id", nullable = false)
    private Sale sale;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "product_name_snapshot", nullable = false, length = 120)
    private String productNameSnapshot;

    @Column(name = "category_name_snapshot", length = 120)
    private String categoryNameSnapshot;

    @Column(name = "base_unit_price_snapshot", nullable = false, precision = 12, scale = 2)
    private BigDecimal baseUnitPriceSnapshot;

    @Column(name = "unit_price_snapshot", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPriceSnapshot;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(length = 500)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdByUser;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cancelled_by_user_id")
    private User cancelledByUser;

    @Column(name = "cancellation_reason", length = 500)
    private String cancellationReason;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public boolean isActive() {
        return cancelledAt == null;
    }

    public boolean isOperationalCancellation() {
        return cancelledAt != null && !QUANTITY_ADJUSTMENT_REASON.equals(cancellationReason);
    }
}
