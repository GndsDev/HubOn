import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { UserApiService } from '../../core/services/user-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { User } from '../../shared/models/user.model';
import { apiErrorMessage } from '../../shared/util/api-error';

interface RoleOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-users-page',
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
      kicker="Gestão de acesso"
      title="Usuários"
      description="Cadastre operadores conforme a hierarquia de perfis do restaurante."
    >
      <button type="button" class="primary-button" [disabled]="!canCreateUsers()" (click)="openCreate()">
        <i class="pi pi-user-plus"></i>
        Novo usuário
      </button>
    </app-page-header>

    <app-section-card eyebrow="API local" title="Usuários cadastrados">
      @if (loading()) {
        <div class="user-grid" aria-label="Carregando usuários">
          @for (item of [1, 2, 3]; track item) {
            <div class="user-card loading-card"></div>
          }
        </div>
      } @else if (error()) {
        <div class="error-panel" role="alert">
          <i class="pi pi-exclamation-triangle"></i>
          <div>
            <strong>Não foi possível carregar</strong>
            <p>{{ error() }}</p>
          </div>
          <button type="button" class="ghost-button" (click)="load()">
            <i class="pi pi-refresh"></i>
            Tentar novamente
          </button>
        </div>
      } @else if (users().length === 0) {
        <app-empty-state
          icon="pi pi-users"
          title="Nenhum usuário cadastrado"
          description="Os usuários locais disponíveis aparecerão aqui."
        />
      } @else {
        <div class="user-grid">
          @for (user of users(); track user.id) {
            <article class="user-card">
              <div class="user-card-header">
                <div class="user-avatar" aria-hidden="true">
                  <i class="pi pi-user"></i>
                </div>

                <div class="user-identity">
                  <strong>{{ user.name }}</strong>
                  <span>{{ user.email }}</span>
                </div>

                <app-status-badge
                  [label]="user.active ? 'Ativo' : 'Inativo'"
                  [tone]="user.active ? 'success' : 'neutral'"
                />
              </div>

              <div class="user-card-meta">
                <span>
                  <i class="pi pi-shield"></i>
                  Perfis: {{ roleNames(user) }}
                </span>
                <span class="availability">
                  <i [class]="user.active ? 'pi pi-check-circle' : 'pi pi-ban'"></i>
                  {{ user.active ? 'Disponível para operação' : 'Indisponível para operação' }}
                </span>
              </div>
            </article>
          }
        </div>
      }
    </app-section-card>

    @if (formOpen()) {
      <div class="modal-backdrop" (click)="closeCreate()">
        <form
          class="modal-panel compact"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-form-dialog-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="closeCreate()"
          (click)="$event.stopPropagation()"
          (ngSubmit)="create()"
        >
          <div class="modal-header">
            <div>
              <span>Permissões</span>
              <h2 id="user-form-dialog-title">Novo usuário</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeCreate()">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="form-grid">
            <label class="field full">
              <span>Nome</span>
              <input name="name" [(ngModel)]="form.name" maxlength="120" required autofocus />
            </label>
            <label class="field full">
              <span>E-mail</span>
              <input name="email" type="email" [(ngModel)]="form.email" maxlength="160" required />
            </label>
            <label class="field">
              <span>Senha inicial</span>
              <input name="password" type="password" [(ngModel)]="form.password" minlength="6" required />
            </label>
            <label class="field">
              <span>Perfil</span>
              <select name="role" [(ngModel)]="form.role">
                @for (role of roleOptions(); track role.value) {
                  <option [value]="role.value">{{ role.label }}</option>
                }
              </select>
            </label>
            <label class="toggle-field full">
              <input name="active" type="checkbox" [(ngModel)]="form.active" />
              <span>Usuário ativo</span>
            </label>
          </div>

          <div class="modal-actions">
            <button type="button" class="ghost-button" (click)="closeCreate()">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving()">
              <i class="pi pi-check"></i>
              {{ saving() ? 'Criando...' : 'Criar usuário' }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class UsersPageComponent implements OnInit {
  private readonly api = inject(UserApiService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  form = this.emptyForm();

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (users) => this.users.set(users),
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  openCreate(): void {
    const firstRole = this.roleOptions()[0]?.value ?? 'WAITER';
    this.form = { ...this.emptyForm(), role: firstRole };
    this.formOpen.set(true);
  }

  closeCreate(): void {
    if (this.saving()) return;
    this.formOpen.set(false);
  }

  create(): void {
    if (!this.form.name.trim() || !this.form.email.trim() || this.form.password.length < 6) {
      this.feedback.error('Preencha nome, e-mail e senha com pelo menos 6 caracteres.');
      return;
    }

    this.saving.set(true);
    this.api.create({
      name: this.form.name.trim(),
      email: this.form.email.trim(),
      password: this.form.password,
      active: this.form.active,
      roles: [this.form.role],
    })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Usuário criado com sucesso.');
          this.closeCreate();
          this.load();
        },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  canCreateUsers(): boolean {
    const roles = this.auth.currentUser()?.roles ?? [];
    return roles.includes('OWNER') || roles.includes('ADMIN');
  }

  roleOptions(): RoleOption[] {
    const roles = this.auth.currentUser()?.roles ?? [];
    if (roles.includes('OWNER')) {
      return [
        { value: 'ADMIN', label: 'Administrador' },
        { value: 'WAITER', label: 'Garçom' },
        { value: 'KITCHEN', label: 'Cozinha' },
        { value: 'CASHIER', label: 'Caixa' },
      ];
    }
    if (roles.includes('ADMIN')) {
      return [
        { value: 'WAITER', label: 'Garçom' },
        { value: 'KITCHEN', label: 'Cozinha' },
        { value: 'CASHIER', label: 'Caixa' },
      ];
    }
    return [];
  }

  roleNames(user: User): string {
    return user.roles.length ? user.roles.map((role) => this.roleLabel(role)).join(', ') : 'Nenhum perfil';
  }

  private roleLabel(role: string): string {
    return {
      OWNER: 'Dono',
      ADMIN: 'Administrador',
      WAITER: 'Garçom',
      KITCHEN: 'Cozinha',
      CASHIER: 'Caixa',
    }[role] ?? role;
  }

  private emptyForm(): { name: string; email: string; password: string; active: boolean; role: string } {
    return { name: '', email: '', password: '', active: true, role: 'WAITER' };
  }
}
