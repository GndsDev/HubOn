import { inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { User } from '../../shared/models/user.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { UserApiService } from './user-api.service';

@Injectable({ providedIn: 'root' })
export class OperatorContextService {
  private readonly userApi = inject(UserApiService);
  private readonly storageKey = 'hubon-operator-id';
  private loaded = false;

  readonly operators = signal<User[]>([]);
  readonly selectedOperator = signal<User | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(): void {
    if (this.loaded || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);
    this.userApi.getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (users) => {
          const activeOperators = users.filter((user) => user.active);
          const storedOperatorId = this.readStoredOperatorId();
          this.operators.set(activeOperators);
          this.selectedOperator.set(
            activeOperators.find((user) => user.id === storedOperatorId) ?? null,
          );
          if (!this.selectedOperator()) this.removeStoredOperator();
          this.loaded = true;
        },
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  selectOperator(operatorId: number | null): void {
    const operator = operatorId === null
      ? null
      : this.operators().find((user) => user.id === operatorId) ?? null;

    this.selectedOperator.set(operator);
    if (operator) {
      this.storeOperatorId(operator.id);
      return;
    }
    this.removeStoredOperator();
  }

  private readStoredOperatorId(): number | null {
    if (typeof localStorage === 'undefined') return null;

    try {
      const value = localStorage.getItem(this.storageKey);
      if (!value) return null;
      const operatorId = Number(value);
      return Number.isInteger(operatorId) ? operatorId : null;
    } catch {
      return null;
    }
  }

  private storeOperatorId(operatorId: number): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(this.storageKey, String(operatorId));
    } catch {
      // The current selection remains valid for this session.
    }
  }

  private removeStoredOperator(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Nothing else is required when browser storage is unavailable.
    }
  }
}
