import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { SectionCardComponent } from '../section-card/section-card.component';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

export interface CollectionItem {
  title: string;
  subtitle: string;
  meta: string;
  value?: string;
  status: string;
  tone: string;
  icon: string;
}

@Component({
  selector: 'app-collection-page',
  standalone: true,
  imports: [
    CommonModule,
    EmptyStateComponent,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-page-header [kicker]="kicker" [title]="title" [description]="description">
      <button
        type="button"
        class="ghost-button"
        [class.future-action]="actionDisabled"
        [disabled]="actionDisabled"
        [attr.title]="actionTitle || null"
        (click)="action.emit()"
      >
        <i [class]="actionIcon"></i>
        {{ actionLabel }}
      </button>
    </app-page-header>

    <app-section-card [eyebrow]="sectionEyebrow" [title]="sectionTitle">
      @if (loading) {
        <div class="collection-grid" aria-label="Carregando registros">
          @for (item of loadingItems; track item) {
            <div class="collection-card loading-card"></div>
          }
        </div>
      } @else if (errorMessage) {
        <div class="error-panel" role="alert">
          <i class="pi pi-exclamation-triangle"></i>
          <div>
            <strong>API local indisponível</strong>
            <p>{{ errorMessage }}</p>
          </div>
          <button type="button" class="ghost-button" (click)="retry.emit()">
            <i class="pi pi-refresh"></i>
            Tentar novamente
          </button>
        </div>
      } @else if (items.length === 0) {
        <app-empty-state
          icon="pi pi-inbox"
          title="Nenhum registro encontrado"
          description="Os dados cadastrados aparecerão aqui."
        />
      } @else {
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
                @if (item.value) {
                  <b>{{ item.value }}</b>
                }
              </div>
            </article>
          }
        </div>
      }
    </app-section-card>
  `,
})
export class CollectionPageComponent {
  @Input() kicker = 'Módulo';
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() actionLabel = 'Novo registro';
  @Input() actionIcon = 'pi pi-plus';
  @Input() actionDisabled = false;
  @Input() actionTitle = '';
  @Input() sectionEyebrow = 'Visão operacional';
  @Input() sectionTitle = 'Registros';
  @Input() items: CollectionItem[] = [];
  @Input() loading = false;
  @Input() errorMessage: string | null = null;
  @Output() readonly retry = new EventEmitter<void>();
  @Output() readonly action = new EventEmitter<void>();

  readonly loadingItems = [1, 2, 3, 4];
}
