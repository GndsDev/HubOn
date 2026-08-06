package com.hubon.backend.tab.domain;

import com.hubon.backend.table.domain.RestaurantTable;
import com.hubon.backend.user.domain.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tabs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Tab {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_table_id")
    private RestaurantTable restaurantTable;

    @Column(name = "table_number")
    private Integer tableNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TabType type;

    @Column(name = "customer_name", length = 120)
    private String customerName;

    @Column(name = "customer_phone", length = 30)
    private String customerPhone;

    @Column(name = "identification_note", length = 160)
    private String identificationNote;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TabStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opened_by_user_id", nullable = false)
    private User openedByUser;

    @Column(name = "opened_at", nullable = false)
    private LocalDateTime openedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "closed_business_date")
    private LocalDate closedBusinessDate;

    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "service_fee", nullable = false, precision = 10, scale = 2)
    private BigDecimal serviceFee;

    @Column(name = "discount_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountAmount;

    @Column(name = "final_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal finalAmount;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (status == null) {
            status = TabStatus.OPEN;
        }
        if (type == null) {
            type = TabType.TABLE;
        }
        if (openedAt == null) {
            openedAt = now;
        }
        if (totalAmount == null) {
            totalAmount = BigDecimal.ZERO;
        }
        if (serviceFee == null) {
            serviceFee = BigDecimal.ZERO;
        }
        if (discountAmount == null) {
            discountAmount = BigDecimal.ZERO;
        }
        if (finalAmount == null) {
            finalAmount = totalAmount.add(serviceFee).subtract(discountAmount).max(BigDecimal.ZERO);
        }
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
