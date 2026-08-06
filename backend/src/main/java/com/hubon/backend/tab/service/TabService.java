package com.hubon.backend.tab.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.repository.RestaurantOrderRepository;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.domain.TabType;
import com.hubon.backend.tab.dto.OpenCounterTabRequest;
import com.hubon.backend.tab.dto.OpenTabRequest;
import com.hubon.backend.tab.dto.TabResponse;
import com.hubon.backend.tab.dto.UpdateCounterTabRequest;
import com.hubon.backend.tab.repository.TabRepository;
import com.hubon.backend.table.domain.RestaurantTable;
import com.hubon.backend.table.domain.TableStatus;
import com.hubon.backend.table.repository.RestaurantTableRepository;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TabService {

    private final TabRepository tabRepository;
    private final RestaurantTableRepository tableRepository;
    private final UserRepository userRepository;
    private final RestaurantOrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final TabAccountingService accountingService;
    private final AuthenticatedUserProvider authenticatedUserProvider;
    private final Clock businessClock;

    @Transactional(readOnly = true)
    public List<TabResponse> listOpen() {
        return tabRepository.findAllByStatusOrderByOpenedAtDesc(TabStatus.OPEN)
                .stream()
                .filter(this::canCurrentUserAccess)
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TabResponse getById(Long id) {
        Tab tab = findEntityById(id);
        ensureCurrentUserCanAccess(tab);
        accountingService.refreshAmounts(tab);
        return toResponse(tab);
    }

    @Transactional(readOnly = true)
    public TabResponse getCurrentByTable(Long tableId) {
        Tab tab = tabRepository.findFirstByRestaurantTableIdAndStatus(tableId, TabStatus.OPEN)
                .orElseThrow(() -> new ResourceNotFoundException("Mesa não possui comanda aberta"));
        accountingService.refreshAmounts(tab);
        return toResponse(tab);
    }

    @Transactional
    public TabResponse open(OpenTabRequest request) {
        RestaurantTable table = request.tableId() == null
                ? null
                : tableRepository.findById(request.tableId())
                .orElseThrow(() -> new ResourceNotFoundException("Mesa não encontrada"));
        Integer tableNumber = tableNumberForOpening(request, table);
        User openedByUser = authenticatedUserProvider.currentUser()
                .orElseGet(() -> findRequestedUser(request.openedByUserId()));

        if (table != null && (!Boolean.TRUE.equals(table.getActive()) || table.getStatus() == TableStatus.DISABLED)) {
            throw new BusinessException("Mesa desativada não pode abrir comanda");
        }

        if (table != null && table.getStatus() == TableStatus.OCCUPIED) {
            throw new BusinessException("Mesa ocupada não pode abrir outra comanda");
        }

        if (table != null && table.getStatus() == TableStatus.RESERVED) {
            throw new BusinessException("Mesa reservada não pode abrir comanda diretamente.");
        }

        if (tabRepository.existsByTypeAndStatusAndTableNumber(TabType.TABLE, TabStatus.OPEN, tableNumber)) {
            throw duplicateTableTab(tableNumber);
        }

        if (table != null && tabRepository.existsByRestaurantTableIdAndStatus(table.getId(), TabStatus.OPEN)) {
            throw duplicateTableTab(tableNumber);
        }

        Tab tab = Tab.builder()
                .restaurantTable(table)
                .tableNumber(tableNumber)
                .type(TabType.TABLE)
                .openedByUser(openedByUser)
                .status(TabStatus.OPEN)
                .openedAt(LocalDateTime.now(businessClock))
                .serviceFee(valueOrZero(request.serviceFee()))
                .discountAmount(valueOrZero(request.discountAmount()))
                .totalAmount(BigDecimal.ZERO)
                .finalAmount(BigDecimal.ZERO)
                .build();

        Tab savedTab;
        try {
            savedTab = tabRepository.saveAndFlush(tab);
        } catch (DataIntegrityViolationException exception) {
            throw duplicateTableTab(tableNumber);
        }
        accountingService.refreshAmounts(savedTab);

        if (table != null) {
            table.setStatus(TableStatus.OCCUPIED);
        }

        return toResponse(savedTab);
    }

    @Transactional
    public TabResponse openCounter(OpenCounterTabRequest request) {
        if (request.tableNumber() != null) {
            throw new BusinessException("Atendimento de balcão não deve informar número de mesa");
        }
        User openedByUser = authenticatedUserProvider.currentUser()
                .orElseThrow(() -> new BusinessException("Usuário autenticado é obrigatório"));

        Tab tab = Tab.builder()
                .type(TabType.COUNTER)
                .openedByUser(openedByUser)
                .status(TabStatus.OPEN)
                .openedAt(LocalDateTime.now(businessClock))
                .customerName(normalizeOptional(request.customerName()))
                .customerPhone(normalizeOptional(request.customerPhone()))
                .identificationNote(normalizeOptional(request.identificationNote()))
                .serviceFee(valueOrZero(request.serviceFee()))
                .discountAmount(valueOrZero(request.discountAmount()))
                .totalAmount(BigDecimal.ZERO)
                .finalAmount(BigDecimal.ZERO)
                .build();

        Tab savedTab = tabRepository.save(tab);
        accountingService.refreshAmounts(savedTab);
        return toResponse(savedTab);
    }

    @Transactional
    public TabResponse updateCounter(Long id, UpdateCounterTabRequest request) {
        Tab tab = findEntityByIdForUpdate(id);
        ensureCurrentUserCanAccess(tab);
        ensureCounter(tab);
        ensureOpen(tab);
        tab.setCustomerName(normalizeOptional(request.customerName()));
        tab.setCustomerPhone(normalizeOptional(request.customerPhone()));
        tab.setIdentificationNote(normalizeOptional(request.identificationNote()));
        accountingService.refreshAmounts(tab);
        return toResponse(tab);
    }

    @Transactional
    public TabResponse close(Long id) {
        return close(id, TabType.TABLE);
    }

    @Transactional
    public TabResponse closeCounter(Long id) {
        return close(id, TabType.COUNTER);
    }

    private TabResponse close(Long id, TabType expectedType) {
        Tab tab = findEntityByIdForUpdate(id);
        ensureCurrentUserCanAccess(tab);
        ensureType(tab, expectedType);
        if (tab.getStatus() == TabStatus.CLOSED) {
            accountingService.refreshAmounts(tab);
            return toResponse(tab);
        }
        ensureOpen(tab);
        ensureNotEmpty(tab);
        ensureNoPendingOrders(tab);
        accountingService.refreshAmounts(tab);

        BigDecimal paidAmount = accountingService.paidAmount(tab.getId());
        int paymentComparison = paidAmount.compareTo(tab.getFinalAmount());
        if (paymentComparison < 0) {
            throw new BusinessException("Comanda não pode ser fechada sem pagamento completo");
        }
        if (paymentComparison > 0) {
            throw new BusinessException("Não é possível fechar uma comanda com pagamento excedente");
        }

        tab.setStatus(TabStatus.CLOSED);
        tab.setClosedAt(LocalDateTime.now(businessClock));
        tab.setClosedBusinessDate(LocalDate.now(businessClock));
        releaseTable(tab);

        return toResponse(tab);
    }

    @Transactional
    public TabResponse cancel(Long id) {
        Tab tab = findEntityByIdForUpdate(id);
        ensureCurrentUserCanAccess(tab);
        ensureOpen(tab);
        ensureNoPayments(tab);
        ensureNoDeliveredOrders(tab);
        ensureNoPendingOrders(tab);

        tab.setStatus(TabStatus.CANCELLED);
        tab.setClosedAt(LocalDateTime.now(businessClock));
        tab.setClosedBusinessDate(LocalDate.now(businessClock));
        releaseTable(tab);

        return toResponse(tab);
    }

    @Transactional(readOnly = true)
    public Tab findEntityById(Long id) {
        return tabRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Comanda não encontrada"));
    }

    private Tab findEntityByIdForUpdate(Long id) {
        return tabRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Comanda não encontrada"));
    }

    public TabResponse toResponse(Tab tab) {
        BigDecimal paidAmount = accountingService.paidAmount(tab.getId());
        BigDecimal remainingAmount = valueOrZero(tab.getFinalAmount()).subtract(paidAmount).max(BigDecimal.ZERO);
        RestaurantTable table = tab.getRestaurantTable();

        return new TabResponse(
                tab.getId(),
                tab.getType(),
                table == null ? null : table.getId(),
                tableNumber(tab),
                table == null ? null : table.getName(),
                tab.getCustomerName(),
                tab.getCustomerPhone(),
                tab.getIdentificationNote(),
                displayLabel(tab),
                tab.getStatus(),
                tab.getOpenedByUser().getId(),
                tab.getOpenedByUser().getName(),
                tab.getOpenedAt(),
                tab.getClosedAt(),
                tab.getTotalAmount(),
                tab.getServiceFee(),
                tab.getDiscountAmount(),
                tab.getFinalAmount(),
                paidAmount,
                remainingAmount
        );
    }

    private String displayLabel(Tab tab) {
        if (tab.getType() == TabType.COUNTER) {
            String customer = normalizeOptional(tab.getCustomerName());
            return customer == null ? "Balcão #" + tab.getId() : "Balcão #" + tab.getId() + " - " + customer;
        }
        RestaurantTable table = tab.getRestaurantTable();
        Integer number = tableNumber(tab);
        if (number == null) {
            return "Mesa sem número";
        }
        if (table == null || table.getName() == null || table.getName().isBlank()) {
            return "Mesa " + number;
        }
        return "Mesa " + number + " - " + table.getName();
    }

    private void releaseTable(Tab tab) {
        if (tab.getRestaurantTable() != null) {
            tab.getRestaurantTable().setStatus(TableStatus.AVAILABLE);
        }
    }

    private void ensureOpen(Tab tab) {
        if (tab.getStatus() != TabStatus.OPEN) {
            throw new BusinessException("Comanda fechada ou cancelada não pode ser alterada");
        }
    }

    private void ensureCounter(Tab tab) {
        if (tab.getType() != TabType.COUNTER) {
            throw new BusinessException("A comanda informada não é um atendimento de balcão");
        }
    }

    private void ensureType(Tab tab, TabType expectedType) {
        if (expectedType == TabType.TABLE && tab.getType() != TabType.TABLE) {
            throw new BusinessException("Use a finalização de balcão para encerrar este atendimento");
        }
        if (expectedType == TabType.COUNTER && tab.getType() != TabType.COUNTER) {
            throw new BusinessException("Use Comandas para fechar atendimentos de mesa");
        }
    }

    private boolean canCurrentUserAccess(Tab tab) {
        return tab.getType() != TabType.COUNTER
                || authenticatedUserProvider.currentUser().isEmpty()
                || authenticatedUserProvider.currentUserHasAnyRole("OWNER", "ADMIN", "CASHIER");
    }

    private void ensureCurrentUserCanAccess(Tab tab) {
        if (!canCurrentUserAccess(tab)) {
            throw new AccessDeniedException("Acesso ao atendimento de balcão não permitido");
        }
    }

    private void ensureNoPendingOrders(Tab tab) {
        boolean hasPendingOrders = orderRepository.existsByTabIdAndStatusNotIn(
                tab.getId(),
                List.of(OrderStatus.DELIVERED, OrderStatus.CANCELLED)
        );
        if (hasPendingOrders) {
            throw new BusinessException("Finalize ou cancele os pedidos pendentes antes de encerrar a comanda");
        }
    }

    private void ensureNotEmpty(Tab tab) {
        boolean hasConfirmedOrder = orderRepository.existsByTabIdAndStatusNotIn(
                tab.getId(),
                List.of(OrderStatus.CREATED, OrderStatus.CANCELLED)
        );
        if (!hasConfirmedOrder) {
            throw new BusinessException("Comanda vazia não pode ser fechada. Cancele a comanda vazia.");
        }
    }

    private void ensureNoPayments(Tab tab) {
        if (paymentRepository.existsByTabId(tab.getId())) {
            throw new BusinessException("Não é possível cancelar uma comanda com pagamentos registrados.");
        }
    }

    private void ensureNoDeliveredOrders(Tab tab) {
        if (orderRepository.existsByTabIdAndStatus(tab.getId(), OrderStatus.DELIVERED)) {
            throw new BusinessException("Não é possível cancelar uma comanda com pedidos entregues.");
        }
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private Integer tableNumber(Tab tab) {
        if (tab.getTableNumber() != null) {
            return tab.getTableNumber();
        }
        RestaurantTable table = tab.getRestaurantTable();
        return table == null ? null : table.getNumber();
    }

    private Integer tableNumberForOpening(OpenTabRequest request, RestaurantTable table) {
        Integer requestedNumber = request.tableNumber();
        Integer legacyNumber = table == null ? null : table.getNumber();
        if (requestedNumber != null && legacyNumber != null && !requestedNumber.equals(legacyNumber)) {
            throw new BusinessException("Número da mesa não corresponde à mesa informada");
        }
        Integer tableNumber = requestedNumber == null ? legacyNumber : requestedNumber;
        if (tableNumber == null) {
            throw new BusinessException("Informe o número da mesa para abrir a comanda");
        }
        if (tableNumber <= 0) {
            throw new BusinessException("Número da mesa deve ser maior que zero");
        }
        return tableNumber;
    }

    private BusinessException duplicateTableTab(Integer tableNumber) {
        return new BusinessException("Já existe uma comanda aberta para a Mesa " + tableNumber + ".");
    }

    private String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private User findRequestedUser(Long userId) {
        if (userId == null) {
            throw new BusinessException("Usuário responsável é obrigatório");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));
    }
}
