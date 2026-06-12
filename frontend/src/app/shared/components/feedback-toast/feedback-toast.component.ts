import { Component, inject } from '@angular/core';
import { FeedbackService } from '../../../core/services/feedback.service';

@Component({
  selector: 'app-feedback-toast',
  standalone: true,
  template: `
    @if (feedback.message(); as message) {
      <div
        class="feedback-toast"
        [class]="message.tone"
        [attr.role]="message.tone === 'error' ? 'alert' : 'status'"
        [attr.aria-live]="message.tone === 'error' ? 'assertive' : 'polite'"
      >
        <i [class]="icon(message.tone)"></i>
        <span>{{ message.text }}</span>
        <button type="button" aria-label="Fechar mensagem" (click)="feedback.clear()">
          <i class="pi pi-times"></i>
        </button>
      </div>
    }
  `,
})
export class FeedbackToastComponent {
  readonly feedback = inject(FeedbackService);

  icon(tone: string): string {
    return {
      success: 'pi pi-check-circle',
      error: 'pi pi-exclamation-triangle',
      info: 'pi pi-info-circle',
    }[tone] ?? 'pi pi-info-circle';
  }
}
