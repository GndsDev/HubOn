import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccessibleDialogDirective } from '../../directives/accessible-dialog.directive';
import { Product, ProductOption, ProductOptionGroup } from '../../models/product.model';
import { AddSaleItemRequest } from '../../models/sale.model';
import { activeOptionGroups, optionSelectionIsValid, productRequiresChoice } from '../../util/sale-workflow';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'app-sale-product-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, AccessibleDialogDirective, EmptyStateComponent],
  template: `
    <div class="counter-catalog-toolbar">
      <div class="counter-search-row">
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

        <div class="counter-catalog-status">
          @if (confirmationMessage) {
            <span class="counter-inline-feedback" role="status" aria-live="polite">
              <i class="pi pi-check-circle"></i>
              {{ confirmationMessage }}
            </span>
          }
          <span class="counter-product-count">
            {{ filteredProducts().length }} produto{{ filteredProducts().length === 1 ? '' : 's' }}
          </span>
        </div>
      </div>

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
            [attr.aria-label]="'Adicionar ' + product.name + ', ' + currency(product.price)"
            [attr.aria-busy]="busyProductId === product.id"
          >
            <span class="counter-product-category">{{ product.categoryName || 'Sem categoria' }}</span>

            <span class="counter-product-copy">
              <strong>{{ product.name }}</strong>
              <small>{{ product.description || 'Sem descrição' }}</small>
            </span>

            <span class="counter-product-footer">
              <span>
                <i [class]="hasOptionalChoices(product) ? 'pi pi-sliders-h' : 'pi pi-plus'"></i>
                {{ hasOptionalChoices(product) ? 'Escolher' : 'Adicionar' }}
              </span>
              <b>{{ currency(product.price) }}</b>
            </span>
          </button>
        }
      </div>
    }

    @if (selectedProduct(); as product) {
      <div class="modal-backdrop choice-dialog-backdrop" (click)="closeChoices()">
        <form
          class="choice-dialog"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="choice-dialog-title"
          [attr.aria-describedby]="product.description ? 'choice-dialog-description' : null"
          (dialogClose)="closeChoices()"
          (click)="$event.stopPropagation()"
          (ngSubmit)="confirmChoices()"
        >
          <header class="choice-dialog-header">
            <div class="choice-dialog-product">
              <span class="choice-dialog-category">{{ product.categoryName || 'Produto' }}</span>

              <div class="choice-dialog-title-row">
                <h2 id="choice-dialog-title">{{ product.name }}</h2>
                <div class="choice-dialog-price">
                  <small>{{ priceCaption(product) }}</small>
                  <strong>{{ currency(product.price) }}</strong>
                </div>
              </div>

              @if (product.description) {
                <p id="choice-dialog-description">{{ product.description }}</p>
              }
            </div>

            <button type="button" class="icon-button choice-dialog-close" aria-label="Fechar escolhas" (click)="closeChoices()">
              <i class="pi pi-times"></i>
            </button>
          </header>

          <div class="choice-dialog-content">
            @for (group of choiceGroups(); track group.id) {
              <fieldset class="choice-group">
                <legend class="visually-hidden">{{ group.name }}</legend>

                <div class="choice-group-header">
                  <h3>{{ group.name }}</h3>
                  <p>{{ rule(group) }}</p>
                </div>

                <div class="choice-options" [class.choice-options-skewers]="isSkewerGroup(group)">
                  @for (option of group.options; track option.id) {
                    <label class="choice-option" [class.choice-option-selected]="selectedIds.includes(option.id)">
                      <input
                        [type]="group.maximumSelections === 1 ? 'radio' : 'checkbox'"
                        [name]="'group-' + group.id"
                        [checked]="selectedIds.includes(option.id)"
                        [disabled]="disabled || busyProductId === product.id"
                        (change)="toggleChoice(group, option.id)"
                      />
                      <span class="choice-option-name">{{ option.name }}</span>
                      <strong class="choice-option-price">{{ choicePriceLabel(product, group, option) }}</strong>
                    </label>
                  }
                </div>
              </fieldset>
            }

            <div class="choice-observation">
              <label for="choice-dialog-notes">
                <span>Observação</span>
                <small>Opcional</small>
              </label>
              <textarea
                id="choice-dialog-notes"
                name="saleItemNotes"
                rows="2"
                maxlength="500"
                placeholder="Ex.: sem cebola"
                [(ngModel)]="notes"
              ></textarea>
            </div>
          </div>

          <footer class="choice-dialog-footer">
            <button type="button" class="ghost-button" (click)="closeChoices()">Voltar</button>
            <button
              type="submit"
              class="primary-button"
              [disabled]="disabled || busyProductId === product.id || !selectionValid()"
            >
              <i class="pi pi-plus"></i>
              {{ confirmLabel }}
            </button>
          </footer>
        </form>
      </div>
    }
  `,
})
export class SaleProductPickerComponent {
  @Input({ required: true }) products: Product[] = [];
  @Input() disabled = false;
  @Input() busyProductId: number | null = null;
  @Input() confirmationMessage = '';
  @Input() confirmLabel = 'Adicionar';
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
      .sort((a, b) => {
        const categoryOrder = (a.categoryName ?? '').localeCompare(b.categoryName ?? '', 'pt-BR');
        return categoryOrder || a.name.localeCompare(b.name, 'pt-BR');
      });
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
    const requirement = group.minimumSelections > 0 ? 'Obrigatório' : 'Opcional';
    const limit = group.maximumSelections === 1 ? 'escolha 1' : `até ${group.maximumSelections} escolhas`;
    return `${requirement} · ${limit}`;
  }

  isSkewerGroup(group: ProductOptionGroup): boolean {
    return this.normalized(group.name).includes('espeto');
  }

  choicePriceLabel(product: Product, group: ProductOptionGroup, option: ProductOption): string {
    if (this.normalized(group.name) === 'tamanho') {
      return this.currency(product.price + option.additionalPrice);
    }
    return option.additionalPrice > 0 ? `Acréscimo ${this.currency(option.additionalPrice)}` : 'Incluso';
  }

  priceCaption(product: Product): string {
    const hasPriceVariation = activeOptionGroups(product)
      .some((group) => group.options.some((option) => option.additionalPrice > 0));
    return hasPriceVariation ? 'A partir de' : 'Preço';
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  private normalized(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  }
}
