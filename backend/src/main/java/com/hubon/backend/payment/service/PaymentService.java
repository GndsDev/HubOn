package com.hubon.backend.payment.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.cash.domain.CashShift;
import com.hubon.backend.cash.domain.CashShiftStatus;
import com.hubon.backend.cash.repository.CashShiftRepository;
import com.hubon.backend.payment.domain.Payment;
import com.hubon.backend.payment.dto.PaymentRequest;
import com.hubon.backend.payment.dto.PaymentFinancialState;
import com.hubon.backend.payment.dto.PaymentNextAction;
import com.hubon.backend.payment.dto.PaymentOperationResponse;
import com.hubon.backend.payment.dto.PaymentResponse;
import com.hubon.backend.payment.dto.PaymentSummaryResponse;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.dto.RestaurantOrderResponse;
import com.hubon.backend.order.service.OrderPreparationWorkflowService;
import com.hubon.backend.order.service.RestaurantOrderService;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.domain.TabType;
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
    private final CashShiftRepository cashShiftRepository;
    private final TabRepository tabRepository;
    private final UserRepository userRepository;
    private final TabAccountingService accountingService;
    private final AuthenticatedUserProvider authenticatedUserProvider;
    private final OrderPreparationWorkflowService preparationWorkflowService;
    private final RestaurantOrderService orderService;

    @Transactional
    public PaymentOperationResponse create(PaymentRequest request) {
        Tab tab = tabRepository.findByIdForUpdate(request.tabId())
                .orElseThrow(() -> new ResourceNotFoundException("Comanda não encontrada"));
        User receivedByUser = authenticatedUserProvider.currentUser()
                .orElseGet(() -> findRequestedUser(request.receivedByUserId()));

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

        CashShift cashShift = cashShiftRepository.findByStatusForUpdate(CashShiftStatus.OPEN)
                .orElseThrow(() -> new BusinessException("Abra o caixa antes de registrar pagamentos."));
        Payment payment = paymentRepository.save(Payment.builder()
                .tab(tab)
                .cashShift(cashShift)
                .method(request.method())
                .amount(request.amount())
                .receivedByUser(receivedByUser)
                .build());

        BigDecimal paidAfterPayment = paidAmount.add(request.amount());
        BigDecimal remainingAfterPayment = tab.getFinalAmount()
                .subtract(paidAfterPayment)
                .max(BigDecimal.ZERO);
        if (tab.getType() == TabType.COUNTER && remainingAfterPayment.signum() == 0) {
            preparationWorkflowService.startEligibleCounterItems(tab);
        }

        List<RestaurantOrderResponse> orders = orderService.listByTabId(tab.getId());
        return new PaymentOperationResponse(
                toResponse(payment),
                tab.getFinalAmount(),
                paidAfterPayment,
                remainingAfterPayment,
                financialState(paidAfterPayment, remainingAfterPayment),
                orders,
                nextAction(tab, remainingAfterPayment, orders)
        );
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

    private PaymentFinancialState financialState(BigDecimal paidAmount, BigDecimal remainingAmount) {
        if (paidAmount.signum() == 0) return PaymentFinancialState.UNPAID;
        if (remainingAmount.signum() > 0) return PaymentFinancialState.PARTIALLY_PAID;
        return PaymentFinancialState.PAID;
    }

    private PaymentNextAction nextAction(
            Tab tab,
            BigDecimal remainingAmount,
            List<RestaurantOrderResponse> orders
    ) {
        if (remainingAmount.signum() > 0) return PaymentNextAction.COMPLETE_PAYMENT;
        if (tab.getType() == TabType.TABLE) return PaymentNextAction.RETURN_TO_TAB;

        List<OrderItemStatus> statuses = orders.stream()
                .flatMap(order -> order.items().stream())
                .filter(item -> item.status() != OrderItemStatus.CANCELED)
                .map(item -> item.status())
                .toList();
        if (statuses.stream().anyMatch(status -> status == OrderItemStatus.WAITING_PREPARATION
                || status == OrderItemStatus.IN_PREPARATION)) {
            return PaymentNextAction.FOLLOW_PREPARATION;
        }
        if (statuses.stream().anyMatch(status -> status == OrderItemStatus.READY)) {
            return PaymentNextAction.DELIVER;
        }
        return PaymentNextAction.FINALIZE;
    }

    private User findRequestedUser(Long userId) {
        if (userId == null) {
            throw new BusinessException("Usuário responsável é obrigatório");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));
    }
}
