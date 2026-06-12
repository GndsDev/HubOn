import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { User } from '../../shared/models/user.model';
import { OperatorContextService } from './operator-context.service';
import { UserApiService } from './user-api.service';

const operators: User[] = [
  { id: 1, name: 'Ana Caixa', email: 'ana@hubon.test', active: true, roles: ['CASHIER'] },
  { id: 2, name: 'Bruno Salão', email: 'bruno@hubon.test', active: true, roles: ['WAITER'] },
];

describe('OperatorContextService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        OperatorContextService,
        {
          provide: UserApiService,
          useValue: { getAll: () => of(operators) },
        },
      ],
    });
  });

  it('should not select the first operator automatically', () => {
    const service = TestBed.inject(OperatorContextService);

    service.load();

    expect(service.selectedOperator()).toBeNull();
  });

  it('should restore a valid stored operator', () => {
    localStorage.setItem('hubon-operator-id', '2');
    const service = TestBed.inject(OperatorContextService);

    service.load();

    expect(service.selectedOperator()?.id).toBe(2);
  });

  it('should persist an explicitly selected operator', () => {
    const service = TestBed.inject(OperatorContextService);
    service.load();

    service.selectOperator(1);

    expect(service.selectedOperator()?.id).toBe(1);
    expect(localStorage.getItem('hubon-operator-id')).toBe('1');
  });
});
