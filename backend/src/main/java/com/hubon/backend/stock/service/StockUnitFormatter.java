package com.hubon.backend.stock.service;

import com.hubon.backend.stock.domain.UnitOfMeasure;

public final class StockUnitFormatter {

    private StockUnitFormatter() {
    }

    public static String label(UnitOfMeasure unit) {
        if (unit == null) {
            return "";
        }
        return switch (unit) {
            case KG -> "kg";
            case G -> "g";
            case L -> "L";
            case ML -> "mL";
            case UN -> "UN";
            case CX -> "CX";
            case PACKAGE -> "Pacote";
            case TRAY -> "Bandeja";
        };
    }
}
