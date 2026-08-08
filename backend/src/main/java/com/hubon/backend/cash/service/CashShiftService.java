package com.hubon.backend.cash.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.cash.domain.*;
import com.hubon.backend.cash.dto.*;
import com.hubon.backend.cash.repository.CashMovementRepository;
import com.hubon.backend.cash.repository.CashShiftRepository;
import com.hubon.backend.payment.domain.Payment;
import com.hubon.backend.payment.domain.PaymentMethod;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.sale.domain.Sale;
import com.hubon.backend.sale.domain.SaleItem;
import com.hubon.backend.sale.domain.SaleType;
import com.hubon.backend.sale.repository.SaleItemRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CashShiftService {
    private final CashShiftRepository cashShiftRepository;
    private final CashMovementRepository cashMovementRepository;
    private final PaymentRepository paymentRepository;
    private final SaleItemRepository saleItemRepository;
    private final AuthenticatedUserProvider authenticatedUserProvider;
    private final Clock businessClock;

    @Transactional(readOnly = true) public Optional<CashShiftResponse> getCurrent() { return cashShiftRepository.findFirstByStatus(CashShiftStatus.OPEN).map(this::toResponse); }
    @Transactional(readOnly = true) public CashShiftResponse getById(Long id) { return toResponse(findById(id)); }
    @Transactional(readOnly = true) public List<CashShiftResponse> history() { return cashShiftRepository.findAllByOrderByOpenedAtDesc(PageRequest.of(0, 50)).stream().map(this::toResponse).toList(); }

    @Transactional
    public CashShiftResponse open(OpenCashShiftRequest request) {
        if (cashShiftRepository.findFirstByStatus(CashShiftStatus.OPEN).isPresent()) throw new BusinessException("Ja existe um turno de caixa aberto");
        LocalDateTime now = LocalDateTime.now(businessClock);
        CashShift shift = CashShift.builder().status(CashShiftStatus.OPEN).openedByUser(currentUser())
                .openedAt(now).openingBalance(request.openingBalance()).createdAt(now).updatedAt(now).build();
        try { return toResponse(cashShiftRepository.saveAndFlush(shift)); }
        catch (DataIntegrityViolationException exception) { throw new BusinessException("Ja existe um turno de caixa aberto"); }
    }

    @Transactional
    public CashShiftResponse addMovement(Long id, CashMovementRequest request) {
        CashShift shift = findByIdForUpdate(id);
        ensureOpen(shift);
        validateMovement(request);
        LocalDateTime now = LocalDateTime.now(businessClock);
        cashMovementRepository.saveAndFlush(CashMovement.builder().cashShift(shift).type(request.type())
                .amount(request.amount()).note(request.note().trim()).createdByUser(currentUser())
                .occurredAt(now).createdAt(now).updatedAt(now).build());
        shift.setUpdatedAt(now);
        return toResponse(shift);
    }

    @Transactional
    public CashShiftResponse close(Long id, CloseCashShiftRequest request) {
        CashShift shift = findByIdForUpdate(id);
        ensureOpen(shift);
        LocalDateTime now = LocalDateTime.now(businessClock);
        ShiftTotals totals = totals(shift, now);
        BigDecimal difference = request.countedCash().subtract(totals.expectedCash());
        String note = normalize(request.note());
        if (difference.signum() != 0 && note == null) throw new BusinessException("Informe uma observacao para justificar a divergencia do caixa");
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
        return new CashShiftResponse(shift.getId(), shift.getStatus(), shift.getOpenedByUser().getId(),
                shift.getOpenedByUser().getName(), shift.getOpenedAt(), shift.getOpeningBalance(),
                shift.getClosedByUser() == null ? null : shift.getClosedByUser().getId(),
                shift.getClosedByUser() == null ? null : shift.getClosedByUser().getName(), shift.getClosedAt(),
                totals.receivedTotal(), totals.receivedByMethod(), totals.cancellationAmount(),
                totals.supplyAmount(), totals.withdrawalAmount(),
                shift.getExpectedCash() == null ? totals.expectedCash() : shift.getExpectedCash(),
                shift.getCountedCash(), shift.getDifferenceAmount(), shift.getClosingNote(), totals.movements());
    }

    private ShiftTotals totals(CashShift shift, LocalDateTime end) {
        List<Payment> payments = paymentRepository.findAllByCashShiftIdOrderByPaidAtAsc(shift.getId());
        List<CashMovement> manual = cashMovementRepository.findAllByCashShiftIdOrderByOccurredAtAsc(shift.getId());
        List<SaleItem> cancellations = saleItemRepository
                .findAllByCancelledAtGreaterThanEqualAndCancelledAtLessThanOrderByCancelledAtAsc(shift.getOpenedAt(), end);
        EnumMap<PaymentMethod, BigDecimal> byMethod = new EnumMap<>(PaymentMethod.class);
        for (PaymentMethod method : PaymentMethod.values()) byMethod.put(method, BigDecimal.ZERO);
        payments.forEach(payment -> byMethod.merge(payment.getMethod(), payment.getAmount(), BigDecimal::add));
        BigDecimal received = payments.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal supply = movementTotal(manual, CashMovementType.SUPPLY);
        BigDecimal withdrawal = movementTotal(manual, CashMovementType.WITHDRAWAL);
        BigDecimal cancelled = cancellations.stream().map(SaleItem::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal expected = shift.getOpeningBalance().add(byMethod.get(PaymentMethod.CASH)).add(supply).subtract(withdrawal);
        List<CashMovementResponse> movements = new ArrayList<>();
        payments.stream().map(this::paymentMovement).forEach(movements::add);
        manual.stream().map(this::manualMovement).forEach(movements::add);
        cancellationMovements(cancellations).forEach(movements::add);
        movements.sort(Comparator.comparing(CashMovementResponse::occurredAt));
        return new ShiftTotals(received, Map.copyOf(byMethod), cancelled, supply, withdrawal, expected, List.copyOf(movements));
    }

    private List<CashMovementResponse> cancellationMovements(List<SaleItem> items) {
        return items.stream().collect(Collectors.groupingBy(item -> item.getSale().getId())).values().stream().map(group -> {
            SaleItem first = group.getFirst();
            BigDecimal amount = group.stream().map(SaleItem::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
            return new CashMovementResponse("CANCELLATION-" + first.getSale().getId(), "CANCELLATION",
                    origin(first.getSale()), amount, null,
                    first.getCancelledByUser() == null ? "Sistema" : first.getCancelledByUser().getName(),
                    "Venda #" + first.getSale().getId(), first.getCancellationReason(), first.getCancelledAt());
        }).toList();
    }

    private CashMovementResponse paymentMovement(Payment payment) {
        return new CashMovementResponse("PAYMENT-" + payment.getId(), "PAYMENT", origin(payment.getSale()),
                payment.getAmount(), payment.getMethod(), payment.getReceivedByUser().getName(),
                "Pagamento #" + payment.getId(), null, payment.getPaidAt());
    }

    private CashMovementResponse manualMovement(CashMovement movement) {
        return new CashMovementResponse("CASH-" + movement.getId(), movement.getType().name(),
                movement.getType() == CashMovementType.SUPPLY ? "Suprimento" : "Sangria", movement.getAmount(),
                PaymentMethod.CASH, movement.getCreatedByUser().getName(), "Movimentacao #" + movement.getId(),
                movement.getNote(), movement.getOccurredAt());
    }

    private String origin(Sale sale) {
        return sale.getType() == SaleType.COUNTER ? "Balcao #" + sale.getId()
                : sale.getTableNumber() == null ? "Mesa sem numero" : "Mesa " + sale.getTableNumber();
    }

    private BigDecimal movementTotal(List<CashMovement> values, CashMovementType type) { return values.stream().filter(value -> value.getType() == type).map(CashMovement::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add); }
    private CashShift findById(Long id) { return cashShiftRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Turno de caixa nao encontrado")); }
    private CashShift findByIdForUpdate(Long id) { return cashShiftRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Turno de caixa nao encontrado")); }
    private void ensureOpen(CashShift shift) { if (shift.getStatus() != CashShiftStatus.OPEN) throw new BusinessException("O turno de caixa ja esta fechado"); }
    private void validateMovement(CashMovementRequest request) {
        if (request == null || request.type() == null) throw new BusinessException("Tipo da movimentacao e obrigatorio");
        if (request.amount() == null || request.amount().signum() <= 0) throw new BusinessException("Valor da movimentacao deve ser maior que zero");
        String note = normalize(request.note());
        if (note == null) throw new BusinessException("Observacao da movimentacao e obrigatoria");
        if (note.length() > 500) throw new BusinessException("Observacao da movimentacao deve ter no maximo 500 caracteres");
    }
    private User currentUser() { return authenticatedUserProvider.currentUser().orElseThrow(() -> new BusinessException("Usuario autenticado e obrigatorio")); }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private record ShiftTotals(BigDecimal receivedTotal, Map<PaymentMethod, BigDecimal> receivedByMethod,
            BigDecimal cancellationAmount, BigDecimal supplyAmount, BigDecimal withdrawalAmount,
            BigDecimal expectedCash, List<CashMovementResponse> movements) { }
}
