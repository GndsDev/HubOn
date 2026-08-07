import { UnitOfMeasure } from '../models/stock.model';

export function unitLabel(unit: UnitOfMeasure): string {
  return {
    KG: 'kg',
    G: 'g',
    L: 'L',
    ML: 'mL',
    UN: 'UN',
    CX: 'CX',
    PACKAGE: 'Pacote',
    TRAY: 'Bandeja',
  }[unit];
}

export function formatStockValue(value: number, unit?: UnitOfMeasure): string {
  const number = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
  return unit ? `${number} ${unitLabel(unit)}` : number;
}
