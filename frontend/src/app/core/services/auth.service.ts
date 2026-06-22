import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthSession,
  ChangePasswordRequest,
  LoginRequest,
  PasswordChangeResponse,
} from '../../shared/models/auth.model';
import { User } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'hubon-auth-session';

  readonly session = signal<AuthSession | null>(this.readStoredSession());
  readonly currentUser = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => {
    const session = this.session();
    return Boolean(session && new Date(session.expiresAt).getTime() > Date.now());
  });

  login(request: LoginRequest): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${environment.apiUrl}/auth/login`, request).pipe(
      tap((session) => this.setSession(session)),
    );
  }

  me(): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/auth/me`).pipe(
      tap((user) => this.updateCurrentUser(user)),
    );
  }

  changePassword(request: ChangePasswordRequest): Observable<PasswordChangeResponse> {
    return this.http.patch<PasswordChangeResponse>(
      `${environment.apiUrl}/auth/change-password`,
      request,
    );
  }

  logout(): void {
    this.session.set(null);
    this.removeStoredSession();
  }

  token(): string | null {
    return this.validSession()?.token ?? null;
  }

  hasAnyRole(roles: string[]): boolean {
    if (roles.length === 0) return true;
    const userRoles = this.currentUser()?.roles ?? [];
    return roles.some((role) => userRoles.includes(role));
  }

  private setSession(session: AuthSession): void {
    this.session.set(session);
    this.storeSession(session);
  }

  private updateCurrentUser(user: User): void {
    const session = this.validSession();
    if (!session) return;

    this.setSession({ ...session, user });
  }

  private validSession(): AuthSession | null {
    const session = this.session();
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.logout();
      return null;
    }

    return session;
  }

  private readStoredSession(): AuthSession | null {
    if (typeof localStorage === 'undefined') return null;

    try {
      const value = localStorage.getItem(this.storageKey);
      if (!value) return null;
      const session = JSON.parse(value) as AuthSession;
      if (!session.token || !session.expiresAt || !session.user) return null;
      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        this.removeStoredSession();
        return null;
      }
      return session;
    } catch {
      this.removeStoredSession();
      return null;
    }
  }

  private storeSession(session: AuthSession): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(session));
    } catch {
      // The current session remains valid for this browser tab.
    }
  }

  private removeStoredSession(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Nothing else is required when browser storage is unavailable.
    }
  }
}
