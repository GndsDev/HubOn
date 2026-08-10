import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
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

interface UserForm {
  name: string;
  username: string;
  password: string;
  active: boolean;
  role: string;
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
      description="Consulte os usuários do sistema e cadastre novos gerentes."
    >
      <div
        page-actions
        class="page-header-actions"
      >
        <button
          type="button"
          class="primary-button"
          [disabled]="!canCreateUsers()"
          (click)="openCreate()"
        >
          <i class="pi pi-user-plus"></i>
          Novo gerente
        </button>
      </div>
    </app-page-header>

    <app-section-card
      eyebrow="Acessos"
      title="Usuários cadastrados"
    >
      @if (loading()) {
        <div
          class="user-grid"
          aria-label="Carregando usuários"
        >
          @for (item of [1, 2, 3]; track item) {
            <div class="user-card loading-card"></div>
          }
        </div>
      } @else if (error()) {
        <div
          class="error-panel"
          role="alert"
        >
          <i class="pi pi-exclamation-triangle"></i>

          <div>
            <strong>
              Não foi possível carregar
            </strong>

            <p>{{ error() }}</p>
          </div>

          <button
            type="button"
            class="ghost-button"
            (click)="load()"
          >
            <i class="pi pi-refresh"></i>
            Tentar novamente
          </button>
        </div>
      } @else if (users().length === 0) {
        <app-empty-state
          icon="pi pi-users"
          title="Nenhum usuário cadastrado"
          description="Os usuários cadastrados no sistema aparecerão aqui."
        />
      } @else {
        <div class="user-grid">
          @for (user of users(); track user.id) {
            <article class="user-card">
              <div class="user-card-header">
                <div
                  class="user-avatar"
                  aria-hidden="true"
                >
                  <i class="pi pi-user"></i>
                </div>

                <div class="user-identity">
                  <strong>{{ user.name }}</strong>
                  <span>{{ user.username }}</span>
                </div>

                <app-status-badge
                  [label]="
                    user.active
                      ? 'Ativo'
                      : 'Inativo'
                  "
                  [tone]="
                    user.active
                      ? 'success'
                      : 'neutral'
                  "
                />
              </div>

              <div class="user-card-meta">
                <span>
                  <i class="pi pi-shield"></i>
                  Perfil: {{ roleNames(user) }}
                </span>

                <span class="availability">
                  <i
                    [class]="
                      user.active
                        ? 'pi pi-check-circle'
                        : 'pi pi-ban'
                    "
                  ></i>

                  {{
                    user.active
                      ? 'Acesso disponível'
                      : 'Acesso desativado'
                  }}
                </span>
              </div>
            </article>
          }
        </div>
      }
    </app-section-card>

    @if (formOpen()) {
      <div
        class="modal-backdrop"
        (click)="closeCreate()"
      >
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
            <div class="modal-heading">
              <span class="modal-eyebrow">
                Permissões
              </span>

              <h2 id="user-form-dialog-title">
                Novo gerente
              </h2>
            </div>

            <button
              type="button"
              class="icon-button"
              aria-label="Fechar"
              [disabled]="saving()"
              (click)="closeCreate()"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <div class="form-grid">
              <label class="field full">
                <span>Nome</span>

                <input
                  name="name"
                  [(ngModel)]="form.name"
                  maxlength="120"
                  required
                  autofocus
                />
              </label>

              <label class="field full">
                <span>Usuário</span>

                <input
                  name="username"
                  type="text"
                  autocomplete="username"
                  [(ngModel)]="form.username"
                  minlength="3"
                  maxlength="40"
                  pattern="[A-Za-z0-9._-]{3,40}"
                  required
                />
              </label>

              <label class="field">
                <span>Senha inicial</span>

                <input
                  name="password"
                  type="password"
                  [(ngModel)]="form.password"
                  minlength="6"
                  required
                />
              </label>

              <label class="field">
                <span>Perfil</span>

                <select
                  name="role"
                  [(ngModel)]="form.role"
                  required
                >
                  @for (
                    role of roleOptions();
                    track role.value
                  ) {
                    <option [value]="role.value">
                      {{ role.label }}
                    </option>
                  }
                </select>
              </label>

              <label class="toggle-field full">
                <input
                  name="active"
                  type="checkbox"
                  [(ngModel)]="form.active"
                />

                <span>Usuário ativo</span>
              </label>
            </div>
          </div>

          <div class="modal-footer modal-actions">
            <button
              type="button"
              class="ghost-button"
              [disabled]="saving()"
              (click)="closeCreate()"
            >
              Cancelar
            </button>

            <button
              type="submit"
              class="primary-button"
              [disabled]="saving()"
            >
              <i class="pi pi-check"></i>

              {{
                saving()
                  ? 'Criando...'
                  : 'Criar gerente'
              }}
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

  form: UserForm = this.emptyForm();

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (this.loading() && this.users().length > 0) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api
      .getAll()
      .pipe(
        finalize(() => {
          this.loading.set(false);
        }),
      )
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.error.set(null);
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(error),
          );
        },
      });
  }

  openCreate(): void {
    if (!this.canCreateUsers()) {
      this.feedback.error(
        'Somente o dono pode cadastrar novos gerentes.',
      );

      return;
    }

    this.form = this.emptyForm();
    this.formOpen.set(true);
  }

  closeCreate(): void {
    if (this.saving()) {
      return;
    }

    this.formOpen.set(false);
  }

  create(): void {
    if (!this.canCreateUsers()) {
      this.feedback.error(
        'Somente o dono pode cadastrar novos gerentes.',
      );

      return;
    }

    if (
      !this.form.name.trim() ||
      !this.form.username.trim() ||
      this.form.password.length < 6
    ) {
      this.feedback.error(
        'Preencha nome, usuário e senha com pelo menos 6 caracteres.',
      );

      return;
    }

    const username = this.form.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      this.feedback.error(
        'Use de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.',
      );

      return;
    }

    if (this.form.role !== 'ADMIN') {
      this.feedback.error(
        'O perfil selecionado não é permitido.',
      );

      return;
    }

    this.saving.set(true);

    this.api
      .create({
        name: this.form.name.trim(),
        username,
        password: this.form.password,
        active: this.form.active,
        roles: ['ADMIN'],
      })
      .pipe(
        finalize(() => {
          this.saving.set(false);
        }),
      )
      .subscribe({
        next: () => {
          this.feedback.success(
            'Gerente criado com sucesso.',
          );

          this.formOpen.set(false);
          this.load();
        },
        error: (error) => {
          this.feedback.error(
            apiErrorMessage(error),
          );
        },
      });
  }

  canCreateUsers(): boolean {
    const roles =
      this.auth.currentUser()?.roles ?? [];

    return roles.includes('OWNER');
  }

  roleOptions(): RoleOption[] {
    if (!this.canCreateUsers()) {
      return [];
    }

    return [
      {
        value: 'ADMIN',
        label: 'Gerente',
      },
    ];
  }

  roleNames(user: User): string {
    if (user.roles.length === 0) {
      return 'Nenhum perfil';
    }

    return user.roles
      .map((role) => this.roleLabel(role))
      .join(', ');
  }

  private roleLabel(role: string): string {
    const labels: Record<string, string> = {
      OWNER: 'Dono',
      ADMIN: 'Gerente',

      /*
       * Mantidos somente para exibir corretamente
       * usuários antigos já cadastrados.
       */
      WAITER: 'Garçom — perfil antigo',
      KITCHEN: 'Preparo — perfil antigo',
      CASHIER: 'Caixa — perfil antigo',
    };

    return labels[role] ?? role;
  }

  private emptyForm(): UserForm {
    return {
      name: '',
      username: '',
      password: '',
      active: true,
      role: 'ADMIN',
    };
  }
}
