package com.hubon.backend.tab.service;

import com.hubon.backend.order.domain.OrderStatus;
import com.hubon.backend.order.repository.RestaurantOrderRepository;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.tab.domain.Tab;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.dto.OpenTabRequest;
import com.hubon.backend.tab.dto.TabResponse;
import com.hubon.backend.tab.repository.TabRepository;
import com.hubon.backend.table.domain.RestaurantTable;
import com.hubon.backend.table.domain.TableStatus;
import com.hubon.backend.table.repository.RestaurantTableRepository;
import com.hubon.backend.user.domain.User;
import com.hubon.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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

    @Transactional(readOnly = true)
    public List<TabResponse> listOpen() {
        return tabRepository.findAllByStatusOrderByOpenedAtDesc(TabStatus.OPEN)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TabResponse getById(Long id) {
        Tab tab = findEntityById(id);
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
        RestaurantTable table = tableRepository.findById(request.tableId())
                .orElseThrow(() -> new ResourceNotFoundException("Mesa não encontrada"));
        User openedByUser = userRepository.findById(request.openedByUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));

        if (!Boolean.TRUE.equals(table.getActive()) || table.getStatus() == TableStatus.DISABLED) {
            throw new BusinessException("Mesa desativada não pode abrir comanda");
        }

        if (table.getStatus() == TableStatus.OCCUPIED) {
            throw new BusinessException("Mesa ocupada não pode abrir outra comanda");
        }

        if (table.getStatus() == TableStatus.RESERVED) {
            throw new BusinessException("Mesa reservada não pode abrir comanda diretamente.");
        }

        if (tabRepository.existsByRestaurantTableIdAndStatus(table.getId(), TabStatus.OPEN)) {
            throw new BusinessException("Mesa já possui uma comanda aberta");
        }

        Tab tab = Tab.builder()
                .restaurantTable(table)
                .openedByUser(openedByUser)
                .status(TabStatus.OPEN)
                .openedAt(LocalDateTime.now())
                .serviceFee(valueOrZero(request.serviceFee()))
                .discountAmount(valueOrZero(request.discountAmount()))
                .totalAmount(BigDecimal.ZERO)
                .finalAmount(BigDecimal.ZERO)
                .build();

        Tab savedTab = tabRepository.save(tab);
        accountingService.refreshAmounts(savedTab);

        table.setStatus(TableStatus.OCCUPIED);

        return toResponse(savedTab);
    }

    @Transactional
    public TabResponse close(Long id) {
        Tab tab = findEntityByIdForUpdate(id);
        ensureOpen(tab);
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
        tab.setClosedAt(LocalDateTime.now());
        tab.getRestaurantTable().setStatus(TableStatus.AVAILABLE);

        return toResponse(tab);
    }

    @Transactional
    public TabResponse cancel(Long id) {
        Tab tab = findEntityByIdForUpdate(id);
        ensureOpen(tab);
        ensureNoPayments(tab);
        ensureNoDeliveredOrders(tab);
        ensureNoPendingOrders(tab);

        tab.setStatus(TabStatus.CANCELLED);
        tab.setClosedAt(LocalDateTime.now());
        tab.getRestaurantTable().setStatus(TableStatus.AVAILABLE);

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

        return new TabResponse(
                tab.getId(),
                tab.getRestaurantTable().getId(),
                tab.getRestaurantTable().getNumber(),
                tab.getRestaurantTable().getName(),
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

    private void ensureOpen(Tab tab) {
        if (tab.getStatus() != TabStatus.OPEN) {
            throw new BusinessException("Comanda fechada ou cancelada não pode ser alterada");
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
}
