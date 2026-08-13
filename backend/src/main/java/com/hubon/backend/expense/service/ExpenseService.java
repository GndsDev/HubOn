package com.hubon.backend.expense.service;

import com.hubon.backend.auth.service.AuthenticatedUserProvider;
import com.hubon.backend.expense.domain.*;
import com.hubon.backend.expense.dto.*;
import com.hubon.backend.expense.repository.ExpenseRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.StockMovement;
import com.hubon.backend.stock.service.StockMovementService;
import com.hubon.backend.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ExpenseService {
    private final ExpenseRepository repository;
    private final StockMovementService stockMovementService;
    private final AuthenticatedUserProvider authenticatedUserProvider;
    private final Clock businessClock;

    @Transactional(readOnly = true)
    public ExpenseListResponse list(
            LocalDate from,
            LocalDate to,
            ExpenseCategory category,
            ExpenseStatus status,
            ExpensePaymentMethod paymentMethod,
            String search
    ) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new BusinessException("A data inicial deve ser anterior ou igual à data final");
        }
        List<Expense> expenses = repository.findAll(
                filters(from, to, category, status, paymentMethod, search),
                Sort.by(Sort.Order.desc("expenseDate"), Sort.Order.desc("id")));
        return new ExpenseListResponse(summary(expenses), expenses.stream().map(this::toResponse).toList());
    }

    @Transactional(readOnly = true)
    public ExpenseResponse getById(Long id) {
        return toResponse(findById(id));
    }

    @Transactional
    public ExpenseResponse create(ExpenseRequest request) {
        ValidatedExpense values = validate(request);
        User user = currentUser();
        LocalDateTime now = LocalDateTime.now(businessClock);
        Expense expense = Expense.builder()
                .expenseDate(request.expenseDate())
                .description(request.description().trim())
                .category(request.category())
                .supplier(normalize(request.supplier()))
                .valueMode(request.valueMode())
                .quantity(values.quantity())
                .unit(request.unit())
                .unitPrice(values.unitPrice())
                .totalAmount(values.totalAmount())
                .paymentMethod(request.paymentMethod())
                .status(request.status())
                .createdByUser(user)
                .createdAt(now)
                .updatedAt(now)
                .build();

        repository.saveAndFlush(expense);
        if (values.generateStockEntry()) {
            StockMovement movement = stockMovementService.entryForExpense(
                    request.stockItemId(), values.stockQuantity(), "Compra / Despesa #" + expense.getId(), user);
            expense.setStockItem(movement.getStockItem());
            expense.setStockQuantity(values.stockQuantity());
            expense.setStockMovement(movement);
        }
        return toResponse(expense);
    }

    @Transactional
    public ExpenseResponse update(Long id, ExpenseRequest request) {
        Expense expense = findById(id);
        ValidatedExpense values = validate(request);
        if (expense.getStockMovement() != null) {
            assertStockHistoryUnchanged(expense, request, values);
        }

        expense.setExpenseDate(request.expenseDate());
        expense.setDescription(request.description().trim());
        expense.setCategory(request.category());
        expense.setSupplier(normalize(request.supplier()));
        expense.setPaymentMethod(request.paymentMethod());
        expense.setStatus(request.status());

        if (expense.getStockMovement() == null) {
            expense.setValueMode(request.valueMode());
            expense.setQuantity(values.quantity());
            expense.setUnit(request.unit());
            expense.setUnitPrice(values.unitPrice());
            expense.setTotalAmount(values.totalAmount());
            if (values.generateStockEntry()) {
                StockMovement movement = stockMovementService.entryForExpense(
                        request.stockItemId(), values.stockQuantity(), "Compra / Despesa #" + expense.getId(), currentUser());
                expense.setStockItem(movement.getStockItem());
                expense.setStockQuantity(values.stockQuantity());
                expense.setStockMovement(movement);
            }
        }
        expense.setUpdatedAt(LocalDateTime.now(businessClock));
        return toResponse(expense);
    }

    private ValidatedExpense validate(ExpenseRequest request) {
        BigDecimal quantity = scaled(request.quantity(), 3);
        BigDecimal unitPrice = scaled(request.unitPrice(), 2);
        BigDecimal total;
        if (request.valueMode() == ExpenseValueMode.DIRECT) {
            if (request.quantity() != null || request.unit() != null || request.unitPrice() != null) {
                throw new BusinessException("No valor direto, informe somente o valor total");
            }
            total = positive(request.totalAmount(), "O valor total deve ser maior que zero", 2);
        } else {
            quantity = positive(quantity, "A quantidade deve ser maior que zero", 3);
            unitPrice = positive(unitPrice, "O preço unitário deve ser maior que zero", 2);
            if (request.unit() == null) throw new BusinessException("A unidade é obrigatória na compra detalhada");
            total = quantity.multiply(unitPrice).setScale(2, RoundingMode.HALF_UP);
            if (total.signum() <= 0) throw new BusinessException("O valor total deve ser maior que zero");
        }

        boolean stockEntry = Boolean.TRUE.equals(request.generateStockEntry());
        BigDecimal stockQuantity = scaled(request.stockQuantity(), 3);
        if (stockEntry) {
            if (request.stockItemId() == null) throw new BusinessException("Selecione um item de estoque");
            stockQuantity = positive(stockQuantity, "A quantidade de entrada deve ser maior que zero", 3);
        } else if (request.stockItemId() != null || request.stockQuantity() != null) {
            throw new BusinessException("Ative a entrada no estoque para informar item e quantidade");
        }
        return new ValidatedExpense(quantity, unitPrice, total, stockEntry, stockQuantity);
    }

    private void assertStockHistoryUnchanged(
            Expense expense,
            ExpenseRequest request,
            ValidatedExpense values
    ) {
        boolean unchanged = values.generateStockEntry()
                && Objects.equals(expense.getValueMode(), request.valueMode())
                && decimalsEqual(expense.getQuantity(), values.quantity())
                && Objects.equals(expense.getUnit(), request.unit())
                && decimalsEqual(expense.getUnitPrice(), values.unitPrice())
                && decimalsEqual(expense.getTotalAmount(), values.totalAmount())
                && Objects.equals(expense.getStockItem().getId(), request.stockItemId())
                && decimalsEqual(expense.getStockQuantity(), values.stockQuantity());
        if (!unchanged) {
            throw new BusinessException("Não é possível alterar valores ou estoque de uma despesa que já gerou entrada");
        }
    }

    private ExpenseSummaryResponse summary(List<Expense> expenses) {
        BigDecimal total = sum(expenses);
        BigDecimal paid = sum(expenses.stream().filter(expense -> expense.getStatus() == ExpenseStatus.PAID).toList());
        BigDecimal pending = sum(expenses.stream().filter(expense -> expense.getStatus() == ExpenseStatus.PENDING).toList());
        BigDecimal stock = sum(expenses.stream().filter(expense -> expense.getStockMovement() != null).toList());
        return new ExpenseSummaryResponse(total, paid, pending, stock, expenses.size());
    }

    private Specification<Expense> filters(
            LocalDate from,
            LocalDate to,
            ExpenseCategory category,
            ExpenseStatus status,
            ExpensePaymentMethod paymentMethod,
            String search
    ) {
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (from != null) predicates.add(builder.greaterThanOrEqualTo(root.get("expenseDate"), from));
            if (to != null) predicates.add(builder.lessThanOrEqualTo(root.get("expenseDate"), to));
            if (category != null) predicates.add(builder.equal(root.get("category"), category));
            if (status != null) predicates.add(builder.equal(root.get("status"), status));
            if (paymentMethod != null) predicates.add(builder.equal(root.get("paymentMethod"), paymentMethod));
            String term = normalizeSearch(search);
            if (!term.isEmpty()) {
                String pattern = "%" + term.toLowerCase(Locale.ROOT) + "%";
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("description")), pattern),
                        builder.like(builder.lower(root.get("supplier")), pattern)
                ));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private BigDecimal sum(List<Expense> expenses) {
        return expenses.stream().map(Expense::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Expense findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Despesa não encontrada"));
    }

    private User currentUser() {
        return authenticatedUserProvider.currentUser()
                .orElseThrow(() -> new BusinessException("Usuário autenticado é obrigatório"));
    }

    private ExpenseResponse toResponse(Expense expense) {
        return new ExpenseResponse(
                expense.getId(), expense.getExpenseDate(), expense.getDescription(), expense.getCategory(),
                expense.getSupplier(), expense.getValueMode(), expense.getQuantity(), expense.getUnit(),
                expense.getUnitPrice(), expense.getTotalAmount(), expense.getPaymentMethod(), expense.getStatus(),
                expense.getStockItem() == null ? null : expense.getStockItem().getId(),
                expense.getStockItem() == null ? null : expense.getStockItem().getName(),
                expense.getStockItem() == null ? null : expense.getStockItem().getUnit(),
                expense.getStockQuantity(),
                expense.getStockMovement() == null ? null : expense.getStockMovement().getId(),
                expense.getCreatedByUser().getId(), expense.getCreatedByUser().getName(),
                expense.getCreatedAt(), expense.getUpdatedAt());
    }

    private BigDecimal positive(BigDecimal value, String message, int scale) {
        if (value == null || value.signum() <= 0) throw new BusinessException(message);
        return value.setScale(scale, RoundingMode.UNNECESSARY);
    }

    private BigDecimal scaled(BigDecimal value, int scale) {
        return value == null ? null : value.setScale(scale, RoundingMode.UNNECESSARY);
    }

    private boolean decimalsEqual(BigDecimal left, BigDecimal right) {
        return left == null ? right == null : right != null && left.compareTo(right) == 0;
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String normalizeSearch(String value) {
        return value == null || value.isBlank() ? "" : value.trim();
    }

    private record ValidatedExpense(
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal totalAmount,
            boolean generateStockEntry,
            BigDecimal stockQuantity
    ) {
    }
}
