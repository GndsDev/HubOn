package com.hubon.backend.sale.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.payment.repository.PaymentRepository;
import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.domain.ProductOption;
import com.hubon.backend.product.repository.ProductRepository;
import com.hubon.backend.product.service.ProductOptionService;
import com.hubon.backend.sale.domain.*;
import com.hubon.backend.sale.dto.*;
import com.hubon.backend.sale.repository.SaleItemOptionRepository;
import com.hubon.backend.sale.repository.SaleItemRepository;
import com.hubon.backend.sale.repository.SaleRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.service.StockMovementService;
import com.hubon.backend.table.domain.RestaurantTable;
import com.hubon.backend.table.repository.RestaurantTableRepository;
import com.hubon.backend.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SaleService {
    private final SaleRepository saleRepository;
    private final SaleItemRepository itemRepository;
    private final SaleItemOptionRepository itemOptionRepository;
    private final PaymentRepository paymentRepository;
    private final ProductRepository productRepository;
    private final RestaurantTableRepository tableRepository;
    private final ProductOptionService productOptionService;
    private final StockMovementService stockMovementService;
    private final SaleValueService valueService;
    private final SaleLifecycleService lifecycleService;
    private final SaleQueryService queryService;
    private final AuthenticatedUserProvider authenticatedUserProvider;
    private final Clock businessClock;

    @Transactional
    public SaleResponse open(OpenSaleRequest request) {
        RestaurantTable table = null;
        Integer tableNumber = null;
        if (request.type() == SaleType.TABLE) {
            if (request.restaurantTableId() == null) throw new BusinessException("Mesa e obrigatoria para venda de mesa");
            table = tableRepository.findByIdForUpdate(request.restaurantTableId())
                    .orElseThrow(() -> new ResourceNotFoundException("Mesa nao encontrada"));
            if (!Boolean.TRUE.equals(table.getActive())) throw new BusinessException("Mesa inativa nao pode receber venda");
            if (saleRepository.existsByRestaurantTableIdAndStatus(table.getId(), SaleStatus.OPEN)) {
                throw new BusinessException("Mesa ja possui uma venda aberta");
            }
            tableNumber = table.getNumber();
        } else if (request.restaurantTableId() != null) {
            throw new BusinessException("Venda de balcao nao pode possuir mesa");
        }
        Sale sale = Sale.builder().type(request.type()).restaurantTable(table).tableNumberSnapshot(tableNumber)
                .customerName(normalize(request.customerName())).customerPhone(normalize(request.customerPhone()))
                .status(SaleStatus.OPEN).serviceFee(valueOrZero(request.serviceFee()))
                .discountAmount(valueOrZero(request.discountAmount())).openedByUser(currentUser())
                .openedAt(LocalDateTime.now(businessClock)).build();
        try {
            return queryService.toResponse(saleRepository.saveAndFlush(sale));
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException("Mesa ja possui uma venda aberta");
        }
    }

    @Transactional
    public SaleResponse addItem(Long saleId, AddSaleItemRequest request) {
        Sale sale = findForUpdate(saleId);
        lifecycleService.ensureOpen(sale);
        ensureWithoutPayment(saleId);
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ResourceNotFoundException("Produto nao encontrado"));
        if (!Boolean.TRUE.equals(product.getActive()) || !Boolean.TRUE.equals(product.getAvailable())) {
            throw new BusinessException("Produto inativo ou indisponivel nao pode ser vendido");
        }
        if (request.quantity() == null || request.quantity() <= 0) throw new BusinessException("Quantidade deve ser maior que zero");
        List<ProductOption> options = productOptionService.validateSelections(product.getId(), request.optionIds());
        BigDecimal optionTotal = options.stream().map(ProductOption::getAdditionalPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal unitPrice = product.getPrice().add(optionTotal);
        User user = currentUser();
        SaleItem item = itemRepository.save(SaleItem.builder().sale(sale).product(product)
                .productNameSnapshot(product.getName())
                .categoryNameSnapshot(product.getCategory() == null ? null : product.getCategory().getName())
                .baseUnitPriceSnapshot(product.getPrice()).unitPriceSnapshot(unitPrice)
                .quantity(request.quantity()).subtotal(unitPrice.multiply(BigDecimal.valueOf(request.quantity())))
                .notes(normalize(request.notes())).createdByUser(user).createdAt(LocalDateTime.now(businessClock)).build());
        itemOptionRepository.saveAll(options.stream().map(option -> SaleItemOption.builder().saleItem(item)
                .productOption(option).optionGroupNameSnapshot(option.getGroup().getName())
                .optionNameSnapshot(option.getName()).additionalPriceSnapshot(option.getAdditionalPrice())
                .createdAt(LocalDateTime.now(businessClock)).build()).toList());
        stockMovementService.applySale(item, user);
        return queryService.toResponse(sale);
    }

    @Transactional
    public SaleResponse cancelItem(Long saleId, Long itemId, CancellationRequest request) {
        Sale sale = findForUpdate(saleId);
        SaleItem item = itemRepository.findByIdAndSaleIdForUpdate(itemId, saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Item da venda nao encontrado"));
        if (!item.isActive()) return queryService.toResponse(sale);
        lifecycleService.ensureOpen(sale);
        ensureWithoutPayment(saleId);
        cancelItem(item, request.reason(), currentUser());
        return queryService.toResponse(sale);
    }

    @Transactional
    public SaleResponse cancel(Long saleId, CancellationRequest request) {
        Sale sale = findForUpdate(saleId);
        lifecycleService.ensureOpen(sale);
        ensureWithoutPayment(saleId);
        User user = currentUser();
        itemRepository.findAllBySaleIdOrderByCreatedAtAscIdAsc(saleId).stream()
                .filter(SaleItem::isActive).forEach(item -> cancelItem(item, request.reason(), user));
        LocalDateTime now = LocalDateTime.now(businessClock);
        sale.setStatus(SaleStatus.CANCELLED);
        sale.setCancelledByUser(user);
        sale.setCancelledAt(now);
        sale.setCancellationReason(request.reason().trim());
        return queryService.toResponse(sale);
    }

    @Transactional
    public SaleResponse close(Long saleId) {
        Sale sale = findForUpdate(saleId);
        lifecycleService.close(sale, valueService.calculate(sale), currentUser());
        return queryService.toResponse(sale);
    }

    private void cancelItem(SaleItem item, String reason, User user) {
        item.setCancelledAt(LocalDateTime.now(businessClock));
        item.setCancelledByUser(user);
        item.setCancellationReason(reason.trim());
        stockMovementService.reverseSale(item, user);
    }

    private Sale findForUpdate(Long id) {
        return saleRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Venda nao encontrada"));
    }

    private void ensureWithoutPayment(Long saleId) {
        if (paymentRepository.existsBySaleId(saleId)) throw new BusinessException("Venda com pagamento nao pode ter itens alterados ou ser cancelada");
    }

    private User currentUser() {
        return authenticatedUserProvider.currentUser().orElseThrow(() -> new BusinessException("Usuario autenticado e obrigatorio"));
    }

    private BigDecimal valueOrZero(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
