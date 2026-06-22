import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthSession } from '../../shared/models/auth.model';
import { User } from '../../shared/models/user.model';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const user: User = {
    id: 1,
    name: 'Owner',
    email: 'owner@hubon.local',
    active: true,
    roles: ['OWNER'],
  };

  const session: AuthSession = {
    token: 'token',
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user,
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('should load authenticated user and update stored session', () => {
    service.login({ email: user.email, password: 'secret' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(session);

    const updatedUser = { ...user, name: 'Owner Atualizado' };
    service.me().subscribe((response) => {
      expect(response.name).toBe('Owner Atualizado');
    });

    const request = http.expectOne(`${environment.apiUrl}/auth/me`);
    expect(request.request.method).toBe('GET');
    request.flush(updatedUser);

    expect(service.currentUser()?.name).toBe('Owner Atualizado');
    const storedSession = JSON.parse(localStorage.getItem('hubon-auth-session') ?? '{}') as AuthSession;
    expect(storedSession.user.name).toBe('Owner Atualizado');
  });

  it('should send password change request to auth endpoint', () => {
    const payload = {
      currentPassword: 'Current123!',
      newPassword: 'NewPass123!',
      confirmPassword: 'NewPass123!',
    };

    service.changePassword(payload).subscribe((response) => {
      expect(response.message).toBe('Senha alterada com sucesso.');
    });

    const request = http.expectOne(`${environment.apiUrl}/auth/change-password`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(payload);
    request.flush({ message: 'Senha alterada com sucesso.' });
  });
});
