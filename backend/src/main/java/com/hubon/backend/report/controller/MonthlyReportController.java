package com.hubon.backend.report.controller;

import com.hubon.backend.report.domain.ReportChannel;
import com.hubon.backend.report.dto.AnnualReportResponse;
import com.hubon.backend.report.dto.DailyReportResponse;
import com.hubon.backend.report.dto.MonthlyReportResponse;
import com.hubon.backend.report.service.MonthlyReportService;
import com.hubon.backend.report.service.ReportPdfService;
import com.hubon.backend.report.service.ReportWorkbookService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.Clock;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class MonthlyReportController {

    private static final MediaType XLSX_MEDIA_TYPE = MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final MonthlyReportService monthlyReportService;
    private final ReportPdfService reportPdfService;
    private final ReportWorkbookService reportWorkbookService;
    private final Clock businessClock;

    @GetMapping("/daily")
    public DailyReportResponse daily(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "ALL") ReportChannel channel
    ) {
        return monthlyReportService.generateDaily(
                date == null ? LocalDate.now(businessClock) : date,
                channel
        );
    }

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

    @GetMapping(value = "/daily/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> dailyPdf(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "ALL") ReportChannel channel
    ) {
        DailyReportResponse report = daily(date, channel);
        return pdf(reportPdfService.daily(report), "hubon-relatorio-diario-%s.pdf".formatted(report.date()));
    }

    @GetMapping(value = "/annual/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> annualPdf(
            @RequestParam(required = false) Integer year,
            @RequestParam(defaultValue = "ALL") ReportChannel channel
    ) {
        AnnualReportResponse report = annual(year, channel);
        return pdf(reportPdfService.annual(report), "hubon-relatorio-anual-%d.pdf".formatted(report.year()));
    }

    @GetMapping(value = "/daily/xlsx")
    public ResponseEntity<byte[]> dailyXlsx(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "ALL") ReportChannel channel
    ) {
        DailyReportResponse report = daily(date, channel);
        return xlsx(reportWorkbookService.daily(report), "hubon-relatorio-diario-%s.xlsx".formatted(report.date()));
    }

    @GetMapping(value = "/monthly/xlsx")
    public ResponseEntity<byte[]> monthlyXlsx(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(defaultValue = "ALL") ReportChannel channel
    ) {
        MonthlyReportResponse report = monthly(year, month, channel);
        String filename = "hubon-relatorio-mensal-%d-%02d.xlsx".formatted(report.year(), report.month());
        return xlsx(reportWorkbookService.monthly(report), filename);
    }

    @GetMapping(value = "/annual/xlsx")
    public ResponseEntity<byte[]> annualXlsx(
            @RequestParam(required = false) Integer year,
            @RequestParam(defaultValue = "ALL") ReportChannel channel
    ) {
        AnnualReportResponse report = annual(year, channel);
        return xlsx(reportWorkbookService.annual(report), "hubon-relatorio-anual-%d.xlsx".formatted(report.year()));
    }

    private ResponseEntity<byte[]> pdf(byte[] content, String filename) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(content.length)
                .body(content);
    }

    private ResponseEntity<byte[]> xlsx(byte[] content, String filename) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(XLSX_MEDIA_TYPE)
                .contentLength(content.length)
                .body(content);
    }
}
