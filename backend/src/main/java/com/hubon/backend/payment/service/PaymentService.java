package com.hubon.backend.payment.service;

import com.hubon.backend.payment.domain.Payment;
import com.hubon.backend.payment.dto.PaymentRequest;
import com.hubon.backend.payment.dto.PaymentResponse;
import com.hubon.backend.payment.dto.PaymentSummaryResponse;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.repository.TabRepository;
import com.hubon.backend.tab.service.TabAccountingService;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final TabRepository tabRepository;
    private final UserRepository userRepository;
    private final TabAccountingService accountingService;

    @Transactional
    public PaymentResponse create(PaymentRequest request) {
        Tab tab = tabRepository.findByIdForUpdate(request.tabId())
                .orElseThrow(() -> new ResourceNotFoundException("Comanda não encontrada"));
        User receivedByUser = userRepository.findById(request.receivedByUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));

        if (tab.getStatus() != TabStatus.OPEN) {
            throw new BusinessException("Comanda fechada ou cancelada não pode receber pagamento");
        }

        if (request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Pagamento deve ser maior que zero");
        }

        accountingService.refreshAmounts(tab);
        BigDecimal paidAmount = accountingService.paidAmount(tab.getId());
        BigDecimal remainingAmount = tab.getFinalAmount().subtract(paidAmount);
        if (remainingAmount.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("A comanda possui pagamento excedente. Recarregue os dados antes de continuar");
        }
        if (request.amount().compareTo(remainingAmount) > 0) {
            throw new BusinessException("Soma dos pagamentos não pode ultrapassar o valor final da comanda");
        }

        Payment payment = Payment.builder()
                .tab(tab)
                .method(request.method())
                .amount(request.amount())
                .receivedByUser(receivedByUser)
                .build();

        return toResponse(paymentRepository.save(payment));
    }

    @Transactional(readOnly = true)
    public PaymentSummaryResponse getSummaryByTab(Long tabId) {
        Tab tab = tabRepository.findById(tabId)
                .orElseThrow(() -> new ResourceNotFoundException("Comanda não encontrada"));
        accountingService.refreshAmounts(tab);

        List<PaymentResponse> payments = paymentRepository.findAllByTabIdOrderByPaidAtAsc(tabId)
                .stream()
                .map(this::toResponse)
                .toList();

        BigDecimal paidAmount = accountingService.paidAmount(tabId);
        BigDecimal remainingAmount = tab.getFinalAmount().subtract(paidAmount).max(BigDecimal.ZERO);

        return new PaymentSummaryResponse(
                tabId,
                tab.getFinalAmount(),
                paidAmount,
                remainingAmount,
                payments
        );
    }

    private PaymentResponse toResponse(Payment payment) {
        return new PaymentResponse(
                payment.getId(),
                payment.getTab().getId(),
                payment.getMethod(),
                payment.getAmount(),
                payment.getPaidAt(),
                payment.getReceivedByUser().getId(),
                payment.getReceivedByUser().getName()
        );
    }
}
