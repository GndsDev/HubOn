package com.hubon.backend.payment.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.cash.domain.CashShift;
import com.hubon.backend.cash.domain.CashShiftStatus;
import com.hubon.backend.cash.repository.CashShiftRepository;
import com.hubon.backend.payment.domain.Payment;
import com.hubon.backend.payment.dto.PaymentRequest;
import com.hubon.backend.payment.dto.PaymentResponse;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.sale.domain.Sale;
import com.hubon.backend.sale.domain.SaleType;
import com.hubon.backend.sale.dto.SaleAmounts;
import com.hubon.backend.sale.repository.SaleItemRepository;
import com.hubon.backend.sale.repository.SaleRepository;
import com.hubon.backend.sale.service.SaleLifecycleService;
import com.hubon.backend.sale.service.SaleValueService;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class PaymentService {
    private final PaymentRepository paymentRepository;
    private final CashShiftRepository cashShiftRepository;
    private final SaleRepository saleRepository;
    private final SaleItemRepository saleItemRepository;
    private final UserRepository userRepository;
    private final SaleValueService valueService;
    private final SaleLifecycleService lifecycleService;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    @Transactional
    public PaymentResponse create(Long saleId, PaymentRequest request) {
        Sale sale = saleRepository.findByIdForUpdate(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Venda nao encontrada"));
        lifecycleService.ensureOpen(sale);
        if (saleItemRepository.countBySaleIdAndCancelledAtIsNullAndRemovedAtIsNull(saleId) == 0) {
            throw new BusinessException("Adicione ao menos um item antes do pagamento");
        }
        if (request.amount().compareTo(BigDecimal.ZERO) <= 0) throw new BusinessException("Pagamento deve ser maior que zero");
        SaleAmounts before = valueService.calculate(sale);
        if (request.amount().compareTo(before.remainingAmount()) > 0) {
            throw new BusinessException("Soma dos pagamentos nao pode ultrapassar o valor final da venda");
        }
        CashShift shift = cashShiftRepository.findByStatusForUpdate(CashShiftStatus.OPEN)
                .orElseThrow(() -> new BusinessException("Abra o caixa antes de registrar pagamentos"));
        User user = authenticatedUserProvider.currentUser().orElseGet(() -> findUser(request.receivedByUserId()));
        Payment payment = paymentRepository.save(Payment.builder().sale(sale).cashShift(shift)
                .method(request.method()).amount(request.amount()).receivedByUser(user).build());

        BigDecimal paidAfter = before.paidAmount().add(request.amount());
        if (sale.getType() == SaleType.COUNTER && before.finalAmount().signum() > 0
                && paidAfter.compareTo(before.finalAmount()) == 0) {
            lifecycleService.close(sale,
                    new SaleAmounts(before.subtotal(), before.finalAmount(), paidAfter, BigDecimal.ZERO), user);
        }
        return toResponse(payment);
    }

    public PaymentResponse toResponse(Payment payment) {
        return new PaymentResponse(payment.getId(), payment.getSale().getId(), payment.getMethod(), payment.getAmount(),
                payment.getPaidAt(), payment.getReceivedByUser().getId(), payment.getReceivedByUser().getName());
    }

    private User findUser(Long id) {
        if (id == null) throw new BusinessException("Usuario responsavel e obrigatorio");
        return userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Usuario nao encontrado"));
    }
}
