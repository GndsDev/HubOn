package com.hubon.backend.sale.domain;

import com.hubon.backend.product.domain.ProductOption;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "sale_item_options")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaleItemOption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sale_item_id", nullable = false)
    private SaleItem saleItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_option_id")
    private ProductOption productOption;

    @Column(name = "option_group_name_snapshot", nullable = false, length = 120)
    private String optionGroupNameSnapshot;

    @Column(name = "option_name_snapshot", nullable = false, length = 120)
    private String optionNameSnapshot;

    @Column(name = "additional_price_snapshot", nullable = false, precision = 12, scale = 2)
    private BigDecimal additionalPriceSnapshot;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
