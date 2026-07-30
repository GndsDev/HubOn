package com.hubon.backend.tab.dto;

import com.hubon.backend.order.dto.RestaurantOrderResponse;

import java.util.List;

public record CounterSaleDetailResponse(
        CounterSaleSummaryResponse summary,
        String customerPhone,
        String identificationNote,
        List<RestaurantOrderResponse> orders
) {
}
