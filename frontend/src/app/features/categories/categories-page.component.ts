import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { CategoryApiService } from '../../core/services/category-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { Category, CategoryRequest } from '../../shared/models/category.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-categories-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-page-header
      kicker="Cardápio"
      title="Categorias"
      description="Organize produtos por grupos de venda e disponibilidade."
    >
      <button type="button" class="primary-button" (click)="openCreate()">
        <i class="pi pi-plus"></i>
        Nova categoria
      </button>
    </app-page-header>

    <div class="categories-section">
      <app-section-card eyebrow="Estrutura do cardápio" title="Categorias cadastradas">
        @if (loading()) {
          <div class="category-grid">
            @for (item of [1, 2, 3, 4]; track item) {
              <div class="category-card loading-card"></div>
            }
          </div>
        } @else if (error()) {
          <div class="error-panel" role="alert">
            <i class="pi pi-exclamation-triangle"></i>
            <div><strong>Não foi possível carregar</strong><p>{{ error() }}</p></div>
            <button type="button" class="ghost-button" (click)="load()">
              <i class="pi pi-refresh"></i> Tentar novamente
            </button>
          </div>
        } @else if (categories().length === 0) {
          <app-empty-state
            icon="pi pi-tags"
            title="Nenhuma categoria cadastrada"
            description="Crie a primeira categoria para organizar o cardápio."
          />
        } @else {
          <div class="category-grid">
            @for (category of categories(); track category.id) {
              <article class="category-card">
                <div class="category-card-header">
                  <div class="category-icon"><i class="pi pi-tags"></i></div>
                  <app-status-badge
                    [label]="category.active ? 'Ativa' : 'Inativa'"
                    [tone]="category.active ? 'success' : 'neutral'"
                  />
                </div>
                <div class="category-content">
                  <strong [title]="category.name">{{ category.name }}</strong>
                  <p [class.category-description-empty]="!category.description">
                    {{ category.description || 'Sem descrição cadastrada.' }}
                  </p>
                  <small>Ordem de exibição: {{ category.displayOrder }}</small>
                </div>
                <div class="category-actions">
                  <button
                    type="button"
                    class="ghost-button"
                    title="Editar categoria"
                    [attr.aria-label]="'Editar categoria ' + category.name"
                    (click)="openEdit(category)"
                  >
                    <i class="pi pi-pencil"></i>
                    Editar
                  </button>
                  <button
                    type="button"
                    class="category-status-action"
                    [class.activate]="!category.active"
                    [title]="category.active ? 'Desativar categoria' : 'Ativar categoria'"
                    [attr.aria-label]="(category.active ? 'Desativar categoria ' : 'Ativar categoria ') + category.name"
                    (click)="toggle(category)"
                  >
                    <i [class]="category.active ? 'pi pi-ban' : 'pi pi-check'"></i>
                    {{ category.active ? 'Desativar' : 'Ativar' }}
                  </button>
                </div>
              </article>
            }
          </div>
        }
      </app-section-card>
    </div>

    @if (formOpen()) {
      <div class="modal-backdrop" (click)="closeForm()">
        <form class="modal-panel" (click)="$event.stopPropagation()" (ngSubmit)="save()">
          <div class="modal-header">
            <div>
              <span>Cardápio</span>
              <h2>{{ editing() ? 'Editar categoria' : 'Nova categoria' }}</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeForm()">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div class="form-grid">
            <label class="field full">
              <span>Nome</span>
              <input name="name" [(ngModel)]="form.name" maxlength="120" required />
            </label>
            <label class="field full">
              <span>Descrição</span>
              <textarea name="description" [(ngModel)]="form.description" maxlength="255"></textarea>
            </label>
            <label class="field">
              <span>Ordem de exibição</span>
              <input name="displayOrder" type="number" min="0" [(ngModel)]="form.displayOrder" />
            </label>
            <label class="toggle-field">
              <input name="active" type="checkbox" [(ngModel)]="form.active" />
              <span>Categoria ativa</span>
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" class="ghost-button" (click)="closeForm()">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving()">
              <i class="pi pi-check"></i>
              {{ saving() ? 'Salvando...' : 'Salvar categoria' }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class CategoriesPageComponent implements OnInit {
  private readonly api = inject(CategoryApiService);
  private readonly feedback = inject(FeedbackService);

  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<Category | null>(null);

  form: CategoryRequest = this.emptyForm();

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAll().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (categories) => this.categories.set(categories),
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.formOpen.set(true);
  }

  openEdit(category: Category): void {
    this.editing.set(category);
    this.form = {
      name: category.name,
      description: category.description,
      displayOrder: category.displayOrder,
      active: category.active,
    };
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  save(): void {
    if (!this.form.name.trim()) {
      this.feedback.error('Informe o nome da categoria.');
      return;
    }

    this.saving.set(true);
    const current = this.editing();
    const request = { ...this.form, name: this.form.name.trim() };
    const operation = current ? this.api.update(current.id, request) : this.api.create(request);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.feedback.success(current ? 'Registro atualizado com sucesso.' : 'Registro salvo com sucesso.');
        this.closeForm();
        this.load();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  toggle(category: Category): void {
    const operation = category.active ? this.api.deactivate(category.id) : this.api.activate(category.id);
    operation.subscribe({
      next: () => {
        this.feedback.success(
          category.active ? 'Registro desativado com sucesso.' : 'Registro atualizado com sucesso.',
        );
        this.load();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  private emptyForm(): CategoryRequest {
    return { name: '', description: '', displayOrder: 0, active: true };
  }
}
