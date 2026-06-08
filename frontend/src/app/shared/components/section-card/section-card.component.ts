import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-section-card',
  standalone: true,
  template: `
    <section class="premium-card section-card">
      <div class="section-card-header">
        <div>
          <span>{{ eyebrow }}</span>
          <h2>{{ title }}</h2>
        </div>
        <ng-content select="[card-action]" />
      </div>
      <ng-content />
    </section>
  `,
})
export class SectionCardComponent {
  @Input() eyebrow = '';
  @Input({ required: true }) title = '';
}
