import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../shared/models/user.model';
import { AccountPageComponent } from './account-page.component';

describe('AccountPageComponent', () => {
  const user: User = {
    id: 1,
    name: 'Owner HubOn',
    email: 'owner@hubon.local',
    active: true,
    roles: ['OWNER'],
  };

  const currentUser = signal<User | null>(user);
  const authMock = {
    currentUser,
    me: vi.fn(() => of(user)),
    changePassword: vi.fn(() => of({ message: 'Senha alterada com sucesso.' })),
    logout: vi.fn(),
  };

  beforeEach(async () => {
    authMock.me.mockClear();
    authMock.changePassword.mockClear();
    authMock.logout.mockClear();

    await TestBed.configureTestingModule({
      imports: [AccountPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();
  });

  it('should render authenticated user data', () => {
    const fixture = TestBed.createComponent(AccountPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Minha Conta');
    expect(text).toContain('Owner HubOn');
    expect(text).toContain('owner@hubon.local');
    expect(text).toContain('Dono');
    expect(authMock.me).toHaveBeenCalled();
  });

  it('should change password, logout and redirect to login', () => {
    const fixture = TestBed.createComponent(AccountPageComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.detectChanges();
    component.form = {
      currentPassword: 'Current123!',
      newPassword: 'NewPass123!',
      confirmPassword: 'NewPass123!',
    };

    component.changePassword();

    expect(authMock.changePassword).toHaveBeenCalledWith({
      currentPassword: 'Current123!',
      newPassword: 'NewPass123!',
      confirmPassword: 'NewPass123!',
    });
    expect(authMock.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      replaceUrl: true,
      queryParams: { message: 'Senha alterada. Entre novamente.' },
    });
  });
});
