package com.hubon.backend.tab.controller;

import com.hubon.backend.tab.dto.OpenTabRequest;
import com.hubon.backend.tab.dto.TabResponse;
import com.hubon.backend.tab.service.TabService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TabController {

    private final TabService tabService;

    @GetMapping("/tabs/open")
    public List<TabResponse> listOpen() {
        return tabService.listOpen();
    }

    @GetMapping("/tabs/{id}")
    public TabResponse getById(@PathVariable Long id) {
        return tabService.getById(id);
    }

    @PostMapping("/tabs/open")
    @ResponseStatus(HttpStatus.CREATED)
    public TabResponse open(@Valid @RequestBody OpenTabRequest request) {
        return tabService.open(request);
    }

    @PostMapping("/tabs/{id}/close")
    public TabResponse close(@PathVariable Long id) {
        return tabService.close(id);
    }

    @PostMapping("/tabs/{id}/cancel")
    public TabResponse cancel(@PathVariable Long id) {
        return tabService.cancel(id);
    }

    @GetMapping("/tables/{tableId}/current-tab")
    public TabResponse getCurrentByTable(@PathVariable Long tableId) {
        return tabService.getCurrentByTable(tableId);
    }
}
