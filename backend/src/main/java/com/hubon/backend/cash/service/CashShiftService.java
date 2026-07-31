package com.hubon.backend.cash.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.cash.domain.CashMovement;
import com.hubon.backend.cash.domain.CashMovementType;
import com.hubon.backend.cash.domain.CashShift;
import com.hubon.backend.cash.domain.CashShiftStatus;
import com.hubon.backend.cash.dto.CashMovementRequest;
import com.hubon.backend.cash.dto.CashMovementResponse;
import com.hubon.backend.cash.dto.CashShiftResponse;
import com.hubon.backend.cash.dto.CloseCashShiftRequest;
import com.hubon.backend.cash.dto.OpenCashShiftRequest;
import com.hubon.backend.cash.repository.CashMovementRepository;
import com.hubon.backend.cash.repository.CashShiftRepository;
import com.hubon.backend.order.domain.OrderItem;
import com.hubon.backend.order.domain.OrderItemStatus;
import com.hubon.backend.order.repository.OrderItemRepository;
import com.hubon.backend.payment.domain.Payment;
import com.hubon.backend.payment.domain.PaymentMethod;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabType;
import com.hubon.backend.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CashShiftService {

    private final CashShiftRepository cashShiftRepository;
    private final CashMovementRepository cashMovementRepository;
    private final PaymentRepository paymentRepository;
    private final OrderItemRepository orderItemRepository;
    private final AuthenticatedUserProvider authenticatedUserProvider;
    private final Clock businessClock;

    @Transactional(readOnly = true)
    public Optional<CashShiftResponse> getCurrent() {
        return cashShiftRepository.findFirstByStatus(CashShiftStatus.OPEN).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public CashShiftResponse getById(Long id) {
        return toResponse(findById(id));
    }

    @Transactional(readOnly = true)
    public List<CashShiftResponse> history() {
        return cashShiftRepository.findAllByOrderByOpenedAtDesc(PageRequest.of(0, 50))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public CashShiftResponse open(OpenCashShiftRequest request) {
        if (cashShiftRepository.findFirstByStatus(CashShiftStatus.OPEN).isPresent()) {
            throw new BusinessException("Já existe um turno de caixa aberto");
        }

        LocalDateTime now = LocalDateTime.now(businessClock);
        CashShift shift = CashShift.builder()
                .status(CashShiftStatus.OPEN)
                .openedByUser(currentUser())
                .openedAt(now)
                .openingBalance(request.openingBalance())
                .createdAt(now)
                .updatedAt(now)
                .build();
        try {
            return toResponse(cashShiftRepository.saveAndFlush(shift));
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException("Já existe um turno de caixa aberto");
        }
    }

    @Transactional
    public CashShiftResponse addMovement(Long shiftId, CashMovementRequest request) {
        CashShift shift = findByIdForUpdate(shiftId);
        ensureOpen(shift);
        LocalDateTime now = LocalDateTime.now(businessClock);
        cashMovementRepository.save(CashMovement.builder()
                .cashShift(shift)
                .type(request.type())
                .amount(request.amount())
                .note(request.note().trim())
                .createdByUser(currentUser())
                .occurredAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build());
        shift.setUpdatedAt(now);
        return toResponse(shift);
    }

    @Transactional
    public CashShiftResponse close(Long shiftId, CloseCashShiftRequest request) {
        CashShift shift = findByIdForUpdate(shiftId);
        ensureOpen(shift);
        LocalDateTime now = LocalDateTime.now(businessClock);
        ShiftTotals totals = totals(shift, now);
        BigDecimal difference = request.countedCash().subtract(totals.expectedCash());
        String note = normalize(request.note());
        if (difference.signum() != 0 && note == null) {
            throw new BusinessException("Informe uma observação para justificar a divergência do caixa");
        }

        shift.setStatus(CashShiftStatus.CLOSED);
        shift.setClosedByUser(currentUser());
        shift.setClosedAt(now);
        shift.setExpectedCash(totals.expectedCash());
        shift.setCountedCash(request.countedCash());
        shift.setDifferenceAmount(difference);
        shift.setClosingNote(note);
        shift.setUpdatedAt(now);
        return toResponse(shift);
    }

    private CashShiftResponse toResponse(CashShift shift) {
        LocalDateTime end = shift.getClosedAt() == null ? LocalDateTime.now(businessClock) : shift.getClosedAt();
        ShiftTotals totals = totals(shift, end);
        BigDecimal expectedCash = shift.getExpectedCash() == null ? totals.expectedCash() : shift.getExpectedCash();
        return new CashShiftResponse(
                shift.getId(),
                shift.getStatus(),
                shift.getOpenedByUser().getId(),
                shift.getOpenedByUser().getName(),
                shift.getOpenedAt(),
                shift.getOpeningBalance(),
                shift.getClosedByUser() == null ? null : shift.getClosedByUser().getId(),
                shift.getClosedByUser() == null ? null : shift.getClosedByUser().getName(),
                shift.getClosedAt(),
                totals.receivedTotal(),
                totals.receivedByMethod(),
                totals.cancellationAmount(),
                BigDecimal.ZERO,
                totals.supplyAmount(),
                totals.withdrawalAmount(),
                expectedCash,
                shift.getCountedCash(),
                shift.getDifferenceAmount(),
                shift.getClosingNote(),
                totals.movements()
        );
    }

    private ShiftTotals totals(CashShift shift, LocalDateTime end) {
        List<Payment> payments = paymentRepository.findAllByCashShiftIdOrderByPaidAtAsc(shift.getId());
        List<CashMovement> manualMovements = cashMovementRepository.findAllByCashShiftIdOrderByOccurredAtAsc(shift.getId());
        List<OrderItem> cancellations = orderItemRepository.findAllByStatusAndCancelledAtGreaterThanEqualAndCancelledAtLessThanEqualOrderByCancelledAtAsc(
                OrderItemStatus.CANCELED, shift.getOpenedAt(), end);

        EnumMap<PaymentMethod, BigDecimal> receivedByMethod = new EnumMap<>(PaymentMethod.class);
        for (PaymentMethod method : PaymentMethod.values()) receivedByMethod.put(method, BigDecimal.ZERO);
        payments.forEach(payment -> receivedByMethod.merge(payment.getMethod(), payment.getAmount(), BigDecimal::add));

        BigDecimal receivedTotal = payments.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal supplyAmount = movementTotal(manualMovements, CashMovementType.SUPPLY);
        BigDecimal withdrawalAmount = movementTotal(manualMovements, CashMovementType.WITHDRAWAL);
        BigDecimal cancellationAmount = cancellations.stream().map(OrderItem::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal expectedCash = shift.getOpeningBalance()
                .add(receivedByMethod.get(PaymentMethod.CASH))
                .add(supplyAmount)
                .subtract(withdrawalAmount);

        List<CashMovementResponse> movements = new ArrayList<>();
        payments.stream().map(this::paymentMovement).forEach(movements::add);
        manualMovements.stream().map(this::manualMovement).forEach(movements::add);
        cancellationMovements(cancellations).forEach(movements::add);
        movements.sort(java.util.Comparator.comparing(CashMovementResponse::occurredAt));
        return new ShiftTotals(
                receivedTotal,
                Map.copyOf(receivedByMethod),
                cancellationAmount,
                supplyAmount,
                withdrawalAmount,
                expectedCash,
                List.copyOf(movements)
        );
    }

    private List<CashMovementResponse> cancellationMovements(List<OrderItem> items) {
        return items.stream()
                .collect(Collectors.groupingBy(item -> item.getOrder().getId()))
                .values()
                .stream()
                .map(group -> {
                    OrderItem first = group.getFirst();
                    BigDecimal amount = group.stream().map(OrderItem::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
                    String reason = group.stream().map(OrderItem::getCancellationReason).filter(value -> value != null && !value.isBlank()).findFirst().orElse(null);
                    return new CashMovementResponse(
                            "CANCELLATION-" + first.getOrder().getId(),
                            "CANCELLATION",
                            origin(first.getOrder().getTab()),
                            amount,
                            null,
                            first.getCancelledByUser() == null ? "Sistema" : first.getCancelledByUser().getName(),
                            "Pedido #" + first.getOrder().getId(),
                            reason,
                            first.getCancelledAt()
                    );
                })
                .toList();
    }

    private CashMovementResponse paymentMovement(Payment payment) {
        return new CashMovementResponse(
                "PAYMENT-" + payment.getId(),
                "PAYMENT",
                origin(payment.getTab()),
                payment.getAmount(),
                payment.getMethod(),
                payment.getReceivedByUser().getName(),
                "Pagamento #" + payment.getId(),
                null,
                payment.getPaidAt()
        );
    }

    private CashMovementResponse manualMovement(CashMovement movement) {
        return new CashMovementResponse(
                "CASH-" + movement.getId(),
                movement.getType().name(),
                movement.getType() == CashMovementType.SUPPLY ? "Suprimento" : "Sangria",
                movement.getAmount(),
                PaymentMethod.CASH,
                movement.getCreatedByUser().getName(),
                "Movimentação #" + movement.getId(),
                movement.getNote(),
                movement.getOccurredAt()
        );
    }

    private BigDecimal movementTotal(List<CashMovement> movements, CashMovementType type) {
        return movements.stream()
                .filter(movement -> movement.getType() == type)
                .map(CashMovement::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String origin(Tab tab) {
        if (tab.getType() == TabType.COUNTER) return "Balcão #" + tab.getId();
        return "Mesa " + tab.getRestaurantTable().getNumber();
    }

    private CashShift findById(Long id) {
        return cashShiftRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Turno de caixa não encontrado"));
    }

    private CashShift findByIdForUpdate(Long id) {
        return cashShiftRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Turno de caixa não encontrado"));
    }

    private void ensureOpen(CashShift shift) {
        if (shift.getStatus() != CashShiftStatus.OPEN) {
            throw new BusinessException("O turno de caixa já está fechado");
        }
    }

    private User currentUser() {
        return authenticatedUserProvider.currentUser()
                .orElseThrow(() -> new BusinessException("Usuário autenticado é obrigatório"));
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record ShiftTotals(
            BigDecimal receivedTotal,
            Map<PaymentMethod, BigDecimal> receivedByMethod,
            BigDecimal cancellationAmount,
            BigDecimal supplyAmount,
            BigDecimal withdrawalAmount,
            BigDecimal expectedCash,
            List<CashMovementResponse> movements
    ) {
    }
}
