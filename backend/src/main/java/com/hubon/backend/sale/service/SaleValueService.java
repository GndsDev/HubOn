package com.hubon.backend.sale.service;

import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.sale.domain.Sale;
import com.hubon.backend.sale.dto.SaleAmounts;
import com.hubon.backend.sale.repository.SaleItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class SaleValueService {
    private final SaleItemRepository saleItemRepository;
    private final PaymentRepository paymentRepository;

    public SaleAmounts calculate(Sale sale) {
        BigDecimal subtotal = saleItemRepository.sumActiveSubtotal(sale.getId());
        BigDecimal finalAmount = subtotal.add(valueOrZero(sale.getServiceFee()))
                .subtract(valueOrZero(sale.getDiscountAmount())).max(BigDecimal.ZERO);
        BigDecimal paid = paymentRepository.sumAmountBySaleId(sale.getId());
        return new SaleAmounts(subtotal, finalAmount, paid, finalAmount.subtract(paid).max(BigDecimal.ZERO));
    }

    private BigDecimal valueOrZero(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
}
