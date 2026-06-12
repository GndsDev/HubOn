package com.hubon.backend.table.service;

import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.tab.domain.TabStatus;
import com.hubon.backend.tab.repository.TabRepository;
import com.hubon.backend.table.domain.RestaurantTable;
import com.hubon.backend.table.domain.TableStatus;
import com.hubon.backend.table.dto.RestaurantTableRequest;
import com.hubon.backend.table.dto.RestaurantTableResponse;
import com.hubon.backend.table.dto.TableStatusRequest;
import com.hubon.backend.table.repository.RestaurantTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RestaurantTableService {

    private final RestaurantTableRepository tableRepository;
    private final TabRepository tabRepository;

    @Transactional(readOnly = true)
    public List<RestaurantTableResponse> listAll() {
        return tableRepository.findAllByOrderByNumberAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public RestaurantTableResponse getById(Long id) {
        return toResponse(findEntityById(id));
    }

    @Transactional
    public RestaurantTableResponse create(RestaurantTableRequest request) {
        if (tableRepository.existsByNumber(request.number())) {
            throw new BusinessException("Já existe uma mesa com este número");
        }

        validateManualStatus(request.status());
        TableStatus status = normalizedStatus(
                request.status() == null ? TableStatus.AVAILABLE : request.status(),
                request.active() == null || request.active()
        );
        RestaurantTable table = RestaurantTable.builder()
                .number(request.number())
                .name(request.name())
                .status(status)
                .active(status != TableStatus.DISABLED)
                .build();

        return toResponse(tableRepository.save(table));
    }

    @Transactional
    public RestaurantTableResponse update(Long id, RestaurantTableRequest request) {
        RestaurantTable table = findEntityById(id);
        tableRepository.findByNumber(request.number())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BusinessException("Já existe uma mesa com este número");
                });

        validateManualStatus(request.status());
        TableStatus requestedStatus = normalizedStatus(
                request.status() == null ? table.getStatus() : request.status(),
                request.active() == null ? table.getActive() : request.active()
        );
        validateManualStatus(requestedStatus);
        validateStatusChange(table, requestedStatus);

        table.setNumber(request.number());
        table.setName(request.name());
        table.setStatus(requestedStatus);
        table.setActive(requestedStatus != TableStatus.DISABLED);

        return toResponse(table);
    }

    @Transactional
    public RestaurantTableResponse updateStatus(Long id, TableStatusRequest request) {
        RestaurantTable table = findEntityById(id);
        validateManualStatus(request.status());
        validateStatusChange(table, request.status());

        table.setStatus(request.status());
        table.setActive(request.status() != TableStatus.DISABLED);

        return toResponse(table);
    }

    private TableStatus normalizedStatus(TableStatus status, Boolean active) {
        return status == TableStatus.DISABLED || !Boolean.TRUE.equals(active)
                ? TableStatus.DISABLED
                : status;
    }

    private void validateManualStatus(TableStatus status) {
        if (status == TableStatus.OCCUPIED) {
            throw new BusinessException("Status OCCUPIED é controlado pelo ciclo da comanda");
        }
    }

    private void validateStatusChange(RestaurantTable table, TableStatus requestedStatus) {
        if (table.getStatus() == TableStatus.OCCUPIED && requestedStatus == TableStatus.DISABLED) {
            throw new BusinessException("Mesa ocupada não pode ser desativada");
        }

        boolean hasOpenTab = tabRepository.existsByRestaurantTableIdAndStatus(table.getId(), TabStatus.OPEN);
        if (hasOpenTab && requestedStatus != TableStatus.OCCUPIED) {
            throw new BusinessException("Mesa com comanda aberta deve permanecer ocupada");
        }
    }

    @Transactional(readOnly = true)
    public RestaurantTable findEntityById(Long id) {
        return tableRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Mesa não encontrada"));
    }

    private RestaurantTableResponse toResponse(RestaurantTable table) {
        TableStatus status = normalizedStatus(table.getStatus(), table.getActive());
        return new RestaurantTableResponse(
                table.getId(),
                table.getNumber(),
                table.getName(),
                status,
                status != TableStatus.DISABLED,
                table.getCreatedAt(),
                table.getUpdatedAt()
        );
    }
}
