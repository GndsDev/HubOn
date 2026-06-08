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

        RestaurantTable table = RestaurantTable.builder()
                .number(request.number())
                .name(request.name())
                .status(request.status())
                .active(request.active())
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

        table.setNumber(request.number());
        table.setName(request.name());
        table.setStatus(request.status() == null ? table.getStatus() : request.status());
        table.setActive(request.active() == null ? table.getActive() : request.active());

        return toResponse(table);
    }

    @Transactional
    public RestaurantTableResponse updateStatus(Long id, TableStatusRequest request) {
        RestaurantTable table = findEntityById(id);
        boolean hasOpenTab = tabRepository.existsByRestaurantTableIdAndStatus(id, TabStatus.OPEN);
        if (hasOpenTab && request.status() == TableStatus.DISABLED) {
            throw new BusinessException("Mesa com comanda aberta não pode ser desativada");
        }

        table.setStatus(request.status());
        if (request.status() == TableStatus.DISABLED) {
            table.setActive(false);
        }

        return toResponse(table);
    }

    @Transactional(readOnly = true)
    public RestaurantTable findEntityById(Long id) {
        return tableRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Mesa não encontrada"));
    }

    private RestaurantTableResponse toResponse(RestaurantTable table) {
        return new RestaurantTableResponse(
                table.getId(),
                table.getNumber(),
                table.getName(),
                table.getStatus(),
                table.getActive(),
                table.getCreatedAt(),
                table.getUpdatedAt()
        );
    }
}
