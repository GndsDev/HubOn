import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccessibleDialogDirective } from '../../directives/accessible-dialog.directive';
import { Product, ProductOptionGroup } from '../../models/product.model';
import { AddSaleItemRequest } from '../../models/sale.model';
import { activeOptionGroups, optionSelectionIsValid, productRequiresChoice } from '../../util/sale-workflow';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'app-sale-product-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, AccessibleDialogDirective, EmptyStateComponent],
  template: `
    <div class="counter-catalog-toolbar">
      <label class="search-box">
        <i class="pi pi-search"></i>
        <input
          type="search"
          placeholder="Buscar produto"
          [(ngModel)]="searchTerm"
          aria-label="Buscar produto"
          [disabled]="disabled"
        />
      </label>

      <nav class="counter-category-filter-shell" aria-label="Filtrar produtos por categoria">
        <div class="segmented-control counter-category-filter">
          <button
            type="button"
            title="Todos"
            [class.active]="category === 'ALL'"
            [attr.aria-pressed]="category === 'ALL'"
            (click)="category = 'ALL'"
          >
            Todos
          </button>

          @for (name of categories(); track name) {
            <button
              type="button"
              [title]="name"
              [class.active]="category === name"
              [attr.aria-pressed]="category === name"
              (click)="category = name"
            >
              {{ name }}
            </button>
          }
        </div>
      </nav>
    </div>

    @if (filteredProducts().length === 0) {
      <app-empty-state
        icon="pi pi-shopping-bag"
        title="Nenhum produto disponível"
        description="Ajuste a busca ou a disponibilidade do cardápio."
      />
    } @else {
      <div class="counter-product-grid">
        @for (product of filteredProducts(); track product.id) {
          <button
            type="button"
            class="counter-product"
            (click)="select(product)"
            [disabled]="disabled || busyProductId === product.id"
          >
            <span>{{ product.categoryName || 'Sem categoria' }}</span>
            <strong>{{ product.name }}</strong>
            <small>
              {{ hasOptionalChoices(product) ? 'Possui escolhas' : product.description || 'Adicionar à venda' }}
            </small>
            <b>{{ currency(product.price) }}</b>
          </button>
        }
      </div>
    }

    @if (selectedProduct(); as product) {
      <div class="modal-backdrop" (click)="closeChoices()">
        <form
          class="modal-panel compact"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="choice-dialog-title"
          (dialogClose)="closeChoices()"
          (click)="$event.stopPropagation()"
          (ngSubmit)="confirmChoices()"
        >
          <div class="modal-header">
            <div class="modal-heading">
              <span class="modal-eyebrow">{{ product.categoryName || 'Produto' }}</span>
              <h2 id="choice-dialog-title">{{ product.name }}</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar opções" (click)="closeChoices()">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="modal-body">
            @for (group of choiceGroups(); track group.id) {
              <fieldset class="counter-option-group">
                <legend>
                  {{ group.name }}
                  <small>{{ rule(group) }}</small>
                </legend>

                @for (option of group.options; track option.id) {
                  <label>
                    <input
                      [type]="group.maximumSelections === 1 ? 'radio' : 'checkbox'"
                      [name]="'group-' + group.id"
                      [checked]="selectedIds.includes(option.id)"
                      (change)="toggleChoice(group, option.id)"
                    />
                    <span>{{ option.name }}</span>
                    <b>{{ option.additionalPrice > 0 ? '+' + currency(option.additionalPrice) : 'Incluso' }}</b>
                  </label>
                }
              </fieldset>
            }

            <label class="field">
              <span>Observação <small>opcional</small></span>
              <input name="saleItemNotes" maxlength="500" [(ngModel)]="notes" />
            </label>
          </div>

          <div class="modal-footer modal-actions">
            <button type="button" class="ghost-button" (click)="closeChoices()">Voltar</button>
            <button type="submit" class="primary-button" [disabled]="!selectionValid()">
              <i class="pi pi-plus"></i>
              Adicionar
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class SaleProductPickerComponent {
  @Input({ required: true }) products: Product[] = [];
  @Input() disabled = false;
  @Input() busyProductId: number | null = null;
  @Output() readonly addItem = new EventEmitter<AddSaleItemRequest>();

  readonly selectedProduct = signal<Product | null>(null);
  readonly choiceGroups = computed(() => this.selectedProduct() ? activeOptionGroups(this.selectedProduct()!) : []);
  searchTerm = '';
  category = 'ALL';
  selectedIds: number[] = [];
  notes = '';

  categories(): string[] {
    return [...new Set(this.products.map((product) => product.categoryName).filter((name): name is string => Boolean(name)))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  filteredProducts(): Product[] {
    const query = this.normalized(this.searchTerm);
    return this.products
      .filter((product) => product.active && product.available)
      .filter((product) => this.category === 'ALL' || product.categoryName === this.category)
      .filter((product) => !query || this.normalized(product.name).includes(query))
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'pt-BR'));
  }

  select(product: Product): void {
    if (!product.available) return;
    if (this.hasOptionalChoices(product)) this.openChoices(product);
    else this.addItem.emit({ productId: product.id, quantity: 1, notes: null, optionIds: [] });
  }

  openChoices(product: Product): void {
    if (!product.available) return;
    this.selectedProduct.set(product);
    this.selectedIds = [];
    this.notes = '';
  }

  closeChoices(): void {
    this.selectedProduct.set(null);
  }

  requiresChoice(product: Product): boolean {
    return productRequiresChoice(product);
  }

  hasOptionalChoices(product: Product): boolean {
    return activeOptionGroups(product).length > 0;
  }

  selectionValid(): boolean {
    return optionSelectionIsValid(this.choiceGroups(), this.selectedIds);
  }

  toggleChoice(group: ProductOptionGroup, optionId: number): void {
    const groupIds = group.options.map((option) => option.id);
    if (group.maximumSelections === 1) {
      this.selectedIds = [...this.selectedIds.filter((id) => !groupIds.includes(id)), optionId];
      return;
    }

    if (this.selectedIds.includes(optionId)) {
      this.selectedIds = this.selectedIds.filter((id) => id !== optionId);
      return;
    }

    const selectedInGroup = this.selectedIds.filter((id) => groupIds.includes(id));
    if (selectedInGroup.length < group.maximumSelections) {
      this.selectedIds = [...this.selectedIds, optionId];
    }
  }

  confirmChoices(): void {
    const product = this.selectedProduct();
    if (!product || !this.selectionValid()) return;

    this.addItem.emit({
      productId: product.id,
      quantity: 1,
      notes: this.notes.trim() || null,
      optionIds: [...this.selectedIds],
    });
    this.closeChoices();
  }

  rule(group: ProductOptionGroup): string {
    if (group.minimumSelections === group.maximumSelections) return `Escolha ${group.minimumSelections}`;
    if (group.minimumSelections === 0) return `Até ${group.maximumSelections}`;
    return `${group.minimumSelections} a ${group.maximumSelections}`;
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  private normalized(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  }
}
