import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { TableApiService } from '../../core/services/table-api.service';
import { Tab } from '../../shared/models/tab.model';
import { RestaurantTable } from '../../shared/models/table.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';

@Component({
  selector: 'app-tabs-page',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, PageHeaderComponent, SectionCardComponent, StatusBadgeComponent, AccessibleDialogDirective],
  template: `
    <app-page-header kicker="Atendimento" title="Comandas" description="Acompanhe comandas abertas, pagamentos e responsáveis do salão.">
      <button type="button" class="primary-button" (click)="openForm()"><i class="pi pi-plus"></i>Abrir comanda</button>
    </app-page-header>

    <app-section-card eyebrow="Salão" title="Comandas abertas">
      @if (loading()) {
        <div class="collection-grid">@for (item of [1,2,3,4]; track item) { <div class="collection-card loading-card"></div> }</div>
      } @else if (error()) {
        <div class="error-panel"><i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar</strong><p>{{ error() }}</p></div>
          <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button>
        </div>
      } @else if (tabs().length === 0) {
        <app-empty-state icon="pi pi-receipt" title="Nenhuma comanda aberta" description="Abra uma comanda para uma mesa disponível." />
      } @else {
        <div class="collection-grid">
          @for (tab of tabs(); track tab.id) {
            <button type="button" class="collection-card clickable collection-card-button" (click)="showDetails(tab)">
              <div class="collection-icon"><i class="pi pi-receipt"></i></div>
              <div class="collection-main">
                <strong>Comanda #{{ tab.id }} · Mesa {{ tab.tableNumber }}</strong>
                <span>{{ tab.openedByUserName }}</span>
                <small>Aberta {{ relativeTime(tab.openedAt) }}</small>
              </div>
              <div class="collection-side">
                <app-status-badge [label]="tab.remainingAmount > 0 ? 'Em aberto' : 'Paga'" [tone]="tab.remainingAmount > 0 ? 'warning' : 'success'" />
                <b>{{ currency(tab.finalAmount) }}</b>
              </div>
            </button>
          }
        </div>
      }
    </app-section-card>

    @if (formOpen()) {
      <div class="modal-backdrop" (click)="formOpen.set(false)">
        <form
          class="modal-panel compact"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="tab-form-dialog-title"
          [dialogCloseDisabled]="saving()"
          (dialogClose)="formOpen.set(false)"
          (click)="$event.stopPropagation()"
          (ngSubmit)="create()"
        >
          <div class="modal-header">
            <div><span>Atendimento</span><h2 id="tab-form-dialog-title">Abrir comanda</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="formOpen.set(false)"><i class="pi pi-times"></i></button>
          </div>
          <div class="form-grid">
            <label class="field full">
              <span>Mesa disponível</span>
              <select name="tableId" [(ngModel)]="form.tableId" required autofocus>
                <option [ngValue]="0" disabled>Selecione</option>
                @for (table of availableTables; track table.id) { <option [ngValue]="table.id">Mesa {{ table.number }} · {{ table.name }}</option> }
              </select>
            </label>
            <label class="field"><span>Taxa de serviço</span><input name="serviceFee" type="number" min="0" step="0.01" [(ngModel)]="form.serviceFee" /></label>
            <label class="field"><span>Desconto</span><input name="discount" type="number" min="0" step="0.01" [(ngModel)]="form.discountAmount" /></label>
          </div>
          <div class="modal-actions">
            <button type="button" class="ghost-button" (click)="formOpen.set(false)">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-receipt"></i>{{ saving() ? 'Abrindo...' : 'Abrir comanda' }}</button>
          </div>
        </form>
      </div>
    }

    @if (selected(); as tab) {
      <div class="modal-backdrop" (click)="selected.set(null)">
        <section
          class="modal-panel"
          appAccessibleDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="tab-details-dialog-title"
          (dialogClose)="selected.set(null)"
          (click)="$event.stopPropagation()"
        >
          <div class="modal-header">
            <div><span>Detalhes</span><h2 id="tab-details-dialog-title">Comanda #{{ tab.id }} · Mesa {{ tab.tableNumber }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="selected.set(null)"><i class="pi pi-times"></i></button>
          </div>
          <div class="detail-grid">
            <div><span>Itens</span><strong>{{ currency(tab.totalAmount) }}</strong></div>
            <div><span>Serviço</span><strong>{{ currency(tab.serviceFee) }}</strong></div>
            <div><span>Desconto</span><strong>{{ currency(tab.discountAmount) }}</strong></div>
            <div><span>Total final</span><strong>{{ currency(tab.finalAmount) }}</strong></div>
            <div><span>Pago</span><strong>{{ currency(tab.paidAmount) }}</strong></div>
            <div><span>Restante</span><strong>{{ currency(tab.remainingAmount) }}</strong></div>
          </div>
          <div class="modal-actions split-actions">
            <button type="button" class="danger-button" (click)="cancel(tab)"><i class="pi pi-times-circle"></i>Cancelar comanda</button>
            <button type="button" class="primary-button" [disabled]="tab.remainingAmount > 0" (click)="close(tab)"><i class="pi pi-check-circle"></i>Fechar comanda</button>
          </div>
        </section>
      </div>
    }
  `,
})
export class TabsPageComponent implements OnInit {
  private readonly api = inject(TabApiService);
  private readonly tableApi = inject(TableApiService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  readonly tabs = signal<Tab[]>([]);
  readonly tables = signal<RestaurantTable[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly selected = signal<Tab | null>(null);
  form = { tableId: 0, serviceFee: 0, discountAmount: 0 };

  ngOnInit(): void { this.load(); }
  get availableTables(): RestaurantTable[] { return this.tables().filter((table) => table.active && table.status === 'AVAILABLE'); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ tabs: this.api.getOpen(), tables: this.tableApi.getAll() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ tabs, tables }) => { this.tabs.set(tabs); this.tables.set(tables); },
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  openForm(): void {
    if (!this.auth.currentUser()) {
      this.feedback.error('Faça login antes de abrir a comanda.');
      return;
    }
    if (this.availableTables.length === 0) { this.feedback.info('Nenhuma mesa livre disponível para abrir comanda.'); return; }
    this.form = { tableId: this.availableTables[0].id, serviceFee: 0, discountAmount: 0 };
    this.formOpen.set(true);
  }

  create(): void {
    if (!this.auth.currentUser()) {
      this.feedback.error('Faça login antes de abrir a comanda.');
      return;
    }
    if (!this.form.tableId) { this.feedback.error('Selecione uma mesa disponível.'); return; }
    this.saving.set(true);
    this.api.open(this.form).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.feedback.success('Comanda aberta com sucesso.'); this.formOpen.set(false); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  showDetails(tab: Tab): void {
    this.api.getById(tab.id).subscribe({ next: (detail) => this.selected.set(detail), error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }

  close(tab: Tab): void {
    this.api.close(tab.id).subscribe({
      next: () => { this.feedback.success('Comanda fechada com sucesso.'); this.selected.set(null); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  cancel(tab: Tab): void {
    this.api.cancel(tab.id).subscribe({
      next: () => { this.feedback.success('Comanda cancelada com sucesso.'); this.selected.set(null); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  relativeTime(value: string): string {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    return minutes < 60 ? `há ${minutes} min` : `há ${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }
}
