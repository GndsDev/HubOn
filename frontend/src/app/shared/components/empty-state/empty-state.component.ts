import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty-panel">
      <i [class]="icon"></i>
      <strong>{{ title }}</strong>
      <p>{{ description }}</p>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() icon = 'pi pi-inbox';
  @Input({ required: true }) title = '';
  @Input() description = '';
}
