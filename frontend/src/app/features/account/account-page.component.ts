import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { apiErrorMessage } from '../../shared/util/api-error';

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [
    FormsModule,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-page-header
      kicker="Conta"
      title="Minha Conta"
      description="Revise seus dados de acesso e mantenha sua senha atualizada."
    />

    <div class="account-layout">
      <app-section-card eyebrow="Perfil autenticado" title="Dados da conta">
        @if (user(); as currentUser) {
          <div class="account-profile">
            <div class="account-avatar" aria-hidden="true">{{ initials() }}</div>

            <div class="account-identity">
              <span>Nome</span>
              <strong>{{ currentUser.name }}</strong>
            </div>

            <div class="account-identity">
              <span>E-mail</span>
              <strong>{{ currentUser.email }}</strong>
            </div>

            <div class="account-role-list" aria-label="Perfis do usuário">
              @for (role of currentUser.roles; track role) {
                <span>{{ roleLabel(role) }}</span>
              }
            </div>

            <app-status-badge
              [label]="currentUser.active ? 'Ativo' : 'Inativo'"
              [tone]="currentUser.active ? 'success' : 'neutral'"
            />
          </div>
        } @else {
          <div class="loading-card">Carregando dados da conta...</div>
        }
      </app-section-card>

      <app-section-card eyebrow="Segurança" title="Alterar senha">
        <form class="account-password-form" (ngSubmit)="changePassword()">
          <label class="field">
            <span>Senha atual</span>
            <input
              name="currentPassword"
              type="password"
              autocomplete="current-password"
              [(ngModel)]="form.currentPassword"
              required
            />
          </label>

          <label class="field">
            <span>Nova senha</span>
            <input
              name="newPassword"
              type="password"
              autocomplete="new-password"
              [(ngModel)]="form.newPassword"
              required
            />
          </label>

          <label class="field">
            <span>Confirmar nova senha</span>
            <input
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              [(ngModel)]="form.confirmPassword"
              required
            />
          </label>

          <p class="password-requirements">
            Use pelo menos 8 caracteres com letra, número e caractere especial.
          </p>

          @if (error()) {
            <p class="auth-error" role="alert">{{ error() }}</p>
          }

          @if (success()) {
            <p class="auth-success" role="status">{{ success() }}</p>
          }

          <button type="submit" class="primary-button account-submit" [disabled]="saving()">
            <i class="pi pi-key"></i>
            {{ saving() ? 'Alterando...' : 'Alterar senha' }}
          </button>
        </form>
      </app-section-card>
    </div>
  `,
})
export class AccountPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly initials = computed(() => {
    const name = this.user()?.name.trim();
    if (!name) return '--';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  });

  form = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  ngOnInit(): void {
    this.auth.me().subscribe({
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  changePassword(): void {
    this.error.set(null);
    this.success.set(null);

    if (!this.form.currentPassword || !this.form.newPassword || !this.form.confirmPassword) {
      this.error.set('Preencha todos os campos de senha.');
      return;
    }

    if (this.form.newPassword !== this.form.confirmPassword) {
      this.error.set('A confirmação da senha não confere.');
      return;
    }

    this.saving.set(true);
    this.auth.changePassword(this.form)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.form = { currentPassword: '', newPassword: '', confirmPassword: '' };
          this.success.set('Senha alterada. Entre novamente.');
          this.auth.logout();
          this.router.navigate(['/login'], {
            replaceUrl: true,
            queryParams: { message: 'Senha alterada. Entre novamente.' },
          });
        },
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  roleLabel(role: string): string {
    const labels: Record<string, string> = {
      OWNER: 'Dono',
      ADMIN: 'Admin',
      WAITER: 'Garçom',
      KITCHEN: 'Cozinha',
      CASHIER: 'Caixa',
    };

    return labels[role] ?? role;
  }
}
