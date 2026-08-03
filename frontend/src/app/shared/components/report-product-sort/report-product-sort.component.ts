import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ReportProductSort,
  ReportSortDirection,
} from '../../util/report-product-sort';

@Component({
  selector: 'app-report-product-sort',
  standalone: true,
  template: `
    <div class="report-product-sort" [class.report-product-sort-static]="productCount < 2">
      @if (productCount < 2) {
        <span class="report-product-count" role="status">{{ productCountLabel }}</span>
      } @else {
        <span class="report-product-count">{{ productCountLabel }}</span>
        <div class="report-product-sort-field">
          <span class="report-product-sort-label">Ordenar produtos por</span>
          <div class="report-product-sort-actions">
            <div class="segmented-control report-sort-criteria" role="group" aria-label="Ordenar produtos por">
              @for (option of sortOptions; track option.value) {
                <button
                  type="button"
                  [class.active]="sort === option.value"
                  [attr.aria-pressed]="sort === option.value"
                  (click)="selectSort(option.value)"
                >{{ option.label }}</button>
              }
            </div>
            <button
              type="button"
              class="secondary-button report-sort-direction"
              [attr.aria-label]="directionAriaLabel"
              [attr.aria-pressed]="direction === 'DESC'"
              (click)="toggleDirection()"
            >
              <i [class]="direction === 'DESC' ? 'pi pi-sort-amount-down' : 'pi pi-sort-amount-up'" aria-hidden="true"></i>
              {{ directionLabel }}
            </button>
          </div>
        </div>
        <span class="visually-hidden" aria-live="polite" aria-atomic="true">{{ announcement }}</span>
      }
    </div>
  `,
})
export class ReportProductSortComponent {
  @Input({ required: true }) productCount = 0;
  @Input({ required: true }) sort: ReportProductSort = 'REVENUE';
  @Input({ required: true }) direction: ReportSortDirection = 'DESC';
  @Output() readonly sortChange = new EventEmitter<ReportProductSort>();
  @Output() readonly directionChange = new EventEmitter<ReportSortDirection>();

  readonly sortOptions: { value: ReportProductSort; label: string }[] = [
    { value: 'REVENUE', label: 'Faturamento' },
    { value: 'QUANTITY', label: 'Quantidade' },
    { value: 'NAME', label: 'Nome' },
  ];

  get productCountLabel(): string {
    if (this.productCount === 0) return 'Nenhum produto vendido no período';
    if (this.productCount === 1) return '1 produto no período';
    return `${this.productCount} produtos no período`;
  }

  get directionLabel(): string {
    return this.direction === 'DESC' ? 'Decrescente' : 'Crescente';
  }

  get directionAriaLabel(): string {
    const current = this.direction === 'DESC' ? 'Ordem decrescente' : 'Ordem crescente';
    const next = this.direction === 'DESC' ? 'ordem crescente' : 'ordem decrescente';
    return `${current}. Alterar para ${next}.`;
  }

  get announcement(): string {
    const criterion = this.sortOptions.find((option) => option.value === this.sort)?.label.toLocaleLowerCase('pt-BR') ?? '';
    const direction = this.sort === 'NAME'
      ? this.direction === 'ASC' ? 'de A a Z' : 'de Z a A'
      : this.direction === 'DESC' ? 'do maior para o menor' : 'do menor para o maior';
    return `Produtos ordenados por ${criterion}, ${direction}.`;
  }

  selectSort(sort: ReportProductSort): void {
    if (sort !== this.sort) this.sortChange.emit(sort);
  }

  toggleDirection(): void {
    this.directionChange.emit(this.direction === 'DESC' ? 'ASC' : 'DESC');
  }
}
