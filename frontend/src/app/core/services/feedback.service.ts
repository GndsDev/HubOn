import { Injectable, signal } from '@angular/core';

export type FeedbackTone = 'success' | 'error' | 'info';

export interface FeedbackMessage {
  text: string;
  tone: FeedbackTone;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  readonly message = signal<FeedbackMessage | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  success(text = 'Ação realizada com sucesso.'): void {
    this.show(text, 'success');
  }

  error(text: string): void {
    this.show(text, 'error');
  }

  info(text = 'Funcionalidade em desenvolvimento.'): void {
    this.show(text, 'info');
  }

  clear(): void {
    this.message.set(null);
  }

  private show(text: string, tone: FeedbackTone): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.message.set({ text, tone });
    this.timer = setTimeout(() => this.message.set(null), 4200);
  }
}
