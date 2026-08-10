import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AuthSession } from '../../shared/models/auth.model';
import { User } from '../../shared/models/user.model';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  const user: User = {
    id: 1,
    name: 'Gabriel',
    username: 'gabriel',
    active: true,
    roles: ['OWNER'],
  };
  const session: AuthSession = {
    token: 'token',
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user,
  };
  const currentUser = signal<User | null>(null);
  const authMock = {
    isAuthenticated: vi.fn(() => false),
    currentUser,
    login: vi.fn(() => of(session)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    currentUser.set(null);
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();
  });

  it('renders username field and sends a normalized login payload', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl');
    fixture.detectChanges();

    const usernameInput = fixture.nativeElement.querySelector('input[name="username"]') as HTMLInputElement;
    expect(usernameInput.type).toBe('text');
    expect(usernameInput.autocomplete).toBe('username');
    expect(fixture.nativeElement.textContent).toContain('Usuário');

    component.form = { username: '  Gabriel  ', password: 'secret' };
    component.login();

    expect(authMock.login).toHaveBeenCalledWith({ username: 'gabriel', password: 'secret' });
  });
});
