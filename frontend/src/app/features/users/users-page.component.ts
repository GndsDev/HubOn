import { Component, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { UserApiService } from '../../core/services/user-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { User } from '../../shared/models/user.model';
import { apiErrorMessage } from '../../shared/util/api-error';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    EmptyStateComponent,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-page-header
      kicker="Gestão parcial"
      title="Usuários"
      description="Consulta dos usuários locais disponíveis. Cadastro, login e permissões avançadas não fazem parte deste MVP."
    >
      <button
        type="button"
        class="ghost-button future-action"
        disabled
        title="Cadastro de usuários fica disponível após o MVP"
      >
        <i class="pi pi-user-plus"></i>
        Novo usuário · em breve
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
  `,
})
export class UsersPageComponent implements OnInit {
  private readonly api = inject(UserApiService);

  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

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

  roleNames(user: User): string {
    return user.roles.length ? user.roles.join(', ') : 'Nenhum perfil';
  }
}
