package com.hubon.backend.report.controller;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import com.hubon.backend.report.service.MonthlyReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class MonthlyReportController {

    private final MonthlyReportService monthlyReportService;
    private final Clock businessClock;

    @GetMapping("/monthly")
    public MonthlyReportResponse monthly(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(defaultValue = "ALL") ReportChannel channel
    ) {
        LocalDate today = LocalDate.now(businessClock);
        return monthlyReportService.generate(
                year == null ? today.getYear() : year,
                month == null ? today.getMonthValue() : month,
                channel
        );
    }
}
