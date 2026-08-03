package com.hubon.backend.report.controller;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.AnnualReportResponse;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import com.hubon.backend.report.service.MonthlyReportService;
import com.hubon.backend.report.service.ReportPdfService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
    private final ReportPdfService reportPdfService;
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

    @GetMapping("/annual")
    public AnnualReportResponse annual(
            @RequestParam(required = false) Integer year,
            @RequestParam(defaultValue = "ALL") ReportChannel channel
    ) {
        LocalDate today = LocalDate.now(businessClock);
        return monthlyReportService.generateAnnual(year == null ? today.getYear() : year, channel);
    }

    @GetMapping(value = "/monthly/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> monthlyPdf(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(defaultValue = "ALL") ReportChannel channel
    ) {
        MonthlyReportResponse report = monthly(year, month, channel);
        String filename = "hubon-relatorio-mensal-%d-%02d.pdf".formatted(report.year(), report.month());
        return pdf(reportPdfService.monthly(report), filename);
    }

    @GetMapping(value = "/annual/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> annualPdf(
            @RequestParam(required = false) Integer year,
            @RequestParam(defaultValue = "ALL") ReportChannel channel
    ) {
        AnnualReportResponse report = annual(year, channel);
        return pdf(reportPdfService.annual(report), "hubon-relatorio-anual-%d.pdf".formatted(report.year()));
    }

    private ResponseEntity<byte[]> pdf(byte[] content, String filename) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(content.length)
                .body(content);
    }
}
