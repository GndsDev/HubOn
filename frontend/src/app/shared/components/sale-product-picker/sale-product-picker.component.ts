import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccessibleDialogDirective } from '../../directives/accessible-dialog.directive';
import { Product, ProductOptionGroup } from '../../models/product.model';
import { AddSaleItemRequest } from '../../models/sale.model';
import { activeOptionGroups, optionSelectionIsValid, productRequiresChoice } from '../../util/sale-workflow';

@Component({
  selector: 'app-sale-product-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, AccessibleDialogDirective],
  template: `
    <section class="sale-picker" aria-label="Adicionar produtos">
      <label class="sale-search"><i class="pi pi-search"></i><input type="search" placeholder="Pesquisar produto..." [(ngModel)]="searchTerm" aria-label="Pesquisar produto" [disabled]="disabled" /></label>
      <nav class="sale-categories" aria-label="Categorias">
        <button type="button" [class.active]="category === 'ALL'" (click)="category = 'ALL'">Todos</button>
        @for (name of categories(); track name) { <button type="button" [class.active]="category === name" (click)="category = name">{{ name }}</button> }
      </nav>
      <div class="sale-product-grid">
        @for (product of filteredProducts(); track product.id) {
          <article class="sale-product" [class.busy]="busyProductId === product.id">
            <button type="button" class="sale-product-main" (click)="select(product)" [disabled]="disabled || busyProductId === product.id">
              <span><strong>{{ product.name }}</strong><small>{{ product.categoryName || 'Sem categoria' }}</small></span>
              <b>{{ currency(product.price) }}</b>
            </button>
            @if (hasOptionalChoices(product) && !requiresChoice(product)) {
              <button type="button" class="sale-product-options" title="Personalizar" [attr.aria-label]="'Personalizar ' + product.name" (click)="openChoices(product)" [disabled]="disabled"><i class="pi pi-sliders-h"></i></button>
            }
          </article>
        } @empty { <p class="sale-picker-empty">Nenhum produto encontrado.</p> }
      </div>
    </section>

    @if (selectedProduct(); as product) {
      <div class="modal-backdrop">
        <form class="modal-panel compact choice-dialog" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="choice-dialog-title" (dialogClose)="closeChoices()" (ngSubmit)="confirmChoices()">
          <div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">{{ currency(product.price) }}</span><h2 id="choice-dialog-title">{{ product.name }}</h2></div><button type="button" class="icon-button" aria-label="Fechar opções" (click)="closeChoices()"><i class="pi pi-times"></i></button></div>
          <div class="modal-body choice-groups">
            @for (group of choiceGroups(); track group.id) {
              <fieldset class="choice-group"><legend><strong>{{ group.name }}</strong><small>{{ rule(group) }}</small></legend><div class="choice-options">@for (option of group.options; track option.id) { <label [class.selected]="selectedIds.includes(option.id)"><input [type]="group.maximumSelections === 1 ? 'radio' : 'checkbox'" [name]="'group-' + group.id" [checked]="selectedIds.includes(option.id)" (change)="toggleChoice(group, option.id)" /><span>{{ option.name }}</span><b>{{ option.additionalPrice > 0 ? '+' + currency(option.additionalPrice) : 'Incluso' }}</b></label> }</div></fieldset>
            }
            <label class="field"><span>Observação <small>opcional</small></span><input name="saleItemNotes" maxlength="500" [(ngModel)]="notes" /></label>
          </div>
          <div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="closeChoices()">Voltar</button><button type="submit" class="primary-button" [disabled]="!selectionValid()"><i class="pi pi-plus"></i>Adicionar</button></div>
        </form>
      </div>
    }
  `,
  styles: `
    .sale-picker { display: grid; gap: .75rem; min-width: 0; }
    .sale-search { min-height: 2.9rem; display: flex; align-items: center; gap: .65rem; padding: 0 .9rem; border: 1px solid var(--border-default); border-radius: 6px; background: var(--surface-raised); }
    .sale-search input { width: 100%; border: 0; outline: 0; background: transparent; color: var(--text-primary); font: inherit; }
    .sale-categories { display: flex; gap: .35rem; overflow-x: auto; padding-bottom: .1rem; }
    .sale-categories button { flex: 0 0 auto; border: 1px solid var(--border-subtle); border-radius: 5px; padding: .5rem .75rem; background: var(--surface-raised); color: var(--text-secondary); cursor: pointer; }
    .sale-categories button.active { border-color: var(--primary); color: var(--primary); background: var(--primary-soft); }
    .sale-product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: .55rem; }
    .sale-product { position: relative; min-height: 5.25rem; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-raised); overflow: hidden; }
    .sale-product:focus-within, .sale-product:hover { border-color: var(--primary); }
    .sale-product-main { width: 100%; height: 100%; min-height: 5.25rem; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: .5rem; padding: .75rem; border: 0; background: transparent; color: var(--text-primary); text-align: left; cursor: pointer; }
    .sale-product-main span { display: grid; gap: .15rem; padding-right: 1.5rem; }
    .sale-product-main small { color: var(--text-muted); }
    .sale-product-main b { color: var(--primary); }
    .sale-product-options { position: absolute; top: .35rem; right: .35rem; width: 2rem; height: 2rem; border: 0; border-radius: 4px; background: var(--surface-subtle); color: var(--text-secondary); cursor: pointer; }
    .sale-product.busy { opacity: .58; }
    .sale-picker-empty { grid-column: 1 / -1; color: var(--text-muted); padding: 1rem 0; }
    .choice-groups { display: grid; gap: 1rem; max-height: 60vh; overflow: auto; }
    .choice-group { border: 0; padding: 0; margin: 0; }
    .choice-group legend { width: 100%; display: flex; justify-content: space-between; gap: 1rem; margin-bottom: .5rem; }
    .choice-group legend small { color: var(--text-muted); font-weight: 400; }
    .choice-options { display: grid; gap: .4rem; }
    .choice-options label { display: grid; grid-template-columns: auto 1fr auto; gap: .65rem; align-items: center; min-height: 2.75rem; padding: .5rem .7rem; border: 1px solid var(--border-subtle); border-radius: 5px; cursor: pointer; }
    .choice-options label.selected { border-color: var(--primary); background: var(--primary-soft); }
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
    return [...new Set(this.products.map((product) => product.categoryName).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  filteredProducts(): Product[] {
    const query = this.normalized(this.searchTerm);
    return this.products.filter((product) => product.active && product.available)
      .filter((product) => this.category === 'ALL' || product.categoryName === this.category)
      .filter((product) => !query || this.normalized(product.name).includes(query))
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'pt-BR'));
  }

  select(product: Product): void {
    if (this.requiresChoice(product)) this.openChoices(product);
    else this.addItem.emit({ productId: product.id, quantity: 1, notes: null, optionIds: [] });
  }

  openChoices(product: Product): void { this.selectedProduct.set(product); this.selectedIds = []; this.notes = ''; }
  closeChoices(): void { this.selectedProduct.set(null); }
  requiresChoice(product: Product): boolean { return productRequiresChoice(product); }
  hasOptionalChoices(product: Product): boolean { return activeOptionGroups(product).length > 0; }
  selectionValid(): boolean { return optionSelectionIsValid(this.choiceGroups(), this.selectedIds); }

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
    if (selectedInGroup.length < group.maximumSelections) this.selectedIds = [...this.selectedIds, optionId];
  }

  confirmChoices(): void {
    const product = this.selectedProduct();
    if (!product || !this.selectionValid()) return;
    this.addItem.emit({ productId: product.id, quantity: 1, notes: this.notes.trim() || null, optionIds: [...this.selectedIds] });
    this.closeChoices();
  }

  rule(group: ProductOptionGroup): string {
    if (group.minimumSelections === group.maximumSelections) return `Escolha ${group.minimumSelections}`;
    if (group.minimumSelections === 0) return `Até ${group.maximumSelections}`;
    return `${group.minimumSelections} a ${group.maximumSelections}`;
  }

  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  private normalized(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim(); }
}
