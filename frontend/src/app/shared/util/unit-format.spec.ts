import { describe, expect, it } from 'vitest';
import { formatStockValue, unitLabel } from './unit-format';

describe('unit formatter', () => {
  it('maps every persisted unit to its presentation label', () => {
    expect(unitLabel('KG')).toBe('kg');
    expect(unitLabel('G')).toBe('g');
    expect(unitLabel('L')).toBe('L');
    expect(unitLabel('ML')).toBe('mL');
    expect(unitLabel('UN')).toBe('UN');
    expect(unitLabel('CX')).toBe('CX');
    expect(unitLabel('PACKAGE')).toBe('Pacote');
    expect(unitLabel('TRAY')).toBe('Bandeja');
  });

  it('formats balances with pt-BR precision and the unit label', () => {
    expect(formatStockValue(12.3456, 'KG')).toBe('12,346 kg');
    expect(formatStockValue(2, 'UN')).toBe('2 UN');
  });
});
