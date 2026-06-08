package com.hubon.backend.tab.service;

import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.repository.OrderItemRepository;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.tab.domain.Tab;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class TabAccountingService {

    private final OrderItemRepository orderItemRepository;
    private final PaymentRepository paymentRepository;

    public void refreshAmounts(Tab tab) {
        BigDecimal total = orderItemRepository.sumActiveSubtotalByTabId(
                tab.getId(),
                OrderStatus.CANCELLED,
                OrderItemStatus.ACTIVE
        );

        BigDecimal serviceFee = valueOrZero(tab.getServiceFee());
        BigDecimal discountAmount = valueOrZero(tab.getDiscountAmount());
        BigDecimal finalAmount = total.add(serviceFee).subtract(discountAmount).max(BigDecimal.ZERO);

        tab.setTotalAmount(total);
        tab.setServiceFee(serviceFee);
        tab.setDiscountAmount(discountAmount);
        tab.setFinalAmount(finalAmount);
    }

    public BigDecimal paidAmount(Long tabId) {
        return paymentRepository.sumAmountByTabId(tabId);
    }

    public BigDecimal remainingAmount(Tab tab) {
        return valueOrZero(tab.getFinalAmount()).subtract(paidAmount(tab.getId())).max(BigDecimal.ZERO);
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
