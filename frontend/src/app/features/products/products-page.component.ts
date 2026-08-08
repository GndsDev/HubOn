import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { CategoryApiService } from '../../core/services/category-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { Category } from '../../shared/models/category.model';
import {
  Product,
  ProductOption,
  ProductOptionGroup,
  ProductOptionGroupRequest,
  ProductOptionRequest,
  ProductRequest,
} from '../../shared/models/product.model';
import { apiErrorMessage } from '../../shared/util/api-error';

interface GroupEditor {
  id: number | null;
  name: string;
  minimumSelections: number;
  maximumSelections: number;
  displayOrder: number;
  active: boolean;
}

interface OptionEditor {
  id: number | null;
  groupId: number;
  name: string;
  additionalPrice: number;
  displayOrder: number;
  active: boolean;
}

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
    AccessibleDialogDirective,
  ],
  template: `
    <app-page-header kicker="Catálogo" title="Produtos" description="Itens disponíveis para comandas e vendas de balcão.">
      <div page-actions class="page-header-actions">
        <button type="button" class="primary-button" (click)="openProduct()"><i class="pi pi-plus"></i>Novo produto</button>
      </div>
    </app-page-header>

    <app-section-card eyebrow="Catálogo" title="Produtos cadastrados">
      <label card-action class="search-box">
        <i class="pi pi-search"></i>
        <input type="search" placeholder="Buscar produto ou categoria" [(ngModel)]="searchTerm" aria-label="Buscar produto" />
      </label>

      @if (loading()) {
        <div class="loading-grid">@for (row of [1, 2, 3, 4]; track row) { <div class="loading-row"></div> }</div>
      } @else if (error()) {
        <div class="error-panel" role="alert"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar os produtos</strong><p>{{ error() }}</p></div><button type="button" class="ghost-button" (click)="load()">Tentar novamente</button></div>
      } @else if (filteredProducts().length === 0) {
        <app-empty-state icon="pi pi-box" title="Nenhum produto encontrado" description="Cadastre um produto simples para começar a vender." />
      } @else {
        <div class="simple-product-table">
          <div class="simple-product-head" aria-hidden="true"><span>Produto</span><span>Categoria</span><span>Preço</span><span>Disponibilidade</span><span>Ativo</span><span>Ações</span></div>
          @for (product of filteredProducts(); track product.id) {
            <article class="simple-product-row">
              <div class="simple-product-name"><strong>{{ product.name }}</strong>@if (product.description) { <small>{{ product.description }}</small> }</div>
              <span>{{ product.categoryName || 'Sem categoria' }}</span>
              <strong>{{ currency(product.price) }}</strong>
              <button type="button" class="availability-toggle" [class.on]="product.available" (click)="setAvailable(product)" [disabled]="busyId() === product.id" [attr.aria-label]="(product.available ? 'Marcar ' : 'Disponibilizar ') + product.name + (product.available ? ' como indisponível' : '')">
                <i [class]="product.available ? 'pi pi-check-circle' : 'pi pi-ban'"></i>{{ product.available ? 'Disponível' : 'Indisponível' }}
              </button>
              <app-status-badge [label]="product.active ? 'Ativo' : 'Inativo'" [tone]="product.active ? 'success' : 'neutral'" />
              <div class="row-actions">
                <button type="button" class="icon-button" title="Editar produto" [attr.aria-label]="'Editar ' + product.name" (click)="openProduct(product)"><i class="pi pi-pencil"></i></button>
                <button type="button" class="icon-button" title="Gerenciar opções" [attr.aria-label]="'Gerenciar opções de ' + product.name" (click)="openOptions(product)"><i class="pi pi-list-check"></i></button>
                <button type="button" class="icon-button" [title]="product.active ? 'Desativar produto' : 'Ativar produto'" [attr.aria-label]="(product.active ? 'Desativar ' : 'Ativar ') + product.name" (click)="toggleActive(product)" [disabled]="busyId() === product.id"><i [class]="product.active ? 'pi pi-pause' : 'pi pi-play'"></i></button>
              </div>
            </article>
          }
        </div>
      }
    </app-section-card>

    @if (productDialog()) {
      <div class="modal-backdrop">
        <form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="product-dialog-title" [dialogCloseDisabled]="saving()" (dialogClose)="closeProduct()" (ngSubmit)="saveProduct()">
          <div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Produto simples</span><h2 id="product-dialog-title">{{ editingProduct() ? 'Editar produto' : 'Novo produto' }}</h2></div><button type="button" class="icon-button" aria-label="Fechar cadastro" (click)="closeProduct()"><i class="pi pi-times"></i></button></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field field-span-2"><span>Nome</span><input name="productName" maxlength="120" [(ngModel)]="productForm.name" required autofocus /></label>
              <label class="field"><span>Preço</span><input name="productPrice" type="number" min="0" step="0.01" [(ngModel)]="productForm.price" required /></label>
              <label class="field"><span>Categoria <small>opcional</small></span><select name="productCategory" [(ngModel)]="productForm.categoryId"><option [ngValue]="null">Sem categoria</option>@for (category of activeCategories(); track category.id) { <option [ngValue]="category.id">{{ category.name }}</option> }</select></label>
              <label class="field field-span-2"><span>Descrição <small>opcional</small></span><textarea name="productDescription" maxlength="255" rows="2" [(ngModel)]="productForm.description"></textarea></label>
            </div>
            <div class="toggle-row">
              <label class="toggle-field"><input type="checkbox" name="productAvailable" [(ngModel)]="productForm.available" /><span>Disponível para venda</span></label>
              <label class="toggle-field"><input type="checkbox" name="productActive" [(ngModel)]="productForm.active" /><span>Produto ativo</span></label>
            </div>
          </div>
          <div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="closeProduct()">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving() || !productForm.name.trim() || productForm.price < 0"><i class="pi pi-save"></i>{{ saving() ? 'Salvando...' : 'Salvar produto' }}</button></div>
        </form>
      </div>
    }

    @if (optionsProduct(); as product) {
      <div class="modal-backdrop">
        <section class="modal-panel option-manager" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="options-dialog-title" [dialogCloseDisabled]="saving()" (dialogClose)="closeOptions()">
          <div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">{{ product.name }}</span><h2 id="options-dialog-title">Opções de venda</h2></div><button type="button" class="icon-button" aria-label="Fechar opções" (click)="closeOptions()"><i class="pi pi-times"></i></button></div>
          <div class="modal-body option-manager-body">
            <div class="option-manager-intro"><p>Use opções somente quando o produto exigir uma escolha, como o tipo de espeto de uma jantinha.</p><button type="button" class="secondary-button" (click)="editGroup()"><i class="pi pi-plus"></i>Novo grupo</button></div>
            @for (group of product.optionGroups; track group.id) {
              <section class="option-group-row" [class.inactive]="!group.active">
                <div class="option-group-title"><div><strong>{{ group.name }}</strong><small>{{ selectionRule(group) }}</small></div><div class="row-actions"><button type="button" class="icon-button" aria-label="Editar grupo" title="Editar grupo" (click)="editGroup(group)"><i class="pi pi-pencil"></i></button><button type="button" class="icon-button" [attr.aria-label]="group.active ? 'Desativar grupo' : 'Ativar grupo'" (click)="toggleGroup(group)"><i [class]="group.active ? 'pi pi-pause' : 'pi pi-play'"></i></button><button type="button" class="icon-button" aria-label="Adicionar opção" title="Adicionar opção" (click)="editOption(group)"><i class="pi pi-plus"></i></button></div></div>
                <div class="option-list">
                  @for (option of group.options; track option.id) {
                    <div class="option-row" [class.inactive]="!option.active"><span>{{ option.name }}</span><strong>{{ option.additionalPrice > 0 ? '+' + currency(option.additionalPrice) : 'Sem acréscimo' }}</strong><div class="row-actions"><button type="button" class="icon-button" aria-label="Editar opção" (click)="editOption(group, option)"><i class="pi pi-pencil"></i></button><button type="button" class="icon-button" [attr.aria-label]="option.active ? 'Desativar opção' : 'Ativar opção'" (click)="toggleOption(group, option)"><i [class]="option.active ? 'pi pi-pause' : 'pi pi-play'"></i></button></div></div>
                  } @empty { <p class="muted-line">Nenhuma opção cadastrada.</p> }
                </div>
              </section>
            } @empty { <app-empty-state icon="pi pi-list-check" title="Produto sem opções" description="Ele será adicionado à venda com um único clique." /> }
          </div>
        </section>
      </div>
    }

    @if (groupEditor(); as editor) {
      <div class="modal-backdrop nested-dialog">
        <form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="group-editor-title" [dialogCloseDisabled]="saving()" (dialogClose)="groupEditor.set(null)" (ngSubmit)="saveGroup(editor)">
          <div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Opções</span><h2 id="group-editor-title">{{ editor.id ? 'Editar grupo' : 'Novo grupo' }}</h2></div><button type="button" class="icon-button" aria-label="Fechar grupo" (click)="groupEditor.set(null)"><i class="pi pi-times"></i></button></div>
          <div class="modal-body"><label class="field"><span>Nome do grupo</span><input name="groupName" maxlength="120" [(ngModel)]="editor.name" required autofocus /></label><div class="form-grid"><label class="field"><span>Mínimo</span><input name="groupMin" type="number" min="0" [(ngModel)]="editor.minimumSelections" required /></label><label class="field"><span>Máximo</span><input name="groupMax" type="number" min="1" [(ngModel)]="editor.maximumSelections" required /></label></div><label class="toggle-field"><input name="groupActive" type="checkbox" [(ngModel)]="editor.active" /><span>Grupo ativo</span></label></div>
          <div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="groupEditor.set(null)">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving() || !editor.name.trim() || editor.minimumSelections < 0 || editor.maximumSelections < 1 || editor.maximumSelections < editor.minimumSelections"><i class="pi pi-save"></i>Salvar grupo</button></div>
        </form>
      </div>
    }

    @if (optionEditor(); as editor) {
      <div class="modal-backdrop nested-dialog">
        <form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="option-editor-title" [dialogCloseDisabled]="saving()" (dialogClose)="optionEditor.set(null)" (ngSubmit)="saveOption(editor)">
          <div class="modal-header"><div class="modal-heading"><span class="modal-eyebrow">Escolha</span><h2 id="option-editor-title">{{ editor.id ? 'Editar opção' : 'Nova opção' }}</h2></div><button type="button" class="icon-button" aria-label="Fechar opção" (click)="optionEditor.set(null)"><i class="pi pi-times"></i></button></div>
          <div class="modal-body"><label class="field"><span>Nome</span><input name="optionName" maxlength="120" [(ngModel)]="editor.name" required autofocus /></label><label class="field"><span>Acréscimo no preço</span><input name="optionPrice" type="number" min="0" step="0.01" [(ngModel)]="editor.additionalPrice" required /></label><label class="toggle-field"><input name="optionActive" type="checkbox" [(ngModel)]="editor.active" /><span>Opção ativa</span></label></div>
          <div class="modal-footer modal-actions"><button type="button" class="ghost-button" (click)="optionEditor.set(null)">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving() || !editor.name.trim() || editor.additionalPrice < 0"><i class="pi pi-save"></i>Salvar opção</button></div>
        </form>
      </div>
    }
  `,
  styles: `
    .simple-product-table { display: grid; gap: .25rem; }
    .simple-product-head, .simple-product-row { display: grid; grid-template-columns: minmax(14rem, 2fr) minmax(8rem, 1fr) 7rem 10rem 7rem 8rem; gap: 1rem; align-items: center; }
    .simple-product-head { padding: .7rem 1rem; color: var(--text-muted); font-size: .75rem; font-weight: 700; text-transform: uppercase; }
    .simple-product-row { min-height: 4.5rem; padding: .8rem 1rem; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-raised); }
    .simple-product-name { display: grid; gap: .2rem; min-width: 0; }
    .simple-product-name small { color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .availability-toggle { display: inline-flex; align-items: center; gap: .45rem; color: var(--text-muted); background: transparent; border: 0; font: inherit; cursor: pointer; }
    .availability-toggle.on { color: var(--success-text); }
    .option-manager { width: min(46rem, calc(100vw - 2rem)); }
    .option-manager-body { display: grid; gap: 1rem; max-height: min(70vh, 42rem); overflow: auto; }
    .option-manager-intro, .option-group-title, .option-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .option-manager-intro p { margin: 0; color: var(--text-muted); }
    .option-group-row { border-top: 1px solid var(--border-subtle); padding-top: 1rem; }
    .option-group-row.inactive, .option-row.inactive { opacity: .58; }
    .option-group-title > div:first-child { display: grid; gap: .2rem; }
    .option-group-title small, .muted-line { color: var(--text-muted); }
    .option-list { display: grid; gap: .35rem; margin-top: .7rem; }
    .option-row { min-height: 2.8rem; padding: .35rem .5rem .35rem .75rem; background: var(--surface-subtle); border-radius: 5px; }
    .option-row > span { flex: 1; }
    .nested-dialog { z-index: calc(var(--z-modal, 1000) + 2); }
    .simple-product-table {
      gap: .35rem;
      max-width: 88rem;
    }

    .simple-product-head {
      border-bottom: 1px solid var(--color-border-soft);
      padding: .45rem 1rem .7rem;
    }

    .simple-product-row {
      border-color: var(--color-border-soft);
      border-radius: var(--radius-sm);
      background: var(--surface-row-bg);
      box-shadow: var(--shadow-row);
      transition: border-color var(--duration-fast) ease, background var(--duration-fast) ease;
    }

    .simple-product-row:hover {
      border-color: var(--border-interactive);
      background: var(--surface-row-hover-bg);
    }

    .simple-product-name strong {
      color: var(--color-text-strong);
    }

    .simple-product-row > strong {
      color: var(--color-value-accent);
      font-variant-numeric: tabular-nums;
    }

    .availability-toggle {
      width: fit-content;
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-pill);
      background: var(--surface-control-bg);
      padding: .35rem .6rem;
      font-size: .78rem;
      font-weight: 850;
    }

    .option-manager-intro {
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-sm);
      background: var(--surface-subtle-bg);
      padding: .8rem;
    }

    .option-group-row {
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-sm);
      background: var(--surface-row-bg);
      padding: .85rem;
    }

    @media (max-width: 980px) { .simple-product-head { display: none; } .simple-product-row { grid-template-columns: 1fr auto; } .simple-product-row > :not(.simple-product-name):not(.row-actions) { display: none; } }
  `,
})
export class ProductsPageComponent implements OnInit {
  private readonly api = inject(ProductApiService);
  private readonly categoryApi = inject(CategoryApiService);
  private readonly feedback = inject(FeedbackService);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);
  readonly productDialog = signal(false);
  readonly editingProduct = signal<Product | null>(null);
  readonly optionsProduct = signal<Product | null>(null);
  readonly groupEditor = signal<GroupEditor | null>(null);
  readonly optionEditor = signal<OptionEditor | null>(null);
  searchTerm = '';
  productForm: ProductRequest = this.emptyProduct();

  readonly activeCategories = computed(() => this.categories().filter((category) => category.active));
  filteredProducts(): Product[] {
    const query = this.normalized(this.searchTerm);
    return [...this.products()]
      .filter((product) => !query || this.normalized(`${product.name} ${product.categoryName ?? ''}`).includes(query))
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'pt-BR'));
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ products: this.api.getAll(), categories: this.categoryApi.getAll() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: ({ products, categories }) => { this.products.set(products); this.categories.set(categories); }, error: (error) => this.error.set(apiErrorMessage(error)) });
  }

  openProduct(product: Product | null = null): void {
    this.editingProduct.set(product);
    this.productForm = product ? {
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      price: product.price,
      active: product.active,
      available: product.available,
      displayOrder: product.displayOrder,
    } : this.emptyProduct();
    this.productDialog.set(true);
  }

  closeProduct(): void { if (!this.saving()) this.productDialog.set(false); }

  saveProduct(): void {
    const name = this.productForm.name.trim();
    if (!name || this.productForm.price < 0 || this.saving()) return;
    const request: ProductRequest = { ...this.productForm, name, description: this.productForm.description?.trim() || null, price: Number(this.productForm.price) };
    const editing = this.editingProduct();
    this.saving.set(true);
    const operation = editing ? this.api.update(editing.id, request) : this.api.create(request);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (product) => {
        this.replaceProduct(product);
        this.productDialog.set(false);
        this.feedback.success(editing ? 'Produto atualizado.' : 'Produto cadastrado.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  setAvailable(product: Product): void {
    this.busyId.set(product.id);
    this.api.setAvailable(product.id, !product.available).pipe(finalize(() => this.busyId.set(null))).subscribe({ next: (updated) => { this.replaceProduct(updated); this.feedback.success(updated.available ? 'Produto disponível.' : 'Produto indisponível.'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }

  toggleActive(product: Product): void {
    this.busyId.set(product.id);
    const operation = product.active ? this.api.deactivate(product.id) : this.api.activate(product.id);
    operation.pipe(finalize(() => this.busyId.set(null))).subscribe({ next: (updated) => { this.replaceProduct(updated); this.feedback.success(updated.active ? 'Produto ativado.' : 'Produto desativado.'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }

  openOptions(product: Product): void { this.optionsProduct.set(product); }
  closeOptions(): void { if (!this.saving()) this.optionsProduct.set(null); }

  editGroup(group: ProductOptionGroup | null = null): void {
    this.groupEditor.set(group ? { id: group.id, name: group.name, minimumSelections: group.minimumSelections, maximumSelections: group.maximumSelections, displayOrder: group.displayOrder, active: group.active } : { id: null, name: '', minimumSelections: 1, maximumSelections: 1, displayOrder: 0, active: true });
  }

  saveGroup(editor: GroupEditor): void {
    const product = this.optionsProduct();
    if (!product || !editor.name.trim() || editor.minimumSelections < 0 || editor.maximumSelections < 1 || editor.maximumSelections < editor.minimumSelections || this.saving()) return;
    const request: ProductOptionGroupRequest = { name: editor.name.trim(), minimumSelections: Number(editor.minimumSelections), maximumSelections: Number(editor.maximumSelections), displayOrder: Number(editor.displayOrder), active: editor.active, options: [] };
    this.saving.set(true);
    const operation = editor.id ? this.api.updateOptionGroup(product.id, editor.id, request) : this.api.createOptionGroup(product.id, request);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({ next: (group) => { this.replaceGroup(product, group); this.groupEditor.set(null); this.feedback.success('Grupo de opções salvo.'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }

  toggleGroup(group: ProductOptionGroup): void {
    const product = this.optionsProduct();
    if (!product || this.saving()) return;
    this.saving.set(true);
    this.api.setOptionGroupActive(product.id, group.id, !group.active).pipe(finalize(() => this.saving.set(false))).subscribe({ next: (updated) => this.replaceGroup(product, updated), error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }

  editOption(group: ProductOptionGroup, option: ProductOption | null = null): void {
    this.optionEditor.set(option ? { id: option.id, groupId: group.id, name: option.name, additionalPrice: option.additionalPrice, displayOrder: option.displayOrder, active: option.active } : { id: null, groupId: group.id, name: '', additionalPrice: 0, displayOrder: group.options.length, active: true });
  }

  saveOption(editor: OptionEditor): void {
    const product = this.optionsProduct();
    if (!product || !editor.name.trim() || editor.additionalPrice < 0 || this.saving()) return;
    const request: ProductOptionRequest = { name: editor.name.trim(), additionalPrice: Number(editor.additionalPrice), displayOrder: editor.displayOrder, active: editor.active };
    this.saving.set(true);
    const operation = editor.id ? this.api.updateOption(product.id, editor.groupId, editor.id, request) : this.api.createOption(product.id, editor.groupId, request);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({ next: (option) => { this.replaceOption(product, editor.groupId, option); this.optionEditor.set(null); this.feedback.success('Opção salva.'); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }

  toggleOption(group: ProductOptionGroup, option: ProductOption): void {
    const product = this.optionsProduct();
    if (!product || this.saving()) return;
    this.saving.set(true);
    this.api.setOptionActive(product.id, group.id, option.id, !option.active).pipe(finalize(() => this.saving.set(false))).subscribe({ next: (updated) => this.replaceOption(product, group.id, updated), error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }

  selectionRule(group: ProductOptionGroup): string {
    if (group.minimumSelections === group.maximumSelections) return `Escolha ${group.minimumSelections}`;
    if (group.minimumSelections === 0) return `Até ${group.maximumSelections} escolhas`;
    return `De ${group.minimumSelections} a ${group.maximumSelections} escolhas`;
  }

  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }

  private replaceProduct(product: Product): void {
    this.products.update((items) => items.some((item) => item.id === product.id) ? items.map((item) => item.id === product.id ? product : item) : [...items, product]);
    if (this.optionsProduct()?.id === product.id) this.optionsProduct.set(product);
  }

  private replaceGroup(product: Product, group: ProductOptionGroup): void {
    const optionGroups = product.optionGroups.some((item) => item.id === group.id) ? product.optionGroups.map((item) => item.id === group.id ? group : item) : [...product.optionGroups, group];
    this.replaceProduct({ ...product, optionGroups });
  }

  private replaceOption(product: Product, groupId: number, option: ProductOption): void {
    const optionGroups = product.optionGroups.map((group) => group.id !== groupId ? group : { ...group, options: group.options.some((item) => item.id === option.id) ? group.options.map((item) => item.id === option.id ? option : item) : [...group.options, option] });
    this.replaceProduct({ ...product, optionGroups });
  }

  private emptyProduct(): ProductRequest { return { categoryId: null, name: '', description: null, price: 0, active: true, available: true, displayOrder: 0 }; }
  private normalized(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim(); }
}
