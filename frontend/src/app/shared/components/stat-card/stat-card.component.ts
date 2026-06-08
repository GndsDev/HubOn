import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { StatMetric } from '../../models/dashboard.model';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="premium-card stat-card" [ngClass]="'tone-' + metric.tone">
      <div class="stat-icon">
        <i [class]="metric.icon"></i>
      </div>
      <div class="stat-copy">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <p>{{ metric.detail }}</p>
      </div>
      <small>{{ metric.trend }}</small>
    </article>
  `,
})
export class StatCardComponent {
  @Input({ required: true }) metric!: StatMetric;
}
