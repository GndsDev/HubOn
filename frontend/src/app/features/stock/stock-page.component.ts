import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { IngredientApiService } from '../../core/services/ingredient-api.service';
import { InventoryMovementApiService } from '../../core/services/inventory-movement-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import {
  Ingredient,
  IngredientRequest,
  StockControlMode,
  StockStatus,
  UnitOfMeasure,
} from '../../shared/models/ingredient.model';
import { InventoryMovement, InventoryMovementType } from '../../shared/models/inventory-movement.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { calculateOverlayPosition, OverlayPosition } from '../../shared/util/overlay-position';
import { formatStockValue, unitLabel as formatUnitLabel } from '../../shared/util/unit-format';

type StockFilter = 'ALL' | 'MANUAL' | 'DIRECT_SALE' | 'INACTIVE' | StockStatus;
type ManualMovementType = 'ENTRY' | 'EXIT' | 'LOSS' | 'ADJUSTMENT';

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
      kicker="Estoque"
      title="Estoque"
      description="Controle itens manuais, baixas automaticas, alertas e movimentacoes auditaveis."
    >
      @if (canManage()) {
        <button type="button" class="primary-button" (click)="openCreate()">
          <i class="pi pi-plus"></i>
          Novo item
        </button>
      }
    </app-page-header>

    <section class="stats-grid stock-stats-grid" aria-label="Indicadores de estoque">
      <article class="premium-card stat-card tone-blue">
        <div class="stat-icon"><i class="pi pi-list"></i></div>
        <div class="stat-copy"><span>Itens ativos</span><strong>{{ activeCount }}</strong><p>Cadastros disponiveis para uso.</p></div>
      </article>
      <article class="premium-card stat-card tone-amber">
        <div class="stat-icon"><i class="pi pi-exclamation-triangle"></i></div>
        <div class="stat-copy"><span>Estoque baixo</span><strong>{{ lowCount }}</strong><p>Itens abaixo ou iguais ao minimo.</p></div>
      </article>
      <article class="premium-card stat-card tone-purple">
        <div class="stat-icon"><i class="pi pi-ban"></i></div>
        <div class="stat-copy"><span>Zerados</span><strong>{{ outCount }}</strong><p>Itens com saldo atual igual a zero.</p></div>
      </article>
      <article class="premium-card stat-card tone-blue">
        <div class="stat-icon"><i class="pi pi-pencil"></i></div>
        <div class="stat-copy"><span>Controle manual</span><strong>{{ manualCount }}</strong><p>Itens sem baixa por pedido.</p></div>
      </article>
      <article class="premium-card stat-card tone-emerald">
        <div class="stat-icon"><i class="pi pi-bolt"></i></div>
        <div class="stat-copy"><span>Baixa automatica</span><strong>{{ directSaleCount }}</strong><p>Itens vinculaveis a produtos.</p></div>
      </article>
      <article class="premium-card stat-card tone-emerald">
        <div class="stat-icon"><i class="pi pi-history"></i></div>
        <div class="stat-copy"><span>Movimentos recentes</span><strong>{{ movements().length }}</strong><p>Ultimos registros auditaveis.</p></div>
      </article>
    </section>

    <app-section-card eyebrow="Itens" title="Itens de estoque cadastrados">
      <div card-action class="stock-toolbar">
        <label class="search-box">
          <i class="pi pi-search"></i>
          <input
            type="search"
            placeholder="Buscar item"
            aria-label="Buscar item de estoque"
            [(ngModel)]="searchTerm"
          />
        </label>
        <div class="segmented-control stock-filter" aria-label="Filtro de estoque">
          <button type="button" [class.active]="stockFilter === 'ALL'" (click)="stockFilter = 'ALL'">Todos<span>{{ ingredients().length }}</span></button>
          <button type="button" [class.active]="stockFilter === 'MANUAL'" (click)="stockFilter = 'MANUAL'">Controle manual<span>{{ manualCount }}</span></button>
          <button type="button" [class.active]="stockFilter === 'DIRECT_SALE'" (click)="stockFilter = 'DIRECT_SALE'">Baixa automatica<span>{{ directSaleCount }}</span></button>
          <button type="button" [class.active]="stockFilter === 'OUT_OF_STOCK'" (click)="stockFilter = 'OUT_OF_STOCK'">Zerados<span>{{ outCount }}</span></button>
          <button type="button" [class.active]="stockFilter === 'LOW_STOCK'" (click)="stockFilter = 'LOW_STOCK'">Estoque baixo<span>{{ lowCount }}</span></button>
          <button type="button" [class.active]="stockFilter === 'INACTIVE'" (click)="stockFilter = 'INACTIVE'">Inativos<span>{{ inactiveCount }}</span></button>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-grid">@for (item of [1,2,3,4]; track item) { <div class="loading-row"></div> }</div>
      } @else if (error()) {
        <div class="error-panel" role="alert">
          <i class="pi pi-exclamation-triangle"></i>
          <div><strong>Nao foi possivel carregar</strong><p>{{ error() }}</p></div>
          <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button>
        </div>
      } @else if (filteredIngredients.length === 0) {
        <app-empty-state
          icon="pi pi-box"
          title="Nenhum item encontrado"
          description="Cadastre um item ou ajuste os filtros."
        />
      } @else {
        <div class="stock-table">
          <div class="stock-table-head">
            <span>Item</span><span>Controle</span><span>Saldo</span><span>Minimo</span><span>Ideal</span><span>Status</span><span>Acoes</span>
          </div>
          @for (ingredient of filteredIngredients; track ingredient.id) {
            <article class="stock-row">
              <div class="stock-name">
                <strong>{{ ingredient.name }}</strong>
                <small>{{ ingredient.description || 'Sem descricao cadastrada' }}</small>
              </div>
              <app-status-badge
                [label]="controlModeLabel(ingredient.controlMode)"
                [tone]="controlModeTone(ingredient.controlMode)"
              />
              <b>{{ stockValue(ingredient.currentStock, ingredient.unit) }}</b>
              <span>{{ stockValue(ingredient.minimumStock, ingredient.unit) }}</span>
              <span>{{ stockValue(ingredient.idealStock, ingredient.unit) }}</span>
              <app-status-badge
                [label]="ingredient.active ? statusLabel(ingredient.stockStatus) : 'Inativo'"
                [tone]="ingredient.active ? statusTone(ingredient.stockStatus) : 'neutral'"
              />
              <div class="actions-menu-wrap stock-actions" (click)="$event.stopPropagation()">
                <button
                  type="button"
                  class="icon-action-button actions-trigger"
                  title="Acoes"
                  aria-haspopup="menu"
                  [attr.aria-expanded]="actionMenuOpen() === ingredient.id"
                  [attr.aria-controls]="'stock-actions-' + ingredient.id"
                  [attr.aria-label]="'Abrir acoes de ' + ingredient.name"
                  (click)="toggleActionMenu(ingredient.id, $event)"
                >
                  <i class="pi pi-ellipsis-v"></i>
                </button>
              </div>
            </article>
          }
        </div>
      }
    </app-section-card>

    @if (actionMenuIngredient(); as menuIngredient) {
      <div
        class="action-menu action-menu-overlay stock-action-menu"
        role="menu"
        [id]="'stock-actions-' + menuIngredient.id"
        [attr.data-stock-menu-id]="menuIngredient.id"
        [attr.data-placement]="actionMenuPosition().placement"
        [style.left.px]="actionMenuPosition().left"
        [style.top.px]="actionMenuPosition().top"
        [style.max-height.px]="actionMenuPosition().maxHeight"
        (click)="$event.stopPropagation()"
        (keydown)="onActionMenuKeydown($event)"
      >
        @if (canManage()) {
          <button type="button" role="menuitem" (click)="closeActionMenu(); openMovement(menuIngredient, 'ENTRY')">
            <i class="pi pi-plus-circle"></i>
            Entrada
          </button>
          <button type="button" role="menuitem" (click)="closeActionMenu(); openMovement(menuIngredient, 'EXIT')">
            <i class="pi pi-minus-circle"></i>
            Saida
          </button>
          <button type="button" role="menuitem" class="danger-menu-item" (click)="closeActionMenu(); openMovement(menuIngredient, 'LOSS')">
            <i class="pi pi-exclamation-triangle"></i>
            Perda
          </button>
          <button type="button" role="menuitem" (click)="closeActionMenu(); openMovement(menuIngredient, 'ADJUSTMENT')">
            <i class="pi pi-sliders-h"></i>
            Ajuste
          </button>
          <button type="button" role="menuitem" (click)="closeActionMenu(); openHistory(menuIngredient)">
            <i class="pi pi-history"></i>
            Ver historico
          </button>
          <button type="button" role="menuitem" (click)="closeActionMenu(); openEdit(menuIngredient)">
            <i class="pi pi-pencil"></i>
            Editar
          </button>
          <button type="button" role="menuitem" (click)="manageLinks()">
            <i class="pi pi-link"></i>
            Gerenciar vinculos
          </button>
          <button
            type="button"
            role="menuitem"
            [class.danger-menu-item]="menuIngredient.active"
            (click)="closeActionMenu(); toggle(menuIngredient)"
          >
            <i [class]="menuIngredient.active ? 'pi pi-ban' : 'pi pi-check'"></i>
            {{ menuIngredient.active ? 'Desativar' : 'Ativar' }}
          </button>
        } @else {
          <button type="button" role="menuitem" (click)="closeActionMenu(); openHistory(menuIngredient)">
            <i class="pi pi-history"></i>
            Ver historico
          </button>
        }
      </div>
    }

    <app-section-card eyebrow="Auditoria" title="Movimentacoes recentes">
      @if (movements().length === 0) {
        <app-empty-state icon="pi pi-history" title="Nenhuma movimentacao registrada" description="As entradas, saidas, perdas e ajustes aparecerao aqui." />
      } @else {
        <div class="movement-list">
          @for (movement of movements(); track movement.id) {
            <article class="movement-row">
              <div class="movement-icon" [ngClass]="movementTone(movement.type)">
                <i [class]="movementIcon(movement.type)"></i>
              </div>
              <div class="movement-main">
                <strong>{{ movement.ingredientName }}</strong>
                <span>{{ movementLabel(movement.type) }} por {{ movement.userName }}</span>
                <small>{{ movement.reason || 'Sem motivo informado' }}</small>
              </div>
              <div class="movement-side">
                <b>{{ stockValue(movement.quantity) }}</b>
                <small>{{ stockValue(movement.previousStock) }} -> {{ stockValue(movement.resultingStock) }}</small>
                <span>{{ dateTime(movement.createdAt) }}</span>
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
          aria-labelledby="ingredient-dialog-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="closeForm()"
          (click)="$event.stopPropagation()"
          (ngSubmit)="saveIngredient()"
        >
          <div class="modal-header">
            <div><span>Estoque</span><h2 id="ingredient-dialog-title">{{ editing() ? 'Editar item' : 'Novo item' }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeForm()"><i class="pi pi-times"></i></button>
          </div>
          <div class="form-grid">
            <label class="field full"><span>Nome</span><input name="name" [(ngModel)]="form.name" maxlength="120" required autofocus /></label>
            <label class="field full"><span>Descricao</span><textarea name="description" [(ngModel)]="form.description" maxlength="255"></textarea></label>
            <label class="field">
              <span>Unidade</span>
              <select name="unit" [(ngModel)]="form.unit" required>
                @for (unit of unitOptions; track unit.value) { <option [value]="unit.value">{{ unit.label }}</option> }
              </select>
            </label>
            <label class="field full">
              <span>Modo de controle</span>
              <select name="controlMode" [(ngModel)]="form.controlMode" required>
                @for (mode of controlModeOptions; track mode.value) {
                  <option [value]="mode.value">{{ mode.label }}</option>
                }
              </select>
              <small class="field-help">{{ controlModeHelp(form.controlMode) }}</small>
            </label>
            <label class="field"><span>Estoque minimo</span><input name="minimumStock" type="number" min="0" step="0.001" [(ngModel)]="form.minimumStock" required /></label>
            <label class="field"><span>Estoque ideal</span><input name="idealStock" type="number" min="0" step="0.001" [(ngModel)]="form.idealStock" required /></label>
            <label class="toggle-field"><input name="active" type="checkbox" [(ngModel)]="form.active" /><span>Item ativo</span></label>
          </div>
          <div class="modal-actions">
            <button type="button" class="ghost-button" (click)="closeForm()">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-check"></i>{{ saving() ? 'Salvando...' : 'Salvar item' }}</button>
          </div>
        </form>
      </div>
    }

    @if (movementOpen()) {
      <div class="modal-backdrop" (click)="closeMovement()">
        <form
          class="modal-panel compact"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="movement-dialog-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="closeMovement()"
          (click)="$event.stopPropagation()"
          (ngSubmit)="saveMovement()"
        >
          <div class="modal-header">
            <div><span>{{ movementIngredient()?.name }}</span><h2 id="movement-dialog-title">{{ movementTitle() }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeMovement()"><i class="pi pi-times"></i></button>
          </div>
          <div class="form-grid">
            @if (movementType() === 'EXIT') {
              <div class="balance-preview full" [class.danger]="exitOverStock()">
                <div>
                  <span>Saldo atual</span>
                  <strong>{{ stockValue(movementIngredient()?.currentStock ?? 0, movementIngredient()?.unit) }}</strong>
                </div>
                <div>
                  <span>Saida</span>
                  <strong>{{ stockValue(movementForm.quantity || 0, movementIngredient()?.unit) }}</strong>
                </div>
                <div>
                  <span>Saldo previsto</span>
                  <strong>{{ stockValue(predictedExitBalance(), movementIngredient()?.unit) }}</strong>
                </div>
              </div>
            }
            @if (movementType() === 'ADJUSTMENT') {
              <label class="field full"><span>Novo saldo fisico</span><input name="newStock" type="number" min="0" step="0.001" [(ngModel)]="movementForm.newStock" required autofocus /></label>
            } @else {
              <label class="field full"><span>Quantidade</span><input name="quantity" type="number" min="0.001" step="0.001" [(ngModel)]="movementForm.quantity" required autofocus /></label>
            }
            @if (movementType() === 'EXIT') {
              <label class="field full">
                <span>Motivo</span>
                <input name="reason" list="stock-exit-reasons" [(ngModel)]="movementForm.reason" maxlength="500" />
              </label>
              <datalist id="stock-exit-reasons">
                <option value="Consumo do dia"></option>
                <option value="Uso na producao"></option>
                <option value="Quebra operacional"></option>
                <option value="Correcao de fechamento"></option>
                <option value="Outro"></option>
              </datalist>
            } @else {
              <label class="field full"><span>Motivo</span><textarea name="reason" [(ngModel)]="movementForm.reason" maxlength="500" [required]="movementType() === 'LOSS' || movementType() === 'ADJUSTMENT'"></textarea></label>
            }
          </div>
          <div class="modal-actions">
            <button type="button" class="ghost-button" (click)="closeMovement()">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving() || exitOverStock()"><i class="pi pi-check"></i>{{ saving() ? 'Registrando...' : 'Registrar' }}</button>
          </div>
        </form>
      </div>
    }

    @if (historyOpen()) {
      <div class="modal-backdrop" (click)="closeHistory()">
        <section
          class="modal-panel wide"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-dialog-title"
          (dialogClose)="closeHistory()"
          (click)="$event.stopPropagation()"
        >
          <div class="modal-header">
            <div><span>Historico</span><h2 id="history-dialog-title">{{ historyIngredient()?.name }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeHistory()"><i class="pi pi-times"></i></button>
          </div>
          @if (historyLoading()) {
            <div class="loading-grid"><div class="loading-row"></div><div class="loading-row"></div></div>
          } @else if (historyMovements().length === 0) {
            <app-empty-state icon="pi pi-history" title="Sem historico" description="Este ingrediente ainda nao possui movimentacoes." />
          } @else {
            <div class="movement-list">
              @for (movement of historyMovements(); track movement.id) {
                <article class="movement-row">
                  <div class="movement-icon" [ngClass]="movementTone(movement.type)"><i [class]="movementIcon(movement.type)"></i></div>
                  <div class="movement-main">
                    <strong>{{ movementLabel(movement.type) }}</strong>
                    <span>{{ movement.userName }} - {{ dateTime(movement.createdAt) }}</span>
                    <small>{{ movement.reason || 'Sem motivo informado' }}</small>
                  </div>
                  <div class="movement-side">
                    <b>{{ stockValue(movement.quantity, historyIngredient()?.unit) }}</b>
                    <small>{{ stockValue(movement.previousStock, historyIngredient()?.unit) }} -> {{ stockValue(movement.resultingStock, historyIngredient()?.unit) }}</small>
                  </div>
                </article>
              }
            </div>
          }
        </section>
      </div>
    }
  `,
})
export class StockPageComponent implements OnInit {
  private readonly ingredientApi = inject(IngredientApiService);
  private readonly movementApi = inject(InventoryMovementApiService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  readonly ingredients = signal<Ingredient[]>([]);
  readonly movements = signal<InventoryMovement[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<Ingredient | null>(null);
  readonly movementOpen = signal(false);
  readonly movementIngredient = signal<Ingredient | null>(null);
  readonly movementType = signal<ManualMovementType>('ENTRY');
  readonly historyOpen = signal(false);
  readonly historyIngredient = signal<Ingredient | null>(null);
  readonly historyMovements = signal<InventoryMovement[]>([]);
  readonly historyLoading = signal(false);
  readonly actionMenuOpen = signal<number | null>(null);
  readonly actionMenuPosition = signal<OverlayPosition>({
    left: 0,
    top: 0,
    maxHeight: 320,
    placement: 'bottom',
  });

  private actionMenuTrigger: HTMLElement | null = null;
  private readonly actionMenuGap = 8;
  private readonly actionMenuViewportMargin = 12;

  readonly unitOptions: Array<{ value: UnitOfMeasure; label: string }> = [
    { value: 'KG', label: 'kg' },
    { value: 'G', label: 'g' },
    { value: 'L', label: 'L' },
    { value: 'ML', label: 'mL' },
    { value: 'UN', label: 'UN' },
    { value: 'CX', label: 'CX' },
    { value: 'PACKAGE', label: 'Pacote' },
    { value: 'TRAY', label: 'Bandeja' },
  ];

  readonly controlModeOptions: Array<{ value: StockControlMode; label: string }> = [
    { value: 'MANUAL', label: 'Controle manual' },
    { value: 'DIRECT_SALE', label: 'Baixa automatica' },
  ];

  searchTerm = '';
  stockFilter: StockFilter = 'ALL';
  form: IngredientRequest = this.emptyForm();
  movementForm = { quantity: 0, newStock: 0, reason: '' };

  ngOnInit(): void {
    this.load();
  }

  manageLinks(): void {
    this.closeActionMenu();
    void this.router.navigate(['/produtos']);
  }

  get activeCount(): number {
    return this.ingredients().filter((ingredient) => ingredient.active).length;
  }

  get outCount(): number {
    return this.ingredients().filter((ingredient) => ingredient.active && ingredient.stockStatus === 'OUT_OF_STOCK').length;
  }

  get lowCount(): number {
    return this.ingredients().filter((ingredient) => ingredient.active && ingredient.stockStatus === 'LOW_STOCK').length;
  }

  get manualCount(): number {
    return this.ingredients().filter((ingredient) => ingredient.active && ingredient.controlMode === 'MANUAL').length;
  }

  get directSaleCount(): number {
    return this.ingredients().filter((ingredient) => ingredient.active && ingredient.controlMode === 'DIRECT_SALE').length;
  }

  get normalCount(): number {
    return this.ingredients().filter((ingredient) => ingredient.active && ingredient.stockStatus === 'NORMAL').length;
  }

  get inactiveCount(): number {
    return this.ingredients().filter((ingredient) => !ingredient.active).length;
  }

  get filteredIngredients(): Ingredient[] {
    const search = this.normalize(this.searchTerm);
    return this.ingredients().filter((ingredient) => {
      const matchesSearch = !search || this.normalize(`${ingredient.name} ${ingredient.description ?? ''}`).includes(search);
      const matchesFilter = this.stockFilter === 'ALL'
        || (this.stockFilter === 'INACTIVE'
          ? !ingredient.active
          : ingredient.active && (
            ingredient.stockStatus === this.stockFilter
            || ingredient.controlMode === this.stockFilter
          ));
      return matchesSearch && matchesFilter;
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ ingredients: this.ingredientApi.getAll(), movements: this.movementApi.getRecent() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ ingredients, movements }) => {
          this.ingredients.set(ingredients);
          this.movements.set(movements);
        },
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  canManage(): boolean {
    return this.auth.hasAnyRole(['OWNER', 'ADMIN']);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeActionMenu();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeActionMenu();
    }
  }

  @HostListener('window:resize')
  onViewportResize(): void {
    this.repositionActionMenu();
  }

  @HostListener('window:scroll')
  onViewportScroll(): void {
    this.repositionActionMenu();
  }

  toggleActionMenu(ingredientId: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.actionMenuOpen() === ingredientId) {
      this.closeActionMenu();
      return;
    }

    this.actionMenuTrigger = event.currentTarget as HTMLElement;
    this.actionMenuPosition.set({
      left: -9999,
      top: -9999,
      maxHeight: 9999,
      placement: 'bottom',
    });
    this.actionMenuOpen.set(ingredientId);
    this.scheduleActionMenuPlacement(ingredientId);
  }

  closeActionMenu(): void {
    this.actionMenuOpen.set(null);
    this.actionMenuTrigger = null;
  }

  actionMenuIngredient(): Ingredient | null {
    const ingredientId = this.actionMenuOpen();
    if (ingredientId === null) return null;
    return this.ingredients().find((ingredient) => ingredient.id === ingredientId) ?? null;
  }

  onActionMenuKeydown(event: KeyboardEvent): void {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'];
    if (!keys.includes(event.key)) return;

    event.preventDefault();
    if (event.key === 'Escape') {
      this.closeActionMenu();
      return;
    }

    const menu = (event.target as HTMLElement | null)?.closest<HTMLElement>('.stock-action-menu');
    const items = Array.from(menu?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    if (!items.length) return;

    const currentIndex = Math.max(0, items.indexOf(event.target as HTMLButtonElement));
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.formOpen.set(true);
  }

  openEdit(ingredient: Ingredient): void {
    this.editing.set(ingredient);
    this.form = {
      name: ingredient.name,
      description: ingredient.description,
      unit: ingredient.unit,
      controlMode: ingredient.controlMode,
      minimumStock: ingredient.minimumStock,
      idealStock: ingredient.idealStock,
      active: ingredient.active,
    };
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  saveIngredient(): void {
    if (!this.form.name.trim() || this.form.minimumStock < 0 || this.form.idealStock < this.form.minimumStock) {
      this.feedback.error('Preencha nome, minimo e ideal validos.');
      return;
    }

    this.saving.set(true);
    const current = this.editing();
    const request = {
      ...this.form,
      name: this.form.name.trim(),
      description: this.form.description || null,
    };
    const operation = current ? this.ingredientApi.update(current.id, request) : this.ingredientApi.create(request);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.feedback.success(current ? 'Item atualizado com sucesso.' : 'Item salvo com sucesso.');
        this.closeForm();
        this.load();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  toggle(ingredient: Ingredient): void {
    const operation = ingredient.active ? this.ingredientApi.deactivate(ingredient.id) : this.ingredientApi.activate(ingredient.id);
    operation.subscribe({
      next: () => {
        this.feedback.success(ingredient.active ? 'Item desativado com sucesso.' : 'Item ativado com sucesso.');
        this.load();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  openMovement(ingredient: Ingredient, type: ManualMovementType): void {
    if (!ingredient.active) {
      this.feedback.error('Item inativo nao pode movimentar estoque.');
      return;
    }
    this.movementIngredient.set(ingredient);
    this.movementType.set(type);
    this.movementForm = { quantity: 0, newStock: ingredient.currentStock, reason: '' };
    this.movementOpen.set(true);
  }

  closeMovement(): void {
    this.movementOpen.set(false);
  }

  saveMovement(): void {
    const ingredient = this.movementIngredient();
    if (!ingredient) return;

    const type = this.movementType();
    const reason = this.movementForm.reason.trim();
    if ((type === 'LOSS' || type === 'ADJUSTMENT') && !reason) {
      this.feedback.error('Informe o motivo da movimentacao.');
      return;
    }
    if (type === 'ADJUSTMENT' && this.movementForm.newStock < 0) {
      this.feedback.error('Informe um novo saldo valido.');
      return;
    }
    if (type !== 'ADJUSTMENT' && this.movementForm.quantity <= 0) {
      this.feedback.error('Informe uma quantidade maior que zero.');
      return;
    }
    if (type === 'EXIT' && this.exitOverStock()) {
      this.feedback.error('A saida informada ultrapassa o saldo atual.');
      return;
    }

    this.saving.set(true);
    const operation = type === 'ENTRY'
      ? this.movementApi.registerEntry({ ingredientId: ingredient.id, quantity: this.movementForm.quantity, reason: reason || null })
      : type === 'EXIT'
        ? this.movementApi.registerExit({ ingredientId: ingredient.id, quantity: this.movementForm.quantity, reason: reason || null })
        : type === 'LOSS'
          ? this.movementApi.registerLoss({ ingredientId: ingredient.id, quantity: this.movementForm.quantity, reason })
          : this.movementApi.registerAdjustment({ ingredientId: ingredient.id, newStock: this.movementForm.newStock, reason });

    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.feedback.success('Movimentacao registrada com sucesso.');
        this.closeMovement();
        this.load();
        if (this.historyOpen() && this.historyIngredient()?.id === ingredient.id) {
          this.loadHistory(ingredient.id);
        }
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  openHistory(ingredient: Ingredient): void {
    this.historyIngredient.set(ingredient);
    this.historyOpen.set(true);
    this.loadHistory(ingredient.id);
  }

  closeHistory(): void {
    this.historyOpen.set(false);
  }

  loadHistory(ingredientId: number): void {
    this.historyLoading.set(true);
    this.movementApi.getByIngredient(ingredientId)
      .pipe(finalize(() => this.historyLoading.set(false)))
      .subscribe({
        next: (movements) => this.historyMovements.set(movements),
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  stockValue(value: number, unit?: UnitOfMeasure): string {
    return formatStockValue(value, unit);
  }

  statusLabel(status: StockStatus): string {
    return {
      OUT_OF_STOCK: 'Zerado',
      LOW_STOCK: 'Baixo',
      NORMAL: 'Normal',
    }[status];
  }

  statusTone(status: StockStatus): string {
    return {
      OUT_OF_STOCK: 'danger',
      LOW_STOCK: 'warning',
      NORMAL: 'success',
    }[status];
  }

  controlModeLabel(mode: StockControlMode): string {
    return {
      MANUAL: 'Controle manual',
      DIRECT_SALE: 'Baixa automatica',
    }[mode];
  }

  controlModeTone(mode: StockControlMode): string {
    return {
      MANUAL: 'neutral',
      DIRECT_SALE: 'info',
    }[mode];
  }

  controlModeHelp(mode: StockControlMode): string {
    return mode === 'DIRECT_SALE'
      ? 'Variacoes vinculadas baixam este item uma vez ao confirmar o pedido.'
      : 'Pedidos nao movimentam este item; entradas e saidas continuam manuais.';
  }

  movementTitle(): string {
    return {
      ENTRY: 'Registrar entrada',
      EXIT: 'Registrar saida',
      LOSS: 'Registrar perda',
      ADJUSTMENT: 'Ajustar saldo',
    }[this.movementType()];
  }

  movementLabel(type: InventoryMovementType): string {
    return {
      ENTRY: 'Entrada',
      EXIT: 'Saida',
      LOSS: 'Perda',
      ADJUSTMENT: 'Ajuste',
      SALE: 'Venda',
      REVERSAL: 'Estorno',
    }[type];
  }

  movementTone(type: InventoryMovementType): string {
    return {
      ENTRY: 'success',
      EXIT: 'info',
      LOSS: 'danger',
      ADJUSTMENT: 'warning',
      SALE: 'info',
      REVERSAL: 'neutral',
    }[type];
  }

  movementIcon(type: InventoryMovementType): string {
    return {
      ENTRY: 'pi pi-plus',
      EXIT: 'pi pi-minus',
      LOSS: 'pi pi-exclamation-triangle',
      ADJUSTMENT: 'pi pi-sliders-h',
      SALE: 'pi pi-shopping-cart',
      REVERSAL: 'pi pi-undo',
    }[type];
  }

  predictedExitBalance(): number {
    const currentStock = this.movementIngredient()?.currentStock ?? 0;
    return currentStock - (Number(this.movementForm.quantity) || 0);
  }

  exitOverStock(): boolean {
    return this.movementType() === 'EXIT' && this.predictedExitBalance() < 0;
  }

  dateTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  unitLabel(unit: UnitOfMeasure): string {
    return formatUnitLabel(unit);
  }

  private emptyForm(): IngredientRequest {
    return {
      name: '',
      description: '',
      unit: 'UN',
      controlMode: 'MANUAL',
      minimumStock: 0,
      idealStock: 0,
      active: true,
    };
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  }

  private scheduleActionMenuPlacement(ingredientId: number): void {
    const frame = this.document.defaultView?.requestAnimationFrame ?? ((callback: FrameRequestCallback) => window.setTimeout(callback, 0));
    frame(() => {
      this.repositionActionMenu();
      this.focusFirstAction(ingredientId);
    });
  }

  private repositionActionMenu(): void {
    const ingredientId = this.actionMenuOpen();
    const trigger = this.actionMenuTrigger;
    const view = this.document.defaultView;
    if (ingredientId === null || !trigger || !trigger.isConnected || !view) return;

    const menu = this.document.querySelector<HTMLElement>(`[data-stock-menu-id="${ingredientId}"]`);
    if (!menu) return;

    this.actionMenuPosition.set(calculateOverlayPosition(
      trigger.getBoundingClientRect(),
      menu.getBoundingClientRect(),
      view.innerWidth,
      view.innerHeight,
      this.actionMenuGap,
      this.actionMenuViewportMargin,
    ));
  }

  private focusFirstAction(ingredientId: number): void {
    this.document
      .querySelector<HTMLButtonElement>(`[data-stock-menu-id="${ingredientId}"] button`)
      ?.focus();
  }
}
