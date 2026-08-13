package com.hubon.backend.expense.domain;

import com.hubon.backend.stock.domain.StockItem;
import com.hubon.backend.stock.domain.StockMovement;
import com.hubon.backend.stock.domain.UnitOfMeasure;
import com.hubon.backend.user.domain.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "expenses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Expense {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "expense_date", nullable = false)
    private LocalDate expenseDate;

    @Column(nullable = false, length = 200)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ExpenseCategory category;

    @Column(length = 160)
    private String supplier;

    @Enumerated(EnumType.STRING)
    @Column(name = "value_mode", nullable = false, length = 20)
    private ExpenseValueMode valueMode;

    @Column(precision = 15, scale = 3)
    private BigDecimal quantity;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private UnitOfMeasure unit;

    @Column(name = "unit_price", precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 30)
    private ExpensePaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ExpenseStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_item_id")
    private StockItem stockItem;

    @Column(name = "stock_quantity", precision = 15, scale = 3)
    private BigDecimal stockQuantity;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_movement_id", unique = true)
    private StockMovement stockMovement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdByUser;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
