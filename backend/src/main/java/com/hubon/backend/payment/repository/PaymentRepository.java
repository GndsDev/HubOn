package com.hubon.backend.payment.repository;

import com.hubon.backend.payment.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findAllByTabIdOrderByPaidAtAsc(Long tabId);

    boolean existsByTabId(Long tabId);

    @Query("select coalesce(sum(payment.amount), 0) from Payment payment where payment.tab.id = :tabId")
    BigDecimal sumAmountByTabId(@Param("tabId") Long tabId);

    @Query("""
            select coalesce(sum(payment.amount), 0)
            from Payment payment
            where payment.paidAt >= :start
              and payment.paidAt < :end
            """)
    BigDecimal sumAmountBetween(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );
}
