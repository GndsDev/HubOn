package com.hubon.backend.sale.service;

import com.hubon.backend.sale.domain.Sale;
import com.hubon.backend.sale.domain.SaleStatus;
import com.hubon.backend.sale.dto.SaleAmounts;
import com.hubon.backend.sale.repository.SaleItemRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class SaleLifecycleService {
    private final SaleItemRepository saleItemRepository;
    private final Clock businessClock;

    public void ensureOpen(Sale sale) {
        if (sale.getStatus() != SaleStatus.OPEN) throw new BusinessException("Venda fechada ou cancelada e imutavel");
    }

    public void close(Sale sale, SaleAmounts amounts, User user) {
        ensureOpen(sale);
        if (saleItemRepository.countBySaleIdAndCancelledAtIsNullAndRemovedAtIsNull(sale.getId()) == 0) {
            throw new BusinessException("Venda vazia nao pode ser fechada");
        }
        if (amounts.paidAmount().compareTo(amounts.finalAmount()) != 0) {
            throw new BusinessException("O pagamento precisa ser igual ao valor final da venda");
        }
        LocalDateTime now = LocalDateTime.now(businessClock);
        sale.setStatus(SaleStatus.CLOSED);
        sale.setClosedByUser(user);
        sale.setClosedAt(now);
        sale.setClosedBusinessDate(now.toLocalDate());
    }
}
