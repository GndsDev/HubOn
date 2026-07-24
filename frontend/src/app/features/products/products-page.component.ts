import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, forkJoin, of, throwError } from 'rxjs';
import { CategoryApiService } from '../../core/services/category-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { IngredientApiService } from '../../core/services/ingredient-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { ProductStockLinkApiService } from '../../core/services/product-stock-link-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { Category } from '../../shared/models/category.model';
import { Ingredient, UnitOfMeasure } from '../../shared/models/ingredient.model';
import { PreparationFlow, Product, ProductRequest, ProductVariant, ProductVariantRequest } from '../../shared/models/product.model';
import { ProductStockLinkRequest } from '../../shared/models/product-stock-link.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { formatStockValue } from '../../shared/util/unit-format';

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
      kicker="Cardapio"
      title="Produtos"
      description="Gerencie produtos base, variacoes vendaveis, fluxo de preparo e vinculo automatico de estoque."
    >
      <button type="button" class="primary-button" (click)="openCreate()">
        <i class="pi pi-plus"></i> Novo produto
      </button>
    </app-page-header>

    <app-section-card eyebrow="Catalogo" title="Produtos do cardapio">
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
          <div><strong>Nao foi possivel carregar</strong><p>{{ error() }}</p></div>
          <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button>
        </div>
      } @else if (filteredProducts.length === 0) {
        <app-empty-state
          icon="pi pi-box"
          title="Nenhum produto encontrado"
          description="Cadastre um produto ou ajuste o termo de busca."
        />
      } @else {
        <div class="product-table product-variant-table">
          <div class="product-table-head">
            <span>Produto</span><span>Categoria</span><span>Fluxo</span><span>Variacoes</span><span>Estoque</span><span>Status</span><span>Acoes</span>
          </div>
          @for (product of filteredProducts; track product.id) {
            <article class="product-row">
              <div class="product-name">
                <strong>{{ product.name }}</strong>
                <small>{{ product.description || 'Sem descricao cadastrada' }}</small>
              </div>
              <span>{{ product.categoryName }}</span>
              <app-status-badge [label]="flowLabel(product.preparationFlow)" [tone]="product.preparationFlow === 'KITCHEN' ? 'warning' : 'info'" />
              <div class="product-stock-link">
                <b>{{ variantSummary(product) }}</b>
                <small>{{ priceSummary(product) }}</small>
              </div>
              <app-status-badge
                [label]="product.hasAutomaticStockLink ? 'Estoque automatico' : 'Sem vinculo'"
                [tone]="product.hasAutomaticStockLink ? 'info' : 'neutral'"
              />
              <app-status-badge [label]="product.active ? 'Ativo' : 'Inativo'" [tone]="product.active ? 'success' : 'neutral'" />
              <div class="row-actions">
                <button
                  type="button"
                  class="icon-action-button"
                  title="Gerenciar variacoes"
                  [attr.aria-label]="'Gerenciar variacoes de ' + product.name"
                  (click)="openVariants(product)"
                >
                  <i class="pi pi-list"></i>
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
            <div><span>Catalogo</span><h2 id="product-dialog-title">{{ editing() ? 'Editar produto' : 'Novo produto' }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeForm()"><i class="pi pi-times"></i></button>
          </div>
          <div class="form-grid">
            <label class="field full"><span>Nome</span><input name="name" [(ngModel)]="form.name" required maxlength="120" autofocus /></label>
            <label class="field full"><span>Descricao</span><textarea name="description" [(ngModel)]="form.description" maxlength="255"></textarea></label>
            <label class="field">
              <span>Categoria</span>
              <select name="categoryId" [(ngModel)]="form.categoryId" required>
                <option [ngValue]="0" disabled>Selecione</option>
                @for (category of activeCategories; track category.id) {
                  <option [ngValue]="category.id">{{ category.name }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Fluxo</span>
              <select name="preparationFlow" [(ngModel)]="form.preparationFlow" required>
                <option [ngValue]="'KITCHEN'">Cozinha</option>
                <option [ngValue]="'DIRECT_SERVICE'">Atendimento direto</option>
              </select>
            </label>
            <label class="toggle-field"><input name="active" type="checkbox" [(ngModel)]="form.active" /><span>Produto ativo</span></label>
          </div>
          <div class="modal-actions">
            <button type="button" class="ghost-button" (click)="closeForm()">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-check"></i>{{ saving() ? 'Salvando...' : 'Salvar produto' }}</button>
          </div>
        </form>
      </div>
    }

    @if (variantsOpen() && variantsProduct(); as product) {
      <div class="modal-backdrop" (click)="closeVariants()">
        <section
          class="modal-panel wide"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="variants-dialog-title"
          (dialogClose)="closeVariants()"
          (click)="$event.stopPropagation()"
        >
          <div class="modal-header">
            <div><span>Variacoes</span><h2 id="variants-dialog-title">{{ product.name }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeVariants()"><i class="pi pi-times"></i></button>
          </div>

          <div class="form-section-title">
            <div><span>Itens vendaveis</span><small>Preco, SKU, status e estoque pertencem a variacao.</small></div>
            <button type="button" class="ghost-button compact-button" (click)="openVariantCreate()"><i class="pi pi-plus"></i>Nova variacao</button>
          </div>

          @if (product.variants.length === 0) {
            <app-empty-state icon="pi pi-list" title="Nenhuma variacao cadastrada" description="Crie uma variacao ativa para vender este produto." />
          } @else {
            <div class="product-table variant-list-table">
              <div class="product-table-head">
                <span>Variacao</span><span>SKU</span><span>Preco</span><span>Estoque</span><span>Status</span><span>Acoes</span>
              </div>
              @for (variant of product.variants; track variant.id) {
                <article class="product-row">
                  <div class="product-name">
                    <strong>{{ variant.name }}</strong>
                    <small>{{ variantDisplay(product, variant) }}</small>
                  </div>
                  <span>{{ variant.sku || 'Sem SKU' }}</span>
                  <b>{{ currency(variant.price) }}</b>
                  <div class="product-stock-link">
                    <app-status-badge [label]="variant.stockLinkActive ? 'Vinculado' : 'Sem vinculo'" [tone]="variant.stockLinkActive ? 'info' : 'neutral'" />
                    <small>{{ variant.stockItemName || 'Baixa manual ou sem controle' }}</small>
                  </div>
                  <app-status-badge [label]="variant.active ? 'Ativa' : 'Inativa'" [tone]="variant.active ? 'success' : 'neutral'" />
                  <div class="row-actions">
                    <button type="button" class="icon-action-button" title="Vincular estoque" (click)="openStockLink(product, variant)">
                      <i class="pi pi-link"></i>
                    </button>
                    <button type="button" class="icon-action-button" title="Editar variacao" (click)="openVariantEdit(variant)">
                      <i class="pi pi-pencil"></i>
                    </button>
                    <button
                      type="button"
                      class="icon-action-button"
                      [class.danger]="variant.active"
                      [class.success]="!variant.active"
                      [title]="variant.active ? 'Desativar variacao' : 'Ativar variacao'"
                      (click)="toggleVariant(product, variant)"
                    >
                      <i [class]="variant.active ? 'pi pi-ban' : 'pi pi-check'"></i>
                    </button>
                  </div>
                </article>
              }
            </div>
          }

          @if (variantFormOpen()) {
            <form class="embedded-form" (ngSubmit)="saveVariant()">
              <div class="form-grid">
                <label class="field"><span>Nome da variacao</span><input name="variantName" [(ngModel)]="variantForm.name" required maxlength="120" autofocus /></label>
                <label class="field"><span>Preco</span><input name="variantPrice" type="number" min="0" step="0.01" [(ngModel)]="variantForm.price" required /></label>
                <label class="field"><span>SKU</span><input name="variantSku" [(ngModel)]="variantForm.sku" maxlength="80" /></label>
                <label class="toggle-field"><input name="variantActive" type="checkbox" [(ngModel)]="variantForm.active" /><span>Variacao ativa</span></label>
              </div>
              <div class="modal-actions">
                <button type="button" class="ghost-button" (click)="closeVariantForm()">Cancelar</button>
                <button type="submit" class="primary-button" [disabled]="variantSaving()"><i class="pi pi-check"></i>{{ variantSaving() ? 'Salvando...' : 'Salvar variacao' }}</button>
              </div>
            </form>
          }
        </section>
      </div>
    }

    @if (stockLinkOpen()) {
      <div class="modal-backdrop" (click)="closeStockLink()">
        <form
          class="modal-panel wide"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-link-dialog-title"
          [dialogCloseDisabled]="stockLinkSaving()"
          (dialogClose)="closeStockLink()"
          (click)="$event.stopPropagation()"
          (ngSubmit)="saveStockLink()"
        >
          <div class="modal-header">
            <div><span>Estoque automatico</span><h2 id="stock-link-dialog-title">{{ stockLinkTitle() }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeStockLink()"><i class="pi pi-times"></i></button>
          </div>

          @if (stockLinkLoading()) {
            <div class="loading-grid"><div class="loading-row"></div><div class="loading-row"></div></div>
          } @else {
            <div class="form-grid">
              @if (directSaleIngredients.length === 0) {
                <div class="full">
                  <app-empty-state
                    icon="pi pi-warehouse"
                    title="Nenhum item de baixa automatica"
                    description="Crie um item ativo em modo baixa automatica para vincular variacoes."
                  />
                </div>
              } @else {
                <label class="field full">
                  <span>Item de estoque</span>
                  <select name="stockItemId" [(ngModel)]="linkForm.stockItemId" required autofocus>
                    <option [ngValue]="0" disabled>Selecione</option>
                    @for (ingredient of directSaleIngredients; track ingredient.id) {
                      <option [ngValue]="ingredient.id">{{ ingredient.name }} - {{ stockValue(ingredient.currentStock, ingredient.unit) }}</option>
                    }
                  </select>
                </label>
                <label class="field">
                  <span>Quantidade por venda</span>
                  <input name="quantityPerSale" type="number" min="0.001" step="0.001" [(ngModel)]="linkForm.quantityPerSale" required />
                </label>
                <div class="link-preview">
                  <span>Saldo atual</span>
                  <strong>{{ selectedStockLabel() }}</strong>
                  <small>Este saldo sera baixado conforme o fluxo de preparo do produto.</small>
                </div>
              }
            </div>
            <div class="modal-actions">
              @if (stockLinkId()) {
                <button type="button" class="danger-button" [disabled]="stockLinkSaving()" (click)="removeStockLink()">
                  <i class="pi pi-unlink"></i>Remover vinculo
                </button>
              }
              <button type="button" class="ghost-button" (click)="closeStockLink()">Cancelar</button>
              <button type="submit" class="primary-button" [disabled]="stockLinkSaving() || directSaleIngredients.length === 0">
                <i class="pi pi-check"></i>{{ stockLinkSaving() ? 'Salvando...' : 'Salvar vinculo' }}
              </button>
            </div>
          }
        </form>
      </div>
    }
  `,
})
export class ProductsPageComponent implements OnInit {
  private readonly api = inject(ProductApiService);
  private readonly categoryApi = inject(CategoryApiService);
  private readonly ingredientApi = inject(IngredientApiService);
  private readonly stockLinkApi = inject(ProductStockLinkApiService);
  private readonly feedback = inject(FeedbackService);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly ingredients = signal<Ingredient[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<Product | null>(null);
  readonly variantsOpen = signal(false);
  readonly variantsProduct = signal<Product | null>(null);
  readonly variantFormOpen = signal(false);
  readonly variantSaving = signal(false);
  readonly editingVariant = signal<ProductVariant | null>(null);
  readonly stockLinkOpen = signal(false);
  readonly stockLinkLoading = signal(false);
  readonly stockLinkSaving = signal(false);
  readonly stockLinkProduct = signal<Product | null>(null);
  readonly stockLinkVariant = signal<ProductVariant | null>(null);
  readonly stockLinkId = signal<number | null>(null);
  searchTerm = '';
  form: ProductRequest = this.emptyForm();
  variantForm: ProductVariantRequest = this.emptyVariantForm();
  linkForm: ProductStockLinkRequest = { stockItemId: 0, quantityPerSale: 1 };

  ngOnInit(): void {
    this.load();
  }

  get activeCategories(): Category[] {
    const editingCategoryId = this.editing()?.categoryId;
    return this.categories().filter((category) => category.active || category.id === editingCategoryId);
  }

  get directSaleIngredients(): Ingredient[] {
    return this.ingredients().filter((ingredient) => ingredient.active && ingredient.controlMode === 'DIRECT_SALE');
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
        next: ({ products, categories }) => {
          this.products.set(products);
          this.categories.set(categories);
          this.refreshSelectedProduct(products);
        },
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
      preparationFlow: product.preparationFlow,
      active: product.active,
      imageUrl: product.imageUrl,
    };
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.categoryId) {
      this.feedback.error('Preencha nome e categoria.');
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
      next: () => {
        this.feedback.success(product.active ? 'Registro desativado com sucesso.' : 'Registro atualizado com sucesso.');
        this.load();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  openVariants(product: Product): void {
    this.variantsProduct.set(product);
    this.variantFormOpen.set(false);
    this.editingVariant.set(null);
    this.variantsOpen.set(true);
  }

  closeVariants(): void {
    this.variantsOpen.set(false);
    this.variantsProduct.set(null);
    this.closeVariantForm();
  }

  openVariantCreate(): void {
    this.editingVariant.set(null);
    this.variantForm = this.emptyVariantForm();
    this.variantFormOpen.set(true);
  }

  openVariantEdit(variant: ProductVariant): void {
    this.editingVariant.set(variant);
    this.variantForm = {
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      active: variant.active,
    };
    this.variantFormOpen.set(true);
  }

  closeVariantForm(): void {
    this.variantFormOpen.set(false);
    this.editingVariant.set(null);
  }

  saveVariant(): void {
    const product = this.variantsProduct();
    if (!product) return;
    if (!this.variantForm.name.trim() || this.variantForm.price < 0) {
      this.feedback.error('Preencha nome e preco valido para a variacao.');
      return;
    }

    this.variantSaving.set(true);
    const current = this.editingVariant();
    const operation = current
      ? this.api.updateVariant(product.id, current.id, this.variantForm)
      : this.api.createVariant(product.id, this.variantForm);

    operation.pipe(finalize(() => this.variantSaving.set(false))).subscribe({
      next: () => {
        this.feedback.success(current ? 'Variacao atualizada com sucesso.' : 'Variacao criada com sucesso.');
        this.closeVariantForm();
        this.reloadProduct(product.id);
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  toggleVariant(product: Product, variant: ProductVariant): void {
    const operation = variant.active
      ? this.api.deactivateVariant(product.id, variant.id)
      : this.api.activateVariant(product.id, variant.id);
    operation.subscribe({
      next: () => {
        this.feedback.success(variant.active ? 'Variacao desativada com sucesso.' : 'Variacao ativada com sucesso.');
        this.reloadProduct(product.id);
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  openStockLink(product: Product, variant: ProductVariant): void {
    this.stockLinkProduct.set(product);
    this.stockLinkVariant.set(variant);
    this.stockLinkId.set(null);
    this.linkForm = { stockItemId: 0, quantityPerSale: 1 };
    this.stockLinkOpen.set(true);
    this.stockLinkLoading.set(true);

    forkJoin({
      ingredients: this.ingredientApi.getActive(),
      link: this.stockLinkApi.getByVariant(variant.id).pipe(
        catchError((error) => error?.status === 404 ? of(null) : throwError(() => error))
      ),
    })
      .pipe(finalize(() => this.stockLinkLoading.set(false)))
      .subscribe({
        next: ({ ingredients, link }) => {
          this.ingredients.set(ingredients);
          if (link) {
            this.stockLinkId.set(link.id);
            this.linkForm = {
              stockItemId: link.stockItemId,
              quantityPerSale: link.quantityPerSale,
            };
          }
        },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  closeStockLink(): void {
    this.stockLinkOpen.set(false);
    this.stockLinkProduct.set(null);
    this.stockLinkVariant.set(null);
    this.stockLinkId.set(null);
  }

  saveStockLink(): void {
    const variant = this.stockLinkVariant();
    if (!variant) return;
    if (!this.linkForm.stockItemId || this.linkForm.quantityPerSale <= 0) {
      this.feedback.error('Selecione um item e informe uma quantidade maior que zero.');
      return;
    }

    this.stockLinkSaving.set(true);
    const operation = this.stockLinkId()
      ? this.stockLinkApi.update(variant.id, this.linkForm)
      : this.stockLinkApi.create(variant.id, this.linkForm);

    operation.pipe(finalize(() => this.stockLinkSaving.set(false))).subscribe({
      next: () => {
        this.feedback.success('Vinculo de estoque salvo com sucesso.');
        const productId = this.stockLinkProduct()?.id;
        this.closeStockLink();
        if (productId) this.reloadProduct(productId);
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  removeStockLink(): void {
    const variant = this.stockLinkVariant();
    if (!variant) return;

    this.stockLinkSaving.set(true);
    this.stockLinkApi.deactivate(variant.id)
      .pipe(finalize(() => this.stockLinkSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Vinculo de estoque removido com sucesso.');
          const productId = this.stockLinkProduct()?.id;
          this.closeStockLink();
          if (productId) this.reloadProduct(productId);
        },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  selectedStockItem(): Ingredient | null {
    return this.directSaleIngredients.find((ingredient) => ingredient.id === this.linkForm.stockItemId) ?? null;
  }

  selectedStockLabel(): string {
    const item = this.selectedStockItem();
    return item ? this.stockValue(item.currentStock, item.unit) : 'Selecione um item';
  }

  stockLinkTitle(): string {
    const product = this.stockLinkProduct();
    const variant = this.stockLinkVariant();
    if (!product || !variant) return '';
    return this.variantDisplay(product, variant);
  }

  variantDisplay(product: Product, variant: ProductVariant): string {
    return variant.name.toLocaleLowerCase('pt-BR') === 'padrão' ? product.name : `${product.name} - ${variant.name}`;
  }

  variantSummary(product: Product): string {
    if (product.activeVariantCount === 0) return 'Sem variacoes ativas';
    return product.activeVariantCount === 1 ? '1 variacao ativa' : `${product.activeVariantCount} variacoes ativas`;
  }

  priceSummary(product: Product): string {
    return product.minimumVariantPrice == null ? 'Cadastre uma variacao para vender' : `A partir de ${this.currency(product.minimumVariantPrice)}`;
  }

  flowLabel(flow: PreparationFlow): string {
    return flow === 'KITCHEN' ? 'Cozinha' : 'Atendimento direto';
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  stockValue(value: number, unit?: UnitOfMeasure): string {
    return formatStockValue(value, unit);
  }

  private reloadProduct(productId: number): void {
    this.api.getById(productId).subscribe({
      next: (product) => {
        const products = this.products().map((current) => current.id === product.id ? product : current);
        this.products.set(products);
        this.refreshSelectedProduct(products);
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  private refreshSelectedProduct(products: Product[]): void {
    const selected = this.variantsProduct();
    if (!selected) return;
    this.variantsProduct.set(products.find((product) => product.id === selected.id) ?? selected);
  }

  private emptyForm(): ProductRequest {
    return { categoryId: 0, name: '', description: '', preparationFlow: 'KITCHEN', active: true, imageUrl: null };
  }

  private emptyVariantForm(): ProductVariantRequest {
    return { name: 'Padrão', sku: null, price: 0, active: true };
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  }
}
