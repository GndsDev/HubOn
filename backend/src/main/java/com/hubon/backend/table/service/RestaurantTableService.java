package com.hubon.backend.table.service;

import com.hubon.backend.sale.domain.SaleStatus;
import com.hubon.backend.sale.repository.SaleRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.table.domain.RestaurantTable;
import com.hubon.backend.table.dto.RestaurantTableRequest;
import com.hubon.backend.table.dto.RestaurantTableResponse;
import com.hubon.backend.table.dto.RestaurantTableState;
import com.hubon.backend.table.repository.RestaurantTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RestaurantTableService {
    private final RestaurantTableRepository tableRepository;
    private final SaleRepository saleRepository;

    @Transactional(readOnly = true) public List<RestaurantTableResponse> listAll() { return tableRepository.findAllByOrderByNumberAsc().stream().map(this::toResponse).toList(); }
    @Transactional(readOnly = true) public RestaurantTableResponse getById(Long id) { return toResponse(findEntityById(id)); }

    @Transactional
    public RestaurantTableResponse create(RestaurantTableRequest request) {
        if (tableRepository.existsByNumber(request.number())) throw new BusinessException("Ja existe uma mesa com este numero");
        return toResponse(tableRepository.save(RestaurantTable.builder().number(request.number())
                .label(normalize(request.label())).active(request.active()).build()));
    }

    @Transactional
    public RestaurantTableResponse update(Long id, RestaurantTableRequest request) {
        RestaurantTable table = tableRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Mesa nao encontrada"));
        tableRepository.findByNumber(request.number()).filter(existing -> !existing.getId().equals(id)).ifPresent(existing -> {
            throw new BusinessException("Ja existe uma mesa com este numero");
        });
        boolean occupied = saleRepository.existsByRestaurantTableIdAndStatus(id, SaleStatus.OPEN);
        boolean requestedActive = request.active() == null ? Boolean.TRUE.equals(table.getActive()) : request.active();
        if (occupied && (!table.getNumber().equals(request.number()) || !requestedActive)) {
            throw new BusinessException("Mesa com venda aberta nao pode ser renumerada ou desativada");
        }
        table.setNumber(request.number());
        table.setLabel(normalize(request.label()));
        table.setActive(requestedActive);
        return toResponse(table);
    }

    @Transactional(readOnly = true)
    public RestaurantTable findEntityById(Long id) { return tableRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Mesa nao encontrada")); }

    private RestaurantTableResponse toResponse(RestaurantTable table) {
        boolean occupied = Boolean.TRUE.equals(table.getActive())
                && saleRepository.existsByRestaurantTableIdAndStatus(table.getId(), SaleStatus.OPEN);
        RestaurantTableState state = !Boolean.TRUE.equals(table.getActive()) ? RestaurantTableState.DISABLED
                : occupied ? RestaurantTableState.OCCUPIED : RestaurantTableState.FREE;
        return new RestaurantTableResponse(table.getId(), table.getNumber(), table.getLabel(), state,
                table.getActive(), table.getCreatedAt(), table.getUpdatedAt());
    }

    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
