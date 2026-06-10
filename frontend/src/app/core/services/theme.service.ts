import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'hubon-theme';

  readonly theme = signal<AppTheme>(this.getInitialTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  toggleTheme(): void {
    const nextTheme: AppTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(nextTheme);
    this.storeTheme(nextTheme);
    this.applyTheme(nextTheme);
  }

  private applyTheme(theme: AppTheme): void {
    this.document.documentElement.setAttribute('data-theme', theme);
  }

  private getInitialTheme(): AppTheme {
    if (typeof localStorage === 'undefined') return 'dark';

    try {
      const storedTheme = localStorage.getItem(this.storageKey);
      return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark';
    } catch {
      return 'dark';
    }
  }

  private storeTheme(theme: AppTheme): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(this.storageKey, theme);
    } catch {
      // Theme switching still works when browser storage is unavailable.
    }
  }
}
