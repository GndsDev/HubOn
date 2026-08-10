import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { UserApiService } from '../../core/services/user-api.service';
import { User } from '../../shared/models/user.model';
import { UsersPageComponent } from './users-page.component';

describe('UsersPageComponent', () => {
  const owner: User = {
    id: 1,
    name: 'Gabriel',
    username: 'gabriel',
    active: true,
    roles: ['OWNER'],
  };
  const manager: User = {
    id: 2,
    name: 'Maria',
    username: 'maria',
    active: true,
    roles: ['ADMIN'],
  };
  const apiMock = {
    getAll: vi.fn(() => of([owner])),
    create: vi.fn(() => of(manager)),
  };
  const feedbackMock = {
    success: vi.fn(),
    error: vi.fn(),
  };
  const authMock = {
    currentUser: signal<User | null>(owner),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [UsersPageComponent],
      providers: [
        { provide: UserApiService, useValue: apiMock },
        { provide: FeedbackService, useValue: feedbackMock },
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();
  });

  it('renders the username in the user card', () => {
    const fixture = TestBed.createComponent(UsersPageComponent);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('gabriel');
  });

  it('normalizes username before creating a manager', () => {
    const fixture = TestBed.createComponent(UsersPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.openCreate();
    component.form = {
      name: ' Maria ',
      username: ' Maria.Gerente ',
      password: 'secret1',
      active: true,
      role: 'ADMIN',
    };

    component.create();

    expect(apiMock.create).toHaveBeenCalledWith({
      name: 'Maria',
      username: 'maria.gerente',
      password: 'secret1',
      active: true,
      roles: ['ADMIN'],
    });
  });
});
