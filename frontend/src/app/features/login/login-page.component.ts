import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { firstAccessiblePath } from '../../core/auth/access-control';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../shared/util/api-error';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="auth-shell">
      <section class="auth-panel" aria-labelledby="login-title">
        <div class="auth-brand">
          <img
            class="auth-brand-logo"
            src="assets/brand/logo-hubon.png"
            width="512"
            height="512"
            alt=""
            aria-hidden="true"
          />
          <div>
            <strong>HubOn</strong>
            <span>Operação local segura</span>
          </div>
        </div>

        <div class="auth-copy">
          <span>Autenticação</span>
          <h1 id="login-title">Entrar no painel</h1>
          <p>Use um perfil autorizado para acessar os módulos do restaurante.</p>
        </div>

        <form class="auth-form" (ngSubmit)="login()">
          <label class="field">
            <span>E-mail</span>
            <input
              name="email"
              type="email"
              autocomplete="username"
              [(ngModel)]="form.email"
              required
              autofocus
            />
          </label>

          <label class="field">
            <span>Senha</span>
            <input
              name="password"
              type="password"
              autocomplete="current-password"
              [(ngModel)]="form.password"
              required
            />
          </label>

          @if (error()) {
            <p class="auth-error" role="alert">{{ error() }}</p>
          }

          <button type="submit" class="primary-button auth-submit" [disabled]="loading()">
            <i class="pi pi-lock"></i>
            {{ loading() ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>
      </section>
    </main>
  `,
})
export class LoginPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  form = { email: 'owner@hubon.local', password: 'owner123' };

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigateByUrl(this.firstAllowedRoute(), { replaceUrl: true });
    }
  }

  login(): void {
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.form)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.router.navigateByUrl(this.returnUrl(), { replaceUrl: true }),
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  private returnUrl(): string {
    return this.route.snapshot.queryParamMap.get('returnUrl') || this.firstAllowedRoute();
  }

  private firstAllowedRoute(): string {
    return firstAccessiblePath(this.auth.currentUser()?.roles ?? []);
  }
}
