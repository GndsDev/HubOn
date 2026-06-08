package com.hubon.backend.table.controller;

import com.hubon.backend.table.dto.RestaurantTableRequest;
import com.hubon.backend.table.dto.RestaurantTableResponse;
import com.hubon.backend.table.dto.TableStatusRequest;
import com.hubon.backend.table.service.RestaurantTableService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tables")
@RequiredArgsConstructor
public class RestaurantTableController {

    private final RestaurantTableService tableService;

    @GetMapping
    public List<RestaurantTableResponse> listAll() {
        return tableService.listAll();
    }

    @GetMapping("/{id}")
    public RestaurantTableResponse getById(@PathVariable Long id) {
        return tableService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RestaurantTableResponse create(@Valid @RequestBody RestaurantTableRequest request) {
        return tableService.create(request);
    }

    @PutMapping("/{id}")
    public RestaurantTableResponse update(@PathVariable Long id, @Valid @RequestBody RestaurantTableRequest request) {
        return tableService.update(id, request);
    }

    @PatchMapping("/{id}/status")
    public RestaurantTableResponse updateStatus(@PathVariable Long id, @Valid @RequestBody TableStatusRequest request) {
        return tableService.updateStatus(id, request);
    }
}
