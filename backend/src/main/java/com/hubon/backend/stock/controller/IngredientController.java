package com.hubon.backend.stock.controller;

import com.hubon.backend.stock.dto.IngredientRequest;
import com.hubon.backend.stock.dto.IngredientResponse;
import com.hubon.backend.stock.service.IngredientService;
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
@RequestMapping("/api/ingredients")
@RequiredArgsConstructor
public class IngredientController {

    private final IngredientService ingredientService;

    @GetMapping
    public List<IngredientResponse> listAll() {
        return ingredientService.listAll();
    }

    @GetMapping("/active")
    public List<IngredientResponse> listActive() {
        return ingredientService.listActive();
    }

    @GetMapping("/alerts")
    public List<IngredientResponse> listAlerts() {
        return ingredientService.listAlerts();
    }

    @GetMapping("/{id}")
    public IngredientResponse getById(@PathVariable Long id) {
        return ingredientService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IngredientResponse create(@Valid @RequestBody IngredientRequest request) {
        return ingredientService.create(request);
    }

    @PutMapping("/{id}")
    public IngredientResponse update(@PathVariable Long id, @Valid @RequestBody IngredientRequest request) {
        return ingredientService.update(id, request);
    }

    @PatchMapping("/{id}/activate")
    public IngredientResponse activate(@PathVariable Long id) {
        return ingredientService.activate(id);
    }

    @PatchMapping("/{id}/deactivate")
    public IngredientResponse deactivate(@PathVariable Long id) {
        return ingredientService.deactivate(id);
    }
}
