import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { StockApiService } from '../../core/services/stock-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { Product } from '../../shared/models/product.model';
import {
  ProductStockLink,
  ProductStockLinkRequest,
  StockItem,
  StockItemRequest,
  StockMovement,
  StockMovementType,
  UnitOfMeasure,
} from '../../shared/models/stock.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { formatStockValue, unitLabel } from '../../shared/util/unit-format';

type StockView = 'ITEMS' | 'MOVEMENTS' | 'LINKS';
type ManualMovement = 'ENTRY' | 'EXIT' | 'LOSS' | 'ADJUSTMENT';

@Component({
  selector: 'app-stock-page',
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
      kicker="Controle"
      title="Estoque"
      description="Acompanhe saldos, movimentações e baixas automáticas em um só lugar."
    >
      <div page-actions class="page-header-actions">
        <button type="button" class="secondary-button" (click)="openMovement()">
          <i class="pi pi-arrow-right-arrow-left"></i>
          Movimentar
        </button>
        <button type="button" class="primary-button" (click)="openItem()">
          <i class="pi pi-plus"></i>
          Novo item
        </button>
      </div>
    </app-page-header>

    <nav class="segmented-control stock-tabs" aria-label="Visualização do estoque">
      <button type="button" [class.active]="view() === 'ITEMS'" (click)="view.set('ITEMS')">
        <i class="pi pi-box"></i>
        Itens
      </button>
      <button type="button" [class.active]="view() === 'MOVEMENTS'" (click)="view.set('MOVEMENTS')">
        <i class="pi pi-history"></i>
        Histórico
      </button>
      <button type="button" [class.active]="view() === 'LINKS'" (click)="view.set('LINKS')">
        <i class="pi pi-link"></i>
        Baixa automática
      </button>
    </nav>

    @if (loading()) {
      <div class="loading-grid" aria-label="Carregando estoque">
        <div class="loading-row"></div>
        <div class="loading-row"></div>
        <div class="loading-row"></div>
      </div>
    } @else if (error()) {
      <div class="error-panel" role="alert">
        <i class="pi pi-exclamation-triangle"></i>
        <div>
          <strong>Não foi possível carregar o estoque</strong>
          <p>{{ error() }}</p>
        </div>
        <button type="button" class="ghost-button" (click)="load()">
          <i class="pi pi-refresh"></i>
          Tentar novamente
        </button>
      </div>
    } @else if (view() === 'ITEMS') {
      <app-section-card class="stock-section" eyebrow="Saldo atual" title="Itens controlados">
        <app-status-badge
          card-action
          [label]="alertCount() ? alertCount() + (alertCount() === 1 ? ' alerta' : ' alertas') : 'Estoque regular'"
          [tone]="alertCount() ? 'warning' : 'success'"
        />

        <div class="stock-toolbar">
          <label class="search-box">
            <i class="pi pi-search"></i>
            <input
              type="search"
              placeholder="Buscar item de estoque"
              [(ngModel)]="searchTerm"
              aria-label="Buscar item de estoque"
            />
          </label>
          <span class="stock-result-count">
            {{ filteredItems().length }} item{{ filteredItems().length === 1 ? '' : 's' }}
          </span>
        </div>

        @if (filteredItems().length) {
          <div class="data-table stock-data-table" role="region" aria-label="Itens de estoque" tabindex="0">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Saldo atual</th>
                  <th>Estoque mínimo</th>
                  <th>Situação</th>
                  <th>Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                @for (item of filteredItems(); track item.id) {
                  <tr>
                    <td>
                      <div class="stock-item-name">
                        <strong>{{ item.name }}</strong>
                        @if (item.description) {
                          <small>{{ item.description }}</small>
                        }
                      </div>
                    </td>
                    <td class="stock-value"><strong>{{ stockValue(item.currentStock, item.unit) }}</strong></td>
                    <td>{{ stockValue(item.minimumStock, item.unit) }}</td>
                    <td><app-status-badge [label]="statusLabel(item)" [tone]="statusTone(item)" /></td>
                    <td>
                      <app-status-badge
                        [label]="item.active ? 'Ativo' : 'Inativo'"
                        [tone]="item.active ? 'success' : 'neutral'"
                      />
                    </td>
                    <td>
                      <div class="row-actions stock-actions">
                        <button
                          type="button"
                          class="icon-button"
                          title="Movimentar"
                          [attr.aria-label]="'Movimentar ' + item.name"
                          (click)="openMovement(item)"
                        >
                          <i class="pi pi-arrow-right-arrow-left"></i>
                        </button>
                        <button
                          type="button"
                          class="icon-button"
                          title="Editar"
                          [attr.aria-label]="'Editar ' + item.name"
                          (click)="openItem(item)"
                        >
                          <i class="pi pi-pencil"></i>
                        </button>
                        <button
                          type="button"
                          class="icon-button"
                          [title]="item.active ? 'Desativar' : 'Ativar'"
                          [attr.aria-label]="(item.active ? 'Desativar ' : 'Ativar ') + item.name"
                          (click)="toggleItem(item)"
                          [disabled]="busyId() === item.id"
                        >
                          <i [class]="item.active ? 'pi pi-pause' : 'pi pi-play'"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <app-empty-state
            icon="pi pi-warehouse"
            title="Nenhum item encontrado"
            description="Ajuste a busca ou cadastre um novo item de estoque."
          />
        }
      </app-section-card>
    } @else if (view() === 'MOVEMENTS') {
      <app-section-card class="stock-section" eyebrow="Auditoria" title="Histórico de movimentações">
        <button card-action type="button" class="secondary-button" (click)="openMovement()">
          <i class="pi pi-plus"></i>
          Nova movimentação
        </button>

        <p class="stock-section-note">
          <i class="pi pi-lock"></i>
          Movimentações registradas preservam o histórico e não podem ser editadas.
        </p>

        @if (movements().length) {
          <div class="data-table stock-movement-table" role="region" aria-label="Histórico de movimentações" tabindex="0">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Item</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Saldo resultante</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                @for (movement of movements(); track movement.id) {
                  <tr>
                    <td><time>{{ dateTime(movement.createdAt) }}</time></td>
                    <td><strong>{{ movement.stockItemName }}</strong></td>
                    <td>
                      <app-status-badge
                        [label]="movementTypeLabel(movement.type)"
                        [tone]="movementTone(movement.type)"
                      />
                    </td>
                    <td>
                      <strong [class.negative]="movement.deltaQuantity < 0">{{ signedQuantity(movement) }}</strong>
                    </td>
                    <td>{{ stockValue(movement.resultingBalance, movement.unit) }}</td>
                    <td class="movement-reason">{{ movement.reason || automaticReason(movement) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <app-empty-state
            icon="pi pi-history"
            title="Sem movimentações"
            description="Entradas, saídas e vendas aparecerão aqui."
          />
        }
      </app-section-card>
    } @else {
      <app-section-card class="stock-section" eyebrow="Integração" title="Baixa automática por produto">
        <app-status-badge
          card-action
          [label]="products().length + (products().length === 1 ? ' produto' : ' produtos')"
          tone="neutral"
        />

        <p class="stock-section-note">
          <i class="pi pi-info-circle"></i>
          Cada produto pode descontar um item de estoque automaticamente após a venda.
        </p>

        @if (products().length) {
          <div class="stock-link-list">
            @for (product of products(); track product.id) {
              <article class="stock-link-row">
                <div class="stock-link-main">
                  <span class="stock-link-icon"><i class="pi pi-box"></i></span>
                  <div>
                    <strong>{{ product.name }}</strong>
                    <small>{{ product.categoryName || 'Sem categoria' }}</small>
                  </div>
                </div>

                @if (linkFor(product.id); as link) {
                  <div class="stock-link-details">
                    <span>
                      <small>Item de estoque</small>
                      <strong>{{ link.stockItemName }}</strong>
                    </span>
                    <span>
                      <small>Consumo por venda</small>
                      <strong>{{ stockValue(link.quantityPerSale, link.unit) }}</strong>
                    </span>
                  </div>
                  <div class="row-actions stock-link-actions">
                    <button
                      type="button"
                      class="icon-button"
                      title="Editar vínculo"
                      [attr.aria-label]="'Editar vínculo de ' + product.name"
                      (click)="openLink(product, link)"
                    >
                      <i class="pi pi-pencil"></i>
                    </button>
                    <button
                      type="button"
                      class="icon-button danger-icon"
                      title="Desativar vínculo"
                      [attr.aria-label]="'Desativar vínculo de ' + product.name"
                      (click)="deactivateLink(product)"
                      [disabled]="busyId() === product.id"
                    >
                      <i class="pi pi-link-slash"></i>
                    </button>
                  </div>
                } @else {
                  <div class="stock-link-empty">
                    <app-status-badge label="Sem vínculo" tone="neutral" />
                    <small>Sem baixa automática</small>
                  </div>
                  <button type="button" class="secondary-button compact-button" (click)="openLink(product)">
                    <i class="pi pi-link"></i>
                    Vincular
                  </button>
                }
              </article>
            }
          </div>
        } @else {
          <app-empty-state
            icon="pi pi-link"
            title="Nenhum produto"
            description="Cadastre produtos antes de criar vínculos."
          />
        }
      </app-section-card>
    }

    @if (itemDialog()) {
      <div class="modal-backdrop">
        <form
          class="modal-panel compact"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-item-dialog-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="itemDialog.set(false)"
          (ngSubmit)="saveItem()"
        >
          <div class="modal-header">
            <div class="modal-heading">
              <span class="modal-eyebrow">Estoque</span>
              <h2 id="stock-item-dialog-title">{{ editingItem() ? 'Editar item' : 'Novo item' }}</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar item" (click)="itemDialog.set(false)">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <label class="field">
              <span>Nome</span>
              <input name="stockName" maxlength="120" [(ngModel)]="itemForm.name" required autofocus />
            </label>

            <div class="form-grid stock-form-grid">
              <label class="field">
                <span>Unidade</span>
                <select name="stockUnit" [(ngModel)]="itemForm.unit">
                  @for (unit of units; track unit) {
                    <option [ngValue]="unit">{{ unitLabel(unit) }}</option>
                  }
                </select>
              </label>
              <label class="field">
                <span>Estoque mínimo</span>
                <input name="minimumStock" type="number" min="0" step="0.001" [(ngModel)]="itemForm.minimumStock" required />
              </label>
              @if (!editingItem()) {
                <label class="field">
                  <span>Saldo inicial</span>
                  <input name="currentStock" type="number" min="0" step="0.001" [(ngModel)]="itemForm.currentStock" required />
                </label>
              }
            </div>

            <label class="field">
              <span>Descrição <small>opcional</small></span>
              <textarea
                name="stockDescription"
                rows="3"
                maxlength="255"
                placeholder="Ex.: corte, marca ou forma de armazenamento"
                [(ngModel)]="itemForm.description"
              ></textarea>
              <small class="field-help">Use uma descrição curta para diferenciar itens parecidos.</small>
            </label>

            <label class="toggle-field stock-toggle-field">
              <input name="stockActive" type="checkbox" [(ngModel)]="itemForm.active" />
              <span>Item ativo</span>
            </label>
          </div>

          <div class="modal-footer modal-actions">
            <button type="button" class="ghost-button" (click)="itemDialog.set(false)">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving() || !itemForm.name.trim()">
              <i class="pi pi-save"></i>
              Salvar item
            </button>
          </div>
        </form>
      </div>
    }

    @if (movementDialog()) {
      <div class="modal-backdrop">
        <form
          class="modal-panel compact"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-movement-dialog-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="movementDialog.set(false)"
          (ngSubmit)="saveMovement()"
        >
          <div class="modal-header">
            <div class="modal-heading">
              <span class="modal-eyebrow">Estoque</span>
              <h2 id="stock-movement-dialog-title">Movimentar estoque</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar movimentação" (click)="movementDialog.set(false)">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <label class="field">
              <span>Item</span>
              <select name="movementItem" [(ngModel)]="movementForm.stockItemId" required autofocus>
                @for (item of activeItems(); track item.id) {
                  <option [ngValue]="item.id">{{ item.name }} · {{ stockValue(item.currentStock, item.unit) }}</option>
                }
              </select>
            </label>

            <div class="field">
              <span>Tipo de movimentação</span>
              <div class="segmented-control movement-types">
                @for (type of manualTypes; track type) {
                  <button
                    type="button"
                    [class.active]="movementForm.type === type"
                    (click)="movementForm.type = type"
                  >
                    {{ movementTypeLabel(type) }}
                  </button>
                }
              </div>
            </div>

            <label class="field">
              <span>{{ movementForm.type === 'ADJUSTMENT' ? 'Novo saldo' : 'Quantidade' }}</span>
              <input
                name="movementQuantity"
                type="number"
                [min]="movementForm.type === 'ADJUSTMENT' ? 0 : 0.001"
                step="0.001"
                [(ngModel)]="movementForm.quantity"
                required
              />
            </label>

            <label class="field">
              <span>Motivo <small>{{ requiresReason() ? 'obrigatório' : 'opcional' }}</small></span>
              <textarea
                name="movementReason"
                rows="3"
                maxlength="500"
                placeholder="Informe o contexto da movimentação"
                [(ngModel)]="movementForm.reason"
                [required]="requiresReason()"
              ></textarea>
            </label>
          </div>

          <div class="modal-footer modal-actions">
            <button type="button" class="ghost-button" (click)="movementDialog.set(false)">Cancelar</button>
            <button
              type="submit"
              class="primary-button"
              [disabled]="saving() || invalidMovementQuantity() || (requiresReason() && !movementForm.reason.trim())"
            >
              <i class="pi pi-check"></i>
              Confirmar
            </button>
          </div>
        </form>
      </div>
    }

    @if (linkDialog() && linkProduct(); as product) {
      <div class="modal-backdrop">
        <form
          class="modal-panel compact"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-link-dialog-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="linkDialog.set(false)"
          (ngSubmit)="saveLink(product)"
        >
          <div class="modal-header">
            <div class="modal-heading">
              <span class="modal-eyebrow">{{ product.name }}</span>
              <h2 id="stock-link-dialog-title">Baixa automática</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar vínculo" (click)="linkDialog.set(false)">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <p class="modal-description">Defina qual item e quantidade serão descontados a cada venda deste produto.</p>
            <label class="field">
              <span>Item de estoque</span>
              <select name="linkStockItem" [(ngModel)]="linkForm.stockItemId" required autofocus>
                @for (item of activeItems(); track item.id) {
                  <option [ngValue]="item.id">{{ item.name }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Quantidade por venda</span>
              <input
                name="linkQuantity"
                type="number"
                min="0.001"
                step="0.001"
                [(ngModel)]="linkForm.quantityPerSale"
                required
              />
            </label>
          </div>

          <div class="modal-footer modal-actions">
            <button type="button" class="ghost-button" (click)="linkDialog.set(false)">Cancelar</button>
            <button
              type="submit"
              class="primary-button"
              [disabled]="saving() || !linkForm.stockItemId || linkForm.quantityPerSale <= 0"
            >
              <i class="pi pi-link"></i>
              Salvar vínculo
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class StockPageComponent implements OnInit {
  private readonly api = inject(StockApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly feedback = inject(FeedbackService);
  readonly items = signal<StockItem[]>([]);
  readonly movements = signal<StockMovement[]>([]);
  readonly products = signal<Product[]>([]);
  readonly productLinks = signal<Map<number, ProductStockLink | null>>(new Map());
  readonly view = signal<StockView>('ITEMS');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);
  readonly itemDialog = signal(false);
  readonly editingItem = signal<StockItem | null>(null);
  readonly movementDialog = signal(false);
  readonly linkDialog = signal(false);
  readonly linkProduct = signal<Product | null>(null);
  searchTerm = '';
  itemForm: StockItemRequest = this.emptyItem();
  movementForm = { stockItemId: 0, type: 'ENTRY' as ManualMovement, quantity: 0, reason: '' };
  linkForm: ProductStockLinkRequest = { stockItemId: 0, quantityPerSale: 1 };
  readonly units: UnitOfMeasure[] = ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PACKAGE', 'TRAY'];
  readonly manualTypes: ManualMovement[] = ['ENTRY', 'EXIT', 'LOSS', 'ADJUSTMENT'];
  readonly activeItems = computed(() => this.items().filter((item) => item.active));
  readonly alertCount = computed(() => this.items().filter((item) => item.active && item.status !== 'NORMAL').length);

  filteredItems(): StockItem[] {
    const query = this.normalized(this.searchTerm);
    return this.items()
      .filter((item) => !query || this.normalized(item.name).includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      items: this.api.listItems(),
      movements: this.api.listMovements(),
      products: this.productApi.getAll(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ items, movements, products }) => {
        this.items.set(items);
        this.movements.set(movements);
        this.products.set(products);
        this.loadLinks(products);
      },
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  openItem(item: StockItem | null = null): void {
    this.editingItem.set(item);
    this.itemForm = item
      ? {
          name: item.name,
          description: item.description,
          unit: item.unit,
          currentStock: item.currentStock,
          minimumStock: item.minimumStock,
          active: item.active,
        }
      : this.emptyItem();
    this.itemDialog.set(true);
  }

  saveItem(): void {
    const name = this.itemForm.name.trim();
    if (!name || this.saving()) return;
    const editing = this.editingItem();
    const request = {
      ...this.itemForm,
      name,
      description: this.itemForm.description?.trim() || null,
      currentStock: Number(this.itemForm.currentStock),
      minimumStock: Number(this.itemForm.minimumStock),
    };
    this.saving.set(true);
    const operation = editing ? this.api.updateItem(editing.id, request) : this.api.createItem(request);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (item) => {
        this.replaceItem(item);
        this.itemDialog.set(false);
        this.feedback.success(editing ? 'Item atualizado.' : 'Item cadastrado.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  toggleItem(item: StockItem): void {
    this.busyId.set(item.id);
    this.api.setItemActive(item.id, !item.active).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: (updated) => {
        this.replaceItem(updated);
        this.feedback.success(updated.active ? 'Item ativado.' : 'Item desativado.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  openMovement(item: StockItem | null = null): void {
    const first = item ?? this.activeItems()[0];
    this.movementForm = { stockItemId: first?.id ?? 0, type: 'ENTRY', quantity: 0, reason: '' };
    this.movementDialog.set(true);
  }

  saveMovement(): void {
    const form = this.movementForm;
    if (
      !form.stockItemId ||
      this.invalidMovementQuantity() ||
      (this.requiresReason() && !form.reason.trim()) ||
      this.saving()
    ) return;

    this.saving.set(true);
    const reason = form.reason.trim() || null;
    const operation = form.type === 'ENTRY'
      ? this.api.entry({ stockItemId: form.stockItemId, quantity: Number(form.quantity), reason })
      : form.type === 'EXIT'
        ? this.api.exit({ stockItemId: form.stockItemId, quantity: Number(form.quantity), reason })
        : form.type === 'LOSS'
          ? this.api.loss({ stockItemId: form.stockItemId, quantity: Number(form.quantity), reason: form.reason.trim() })
          : this.api.adjust({ stockItemId: form.stockItemId, newStock: Number(form.quantity), reason: form.reason.trim() });

    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.movementDialog.set(false);
        this.feedback.success('Movimentação registrada.');
        this.refreshStock();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  invalidMovementQuantity(): boolean {
    return this.movementForm.type === 'ADJUSTMENT'
      ? this.movementForm.quantity < 0
      : this.movementForm.quantity <= 0;
  }

  requiresReason(): boolean {
    return this.movementForm.type === 'LOSS' || this.movementForm.type === 'ADJUSTMENT';
  }

  openLink(product: Product, link: ProductStockLink | null = null): void {
    this.linkProduct.set(product);
    this.linkForm = {
      stockItemId: link?.stockItemId ?? this.activeItems()[0]?.id ?? 0,
      quantityPerSale: link?.quantityPerSale ?? 1,
    };
    this.linkDialog.set(true);
  }

  saveLink(product: Product): void {
    if (!this.linkForm.stockItemId || this.linkForm.quantityPerSale <= 0 || this.saving()) return;
    const existing = this.linkFor(product.id);
    this.saving.set(true);
    const operation = existing
      ? this.api.updateProductLink(product.id, this.linkForm)
      : this.api.createProductLink(product.id, this.linkForm);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (link) => {
        this.productLinks.update((links) => new Map(links).set(product.id, link));
        this.linkDialog.set(false);
        this.feedback.success('Controle automático salvo.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  deactivateLink(product: Product): void {
    this.busyId.set(product.id);
    this.api.deactivateProductLink(product.id).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: () => {
        this.productLinks.update((links) => new Map(links).set(product.id, null));
        this.feedback.success('Controle automático desativado.');
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  linkFor(productId: number): ProductStockLink | null {
    return this.productLinks().get(productId) ?? null;
  }

  statusLabel(item: StockItem): string {
    return ({ NORMAL: 'OK', LOW_STOCK: 'Estoque baixo', OUT_OF_STOCK: 'Sem estoque' })[item.status];
  }

  statusTone(item: StockItem): string {
    return ({ NORMAL: 'success', LOW_STOCK: 'warning', OUT_OF_STOCK: 'danger' })[item.status];
  }

  movementTypeLabel(type: StockMovementType | ManualMovement): string {
    return ({
      ENTRY: 'Entrada',
      SALE: 'Venda',
      SALE_REVERSAL: 'Estorno',
      EXIT: 'Saída',
      LOSS: 'Perda',
      ADJUSTMENT: 'Ajuste',
    })[type];
  }

  movementTone(type: StockMovementType | ManualMovement): string {
    if (type === 'ENTRY' || type === 'SALE_REVERSAL') return 'success';
    if (type === 'LOSS') return 'danger';
    if (type === 'ADJUSTMENT') return 'warning';
    return 'info';
  }

  automaticReason(movement: StockMovement): string {
    if (movement.type === 'SALE') return 'Baixa automática da venda';
    if (movement.type === 'SALE_REVERSAL') return 'Cancelamento de item';
    return 'Sem observação';
  }

  signedQuantity(movement: StockMovement): string {
    const sign = movement.deltaQuantity > 0 ? '+' : '';
    return `${sign}${this.stockValue(movement.deltaQuantity, movement.unit)}`;
  }

  stockValue(value: number, unit: UnitOfMeasure): string {
    return formatStockValue(value, unit);
  }

  unitLabel(unit: UnitOfMeasure): string {
    return unitLabel(unit);
  }

  dateTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }

  private loadLinks(products: Product[]): void {
    if (products.length === 0) {
      this.productLinks.set(new Map());
      return;
    }
    forkJoin(products.map((product) => this.api.getProductLink(product.id).pipe(catchError(() => of(null)))))
      .subscribe((links) => this.productLinks.set(new Map(products.map((product, index) => [product.id, links[index]]))));
  }

  private refreshStock(): void {
    forkJoin({ items: this.api.listItems(), movements: this.api.listMovements() }).subscribe({
      next: ({ items, movements }) => {
        this.items.set(items);
        this.movements.set(movements);
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  private replaceItem(item: StockItem): void {
    this.items.update((items) => items.some((current) => current.id === item.id)
      ? items.map((current) => current.id === item.id ? item : current)
      : [...items, item]);
  }

  private emptyItem(): StockItemRequest {
    return { name: '', description: null, unit: 'UN', currentStock: 0, minimumStock: 0, active: true };
  }

  private normalized(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  }
}
