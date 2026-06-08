import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="page-header">
      <div>
        <span class="page-kicker">{{ kicker }}</span>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
      </div>
      <ng-content />
    </header>
  `,
})
export class PageHeaderComponent {
  @Input() kicker = 'Operação';
  @Input({ required: true }) title = '';
  @Input() description = '';
}
