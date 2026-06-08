import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { SectionCardComponent } from '../section-card/section-card.component';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

export interface CollectionItem {
  title: string;
  subtitle: string;
  meta: string;
  value: string;
  status: string;
  tone: string;
  icon: string;
}

@Component({
  selector: 'app-collection-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, SectionCardComponent, StatusBadgeComponent],
  template: `
    <app-page-header [kicker]="kicker" [title]="title" [description]="description">
      <button type="button" class="ghost-button">
        <i [class]="actionIcon"></i>
        {{ actionLabel }}
      </button>
    </app-page-header>

    <app-section-card [eyebrow]="sectionEyebrow" [title]="sectionTitle">
      <div class="collection-grid">
        @for (item of items; track item.title) {
          <article class="collection-card">
            <div class="collection-icon">
              <i [class]="item.icon"></i>
            </div>
            <div class="collection-main">
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle }}</span>
              <small>{{ item.meta }}</small>
            </div>
            <div class="collection-side">
              <app-status-badge [label]="item.status" [tone]="item.tone" />
              <b>{{ item.value }}</b>
            </div>
          </article>
        }
      </div>
    </app-section-card>
  `,
})
export class CollectionPageComponent {
  @Input() kicker = 'Módulo';
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() actionLabel = 'Novo registro';
  @Input() actionIcon = 'pi pi-plus';
  @Input() sectionEyebrow = 'Visão operacional';
  @Input() sectionTitle = 'Registros';
  @Input() items: CollectionItem[] = [];
}
