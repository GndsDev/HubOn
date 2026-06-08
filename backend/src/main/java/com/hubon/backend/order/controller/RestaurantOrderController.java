package com.hubon.backend.order.controller;

import com.hubon.backend.order.dto.OrderStatusRequest;
import com.hubon.backend.order.dto.RestaurantOrderRequest;
import com.hubon.backend.order.dto.RestaurantOrderResponse;
import com.hubon.backend.order.service.RestaurantOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class RestaurantOrderController {

    private final RestaurantOrderService orderService;

    @GetMapping
    public List<RestaurantOrderResponse> listAll() {
        return orderService.listAll();
    }

    @GetMapping("/{id}")
    public RestaurantOrderResponse getById(@PathVariable Long id) {
        return orderService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RestaurantOrderResponse create(@Valid @RequestBody RestaurantOrderRequest request) {
        return orderService.create(request);
    }

    @PostMapping("/{id}/send-to-kitchen")
    public RestaurantOrderResponse sendToKitchen(@PathVariable Long id) {
        return orderService.sendToKitchen(id);
    }

    @PatchMapping("/{id}/status")
    public RestaurantOrderResponse updateStatus(@PathVariable Long id, @Valid @RequestBody OrderStatusRequest request) {
        return orderService.updateStatus(id, request);
    }

    @PostMapping("/{id}/cancel")
    public RestaurantOrderResponse cancel(@PathVariable Long id) {
        return orderService.cancel(id);
    }
}
