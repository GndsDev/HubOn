package com.hubon.backend.sale.service;

import com.hubon.backend.payment.domain.Payment;
import com.hubon.backend.payment.dto.PaymentResponse;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.sale.domain.*;
import com.hubon.backend.sale.dto.*;
import com.hubon.backend.sale.repository.SaleItemOptionRepository;
import com.hubon.backend.sale.repository.SaleItemRepository;
import com.hubon.backend.sale.repository.SaleRepository;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SaleQueryService {
    private final SaleRepository saleRepository;
    private final SaleItemRepository itemRepository;
    private final SaleItemOptionRepository optionRepository;
    private final PaymentRepository paymentRepository;
    private final SaleValueService valueService;

    @Transactional(readOnly = true)
    public List<SaleResponse> list(SaleStatus status, SaleType type) {
        List<Sale> sales = status != null && type != null
                ? saleRepository.findAllByTypeAndStatusOrderByOpenedAtDesc(type, status)
                : status != null ? saleRepository.findAllByStatusOrderByOpenedAtDesc(status)
                : type != null ? saleRepository.findAllByTypeOrderByOpenedAtDesc(type)
                : saleRepository.findAllByOrderByOpenedAtDesc();
        return sales.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public SaleResponse get(Long id) {
        return toResponse(saleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Venda nao encontrada")));
    }

    public SaleResponse toResponse(Sale sale) {
        List<SaleItem> items = itemRepository.findAllBySaleIdOrderByCreatedAtAscIdAsc(sale.getId()).stream()
                .filter(item -> !item.isRemoved()).toList();
        Map<Long, List<SaleItemOption>> options = items.isEmpty() ? Map.of() : optionRepository
                .findAllBySaleItemIdInOrderByIdAsc(items.stream().map(SaleItem::getId).toList())
                .stream().collect(Collectors.groupingBy(option -> option.getSaleItem().getId()));
        List<PaymentResponse> payments = paymentRepository.findAllBySaleIdOrderByPaidAtAscIdAsc(sale.getId())
                .stream().map(this::paymentResponse).toList();
        SaleAmounts amounts = valueService.calculate(sale);
        return new SaleResponse(
                sale.getId(), sale.getType(), sale.getStatus(),
                sale.getTableNumber(),
                sale.getCustomerName(), sale.getCustomerPhone(), amounts.subtotal(), sale.getServiceFee(),
                sale.getDiscountAmount(), amounts.finalAmount(), amounts.paidAmount(), amounts.remainingAmount(),
                items.stream().map(item -> itemResponse(item, options.getOrDefault(item.getId(), List.of()))).toList(),
                payments, sale.getOpenedByUser().getId(), sale.getOpenedByUser().getName(), sale.getOpenedAt(),
                sale.getClosedByUser() == null ? null : sale.getClosedByUser().getId(),
                sale.getClosedByUser() == null ? null : sale.getClosedByUser().getName(),
                sale.getClosedAt(), sale.getClosedBusinessDate(),
                sale.getCancelledByUser() == null ? null : sale.getCancelledByUser().getId(),
                sale.getCancelledByUser() == null ? null : sale.getCancelledByUser().getName(),
                sale.getCancelledAt(), sale.getCancellationReason());
    }

    private SaleItemResponse itemResponse(SaleItem item, List<SaleItemOption> options) {
        return new SaleItemResponse(item.getId(), item.getProduct().getId(), item.getProductNameSnapshot(),
                item.getCategoryNameSnapshot(), item.getBaseUnitPriceSnapshot(), item.getUnitPriceSnapshot(),
                item.getQuantity(), item.getSubtotal(), item.getNotes(),
                options.stream().map(option -> new SaleItemOptionResponse(option.getId(),
                        option.getProductOption() == null ? null : option.getProductOption().getId(),
                        option.getOptionGroupNameSnapshot(), option.getOptionNameSnapshot(),
                        option.getAdditionalPriceSnapshot())).toList(),
                item.getCreatedByUser().getId(), item.getCreatedByUser().getName(), item.getCreatedAt(),
                item.getCancelledAt(), item.getCancelledByUser() == null ? null : item.getCancelledByUser().getId(),
                item.getCancelledByUser() == null ? null : item.getCancelledByUser().getName(),
                item.getCancellationReason());
    }

    private PaymentResponse paymentResponse(Payment payment) {
        return new PaymentResponse(payment.getId(), payment.getSale().getId(), payment.getMethod(), payment.getAmount(),
                payment.getPaidAt(), payment.getReceivedByUser().getId(), payment.getReceivedByUser().getName());
    }
}
