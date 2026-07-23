import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { CategoryApiService } from '../../core/services/category-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { IngredientApiService } from '../../core/services/ingredient-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { ProductIngredientApiService } from '../../core/services/product-ingredient-api.service';
import { Category } from '../../shared/models/category.model';
import { Ingredient, UnitOfMeasure } from '../../shared/models/ingredient.model';
import { ProductIngredientRequest } from '../../shared/models/product-ingredient.model';
import { Product, ProductRequest } from '../../shared/models/product.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';

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
    <app-page-header
      kicker="Cardápio"
      title="Produtos"
      description="Gerencie itens de venda com preço, categoria e disponibilidade."
    >
      <button type="button" class="primary-button" (click)="openCreate()">
        <i class="pi pi-plus"></i> Novo produto
      </button>
    </app-page-header>

    <app-section-card eyebrow="Catálogo" title="Produtos do cardápio">
      <label card-action class="search-box">
        <i class="pi pi-search"></i>
        <input
          type="search"
          placeholder="Buscar por nome ou categoria"
          aria-label="Buscar produto por nome ou categoria"
          [(ngModel)]="searchTerm"
        />
      </label>

      @if (loading()) {
        <div class="loading-grid">@for (item of [1,2,3,4]; track item) { <div class="loading-row"></div> }</div>
      } @else if (error()) {
        <div class="error-panel" role="alert">
          <i class="pi pi-exclamation-triangle"></i>
          <div><strong>Não foi possível carregar</strong><p>{{ error() }}</p></div>
          <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button>
        </div>
      } @else if (filteredProducts.length === 0) {
        <app-empty-state
          icon="pi pi-box"
          title="Nenhum produto encontrado"
          description="Cadastre um produto ou ajuste o termo de busca."
        />
      } @else {
        <div class="product-table">
          <div class="product-table-head">
            <span>Produto</span><span>Categoria</span><span>Preço</span><span>Status</span><span>Ações</span>
          </div>
          @for (product of filteredProducts; track product.id) {
            <article class="product-row">
              <div class="product-name">
                <strong>{{ product.name }}</strong>
                <small>{{ product.description || 'Sem descrição cadastrada' }}</small>
              </div>
              <span>{{ product.categoryName }}</span>
              <b>{{ currency(product.price) }}</b>
              <app-status-badge [label]="product.active ? 'Ativo' : 'Inativo'" [tone]="product.active ? 'success' : 'neutral'" />
              <div class="row-actions">
                <button
                  type="button"
                  class="icon-action-button"
                  title="Ficha tecnica"
                  [attr.aria-label]="'Abrir ficha tecnica de ' + product.name"
                  (click)="openRecipe(product)"
                >
                  <i class="pi pi-list-check"></i>
                </button>
                <button
                  type="button"
                  class="icon-action-button"
                  title="Editar produto"
                  [attr.aria-label]="'Editar produto ' + product.name"
                  (click)="openEdit(product)"
                >
                  <i class="pi pi-pencil"></i>
                </button>
                <button
                  type="button"
                  class="icon-action-button"
                  [class.danger]="product.active"
                  [class.success]="!product.active"
                  [title]="product.active ? 'Desativar produto' : 'Ativar produto'"
                  [attr.aria-label]="(product.active ? 'Desativar produto ' : 'Ativar produto ') + product.name"
                  (click)="toggle(product)"
                >
                  <i [class]="product.active ? 'pi pi-ban' : 'pi pi-check'"></i>
                </button>
              </div>
            </article>
          }
        </div>
      }
    </app-section-card>

    @if (formOpen()) {
      <div class="modal-backdrop" (click)="closeForm()">
        <form
          class="modal-panel"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-dialog-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="closeForm()"
          (click)="$event.stopPropagation()"
          (ngSubmit)="save()"
        >
          <div class="modal-header">
            <div><span>Catálogo</span><h2 id="product-dialog-title">{{ editing() ? 'Editar produto' : 'Novo produto' }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeForm()"><i class="pi pi-times"></i></button>
          </div>
          <div class="form-grid">
            <label class="field full"><span>Nome</span><input name="name" [(ngModel)]="form.name" required maxlength="120" autofocus /></label>
            <label class="field full"><span>Descrição</span><textarea name="description" [(ngModel)]="form.description" maxlength="255"></textarea></label>
            <label class="field">
              <span>Categoria</span>
              <select name="categoryId" [(ngModel)]="form.categoryId" required>
                <option [ngValue]="0" disabled>Selecione</option>
                @for (category of activeCategories; track category.id) {
                  <option [ngValue]="category.id">{{ category.name }}</option>
                }
              </select>
            </label>
            <label class="field"><span>Preço</span><input name="price" type="number" min="0" step="0.01" [(ngModel)]="form.price" required /></label>
            <label class="toggle-field"><input name="active" type="checkbox" [(ngModel)]="form.active" /><span>Produto ativo</span></label>
          </div>
          <div class="modal-actions">
            <button type="button" class="ghost-button" (click)="closeForm()">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-check"></i>{{ saving() ? 'Salvando...' : 'Salvar produto' }}</button>
          </div>
        </form>
      </div>
    }

    @if (recipeOpen()) {
      <div class="modal-backdrop" (click)="closeRecipe()">
        <section
          class="modal-panel wide"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="recipe-dialog-title"
          [dialogCloseDisabled]="recipeSaving()"
          (dialogClose)="closeRecipe()"
          (click)="$event.stopPropagation()"
        >
          <div class="modal-header">
            <div><span>Ficha tecnica</span><h2 id="recipe-dialog-title">{{ recipeProduct()?.name }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeRecipe()"><i class="pi pi-times"></i></button>
          </div>
          @if (recipeLoading()) {
            <div class="loading-grid"><div class="loading-row"></div><div class="loading-row"></div></div>
          } @else {
            <div class="form-section-title">
              <div><span>Ingredientes da receita</span><small>Quantidade consumida por unidade vendida.</small></div>
              <button type="button" class="ghost-button compact-button" (click)="addRecipeItem()"><i class="pi pi-plus"></i>Adicionar ingrediente</button>
            </div>
            @if (recipeItems.length === 0) {
              <app-empty-state icon="pi pi-list-check" title="Ficha tecnica vazia" description="Adicione os ingredientes usados neste produto." />
            } @else {
              <div class="recipe-form-items">
                @for (item of recipeItems; track $index; let index = $index) {
                  <div class="recipe-form-row">
                    <label class="field">
                      <span>Ingrediente</span>
                      <select [name]="'recipe-ingredient-' + index" [(ngModel)]="item.ingredientId">
                        <option [ngValue]="0" disabled>Selecione</option>
                        @for (ingredient of recipeOptions(index); track ingredient.id) {
                          <option [ngValue]="ingredient.id">{{ ingredient.name }} - {{ unitLabel(ingredient.unit) }}</option>
                        }
                      </select>
                    </label>
                    <label class="field">
                      <span>Quantidade</span>
                      <input [name]="'recipe-quantity-' + index" type="number" min="0.001" step="0.001" [(ngModel)]="item.quantity" />
                    </label>
                    <button type="button" class="icon-button danger-icon" title="Remover ingrediente" (click)="removeRecipeItem(index)">
                      <i class="pi pi-trash"></i>
                    </button>
                  </div>
                }
              </div>
            }
            <div class="modal-actions">
              <button type="button" class="ghost-button" (click)="closeRecipe()">Cancelar</button>
              <button type="button" class="primary-button" [disabled]="recipeSaving()" (click)="saveRecipe()">
                <i class="pi pi-check"></i>{{ recipeSaving() ? 'Salvando...' : 'Salvar ficha tecnica' }}
              </button>
            </div>
          }
        </section>
      </div>
    }
  `,
})
export class ProductsPageComponent implements OnInit {
  private readonly api = inject(ProductApiService);
  private readonly categoryApi = inject(CategoryApiService);
  private readonly ingredientApi = inject(IngredientApiService);
  private readonly recipeApi = inject(ProductIngredientApiService);
  private readonly feedback = inject(FeedbackService);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly ingredients = signal<Ingredient[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<Product | null>(null);
  readonly recipeOpen = signal(false);
  readonly recipeLoading = signal(false);
  readonly recipeSaving = signal(false);
  readonly recipeProduct = signal<Product | null>(null);
  searchTerm = '';
  form: ProductRequest = this.emptyForm();
  recipeItems: ProductIngredientRequest[] = [];

  ngOnInit(): void { this.load(); }

  get activeCategories(): Category[] {
    const editingCategoryId = this.editing()?.categoryId;
    return this.categories().filter((category) => category.active || category.id === editingCategoryId);
  }

  get filteredProducts(): Product[] {
    const search = this.normalize(this.searchTerm);
    return !search ? this.products() : this.products().filter((product) =>
      this.normalize(`${product.name} ${product.categoryName}`).includes(search));
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ products: this.api.getAll(), categories: this.categoryApi.getAll() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ products, categories }) => { this.products.set(products); this.categories.set(categories); },
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.formOpen.set(true);
  }

  openEdit(product: Product): void {
    this.editing.set(product);
    this.form = {
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      price: product.price,
      active: product.active,
      imageUrl: product.imageUrl,
    };
    this.formOpen.set(true);
  }

  closeForm(): void { this.formOpen.set(false); }

  save(): void {
    if (!this.form.name.trim() || !this.form.categoryId || this.form.price < 0) {
      this.feedback.error('Preencha nome, categoria e um preço válido.');
      return;
    }
    this.saving.set(true);
    const current = this.editing();
    const operation = current ? this.api.update(current.id, this.form) : this.api.create(this.form);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.feedback.success(current ? 'Registro atualizado com sucesso.' : 'Registro salvo com sucesso.');
        this.closeForm();
        this.load();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  toggle(product: Product): void {
    const operation = product.active ? this.api.deactivate(product.id) : this.api.activate(product.id);
    operation.subscribe({
      next: () => { this.feedback.success(product.active ? 'Registro desativado com sucesso.' : 'Registro atualizado com sucesso.'); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  openRecipe(product: Product): void {
    this.recipeProduct.set(product);
    this.recipeItems = [];
    this.recipeOpen.set(true);
    this.recipeLoading.set(true);
    forkJoin({ recipe: this.recipeApi.getRecipe(product.id), ingredients: this.ingredientApi.getActive() })
      .pipe(finalize(() => this.recipeLoading.set(false)))
      .subscribe({
        next: ({ recipe, ingredients }) => {
          this.ingredients.set(ingredients);
          this.recipeItems = recipe.ingredients.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
          }));
        },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  closeRecipe(): void {
    this.recipeOpen.set(false);
    this.recipeProduct.set(null);
  }

  addRecipeItem(): void {
    const selectedIds = new Set(this.recipeItems.map((item) => item.ingredientId));
    const ingredient = this.ingredients().find((item) => !selectedIds.has(item.id));
    if (!ingredient) {
      this.feedback.info('Nao ha ingredientes ativos disponiveis.');
      return;
    }
    this.recipeItems.push({ ingredientId: ingredient.id, quantity: 1 });
  }

  removeRecipeItem(index: number): void {
    this.recipeItems.splice(index, 1);
  }

  saveRecipe(): void {
    const product = this.recipeProduct();
    if (!product) return;

    const ingredientIds = new Set<number>();
    for (const item of this.recipeItems) {
      if (!item.ingredientId || item.quantity <= 0) {
        this.feedback.error('Selecione ingredientes e informe quantidades validas.');
        return;
      }
      if (ingredientIds.has(item.ingredientId)) {
        this.feedback.error('A ficha tecnica nao pode ter ingredientes duplicados.');
        return;
      }
      ingredientIds.add(item.ingredientId);
    }

    this.recipeSaving.set(true);
    this.recipeApi.replaceRecipe(product.id, this.recipeItems)
      .pipe(finalize(() => this.recipeSaving.set(false)))
      .subscribe({
        next: (recipe) => {
          this.feedback.success('Ficha tecnica salva com sucesso.');
          this.recipeItems = recipe.ingredients.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
          }));
        },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  recipeOptions(index: number): Ingredient[] {
    const currentId = this.recipeItems[index]?.ingredientId;
    const selectedIds = new Set(
      this.recipeItems
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item) => item.ingredientId),
    );
    return this.ingredients().filter((ingredient) => ingredient.id === currentId || !selectedIds.has(ingredient.id));
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  unitLabel(unit: UnitOfMeasure): string {
    return {
      KG: 'kg',
      G: 'g',
      L: 'l',
      ML: 'ml',
      UN: 'un',
      CX: 'cx',
      PACKAGE: 'pacote',
      TRAY: 'bandeja',
    }[unit];
  }

  private emptyForm(): ProductRequest {
    return { categoryId: 0, name: '', description: '', price: 0, active: true, imageUrl: null };
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  }
}
