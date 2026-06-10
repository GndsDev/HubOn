import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { TabApiService } from '../../core/services/tab-api.service';
import { TableApiService } from '../../core/services/table-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import { Tab } from '../../shared/models/tab.model';
import { RestaurantTable, RestaurantTableRequest, RestaurantTableStatus } from '../../shared/models/table.model';
import { User } from '../../shared/models/user.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

type TableFilter = 'ALL' | RestaurantTableStatus;

@Component({
  selector: 'app-tables-page',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header kicker="Mapa do salão" title="Mesas" description="Acompanhe disponibilidade e abra comandas diretamente pelo salão.">
      <button type="button" class="primary-button" (click)="openCreate()"><i class="pi pi-plus"></i>Nova mesa</button>
    </app-page-header>

    <div class="table-filter-bar">
      <div class="segmented-control">
        @for (filter of filters; track filter.value) {
          <button type="button" [class.active]="activeFilter === filter.value" (click)="activeFilter = filter.value">
            {{ filter.label }} <span>{{ tableCount(filter.value) }}</span>
          </button>
        }
      </div>
    </div>

    @if (loading()) {
      <section class="table-board">@for (item of [1,2,3,4,5,6]; track item) { <div class="restaurant-table-card loading-card"></div> }</section>
    } @else if (error()) {
      <div class="error-panel" role="alert">
        <i class="pi pi-exclamation-triangle"></i><div><strong>Não foi possível carregar</strong><p>{{ error() }}</p></div>
        <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button>
      </div>
    } @else if (filteredTables.length === 0) {
      <app-empty-state icon="pi pi-table" title="Nenhuma mesa neste filtro" description="Escolha outro status ou cadastre uma nova mesa." />
    } @else {
      <section class="table-board">
        @for (table of filteredTables; track table.id) {
          <article class="restaurant-table-card" [ngClass]="statusClass(effectiveStatus(table))">
            <div class="table-card-top">
              <div><span>Mesa</span><strong>{{ table.number }}</strong></div>
              <app-status-badge [label]="statusLabel(effectiveStatus(table))" [tone]="statusTone(effectiveStatus(table))" />
            </div>
            <div class="table-card-body table-api-details">
              <div><small>Identificação</small><b>{{ table.name || 'Sem nome adicional' }}</b></div>
              <div><small>Cadastro</small><b>{{ table.active ? 'Ativo' : 'Inativo' }}</b></div>
            </div>
            <div class="table-card-actions">
              <button
                type="button"
                class="table-primary-action"
                [disabled]="!tableActionEnabled(table)"
                [attr.aria-label]="tableAction(table)"
                (click)="selectTable(table)"
              >
                <i [class]="tableActionIcon(table)"></i>
                {{ tableAction(table) }}
              </button>
              <button
                type="button"
                class="table-edit-action"
                title="Editar mesa"
                [attr.aria-label]="'Editar mesa ' + table.number"
                (click)="openEdit(table)"
              >
                <i class="pi pi-pencil"></i>
                <span>Editar</span>
              </button>
              <button
                type="button"
                class="table-status-action"
                [class.activate]="effectiveStatus(table) === 'DISABLED'"
                [disabled]="effectiveStatus(table) === 'OCCUPIED'"
                [title]="tableStatusActionTitle(table)"
                [attr.aria-label]="tableStatusAction(table) + ' mesa ' + table.number"
                (click)="toggleTableStatus(table)"
              >
                <i [class]="effectiveStatus(table) === 'DISABLED' ? 'pi pi-check' : 'pi pi-ban'"></i>
                <span>{{ tableStatusAction(table) }}</span>
              </button>
            </div>
          </article>
        }
      </section>
    }

    @if (formOpen()) {
      <div class="modal-backdrop" (click)="closeAll()">
        <form class="modal-panel" (click)="$event.stopPropagation()" (ngSubmit)="saveTable()">
          <div class="modal-header">
            <div><span>Salão</span><h2>{{ editing() ? 'Editar mesa' : 'Nova mesa' }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeAll()"><i class="pi pi-times"></i></button>
          </div>
          <div class="form-grid">
            <label class="field"><span>Número</span><input name="number" type="number" min="1" [(ngModel)]="tableForm.number" required /></label>
            <label class="field"><span>Nome</span><input name="name" [(ngModel)]="tableForm.name" maxlength="80" /></label>
            <label class="field">
              <span>Status</span>
              <select name="status" [(ngModel)]="tableForm.status">
                @for (status of tableStatuses; track status) { <option [value]="status">{{ statusLabel(status) }}</option> }
              </select>
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" class="ghost-button" (click)="closeAll()">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-check"></i>{{ saving() ? 'Salvando...' : 'Salvar mesa' }}</button>
          </div>
        </form>
      </div>
    }

    @if (openTabTable(); as table) {
      <div class="modal-backdrop" (click)="closeAll()">
        <form class="modal-panel compact" (click)="$event.stopPropagation()" (ngSubmit)="openTab()">
          <div class="modal-header">
            <div><span>Atendimento</span><h2>Abrir comanda · Mesa {{ table.number }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeAll()"><i class="pi pi-times"></i></button>
          </div>
          <div class="form-grid">
            <label class="field"><span>Taxa de serviço</span><input name="serviceFee" type="number" min="0" step="0.01" [(ngModel)]="tabForm.serviceFee" /></label>
            <label class="field"><span>Desconto</span><input name="discount" type="number" min="0" step="0.01" [(ngModel)]="tabForm.discountAmount" /></label>
          </div>
          <div class="modal-actions">
            <button type="button" class="ghost-button" (click)="closeAll()">Cancelar</button>
            <button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-receipt"></i>Abrir comanda</button>
          </div>
        </form>
      </div>
    }

    @if (currentTab(); as tab) {
      <div class="modal-backdrop" (click)="closeAll()">
        <section class="modal-panel compact" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div><span>Comanda atual</span><h2>#{{ tab.id }} · Mesa {{ tab.tableNumber }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeAll()"><i class="pi pi-times"></i></button>
          </div>
          <div class="detail-grid">
            <div><span>Total</span><strong>{{ currency(tab.finalAmount) }}</strong></div>
            <div><span>Pago</span><strong>{{ currency(tab.paidAmount) }}</strong></div>
            <div><span>Restante</span><strong>{{ currency(tab.remainingAmount) }}</strong></div>
            <div><span>Responsável</span><strong>{{ tab.openedByUserName }}</strong></div>
          </div>
          <div class="modal-actions"><button type="button" class="primary-button" (click)="closeAll()">Entendi</button></div>
        </section>
      </div>
    }
  `,
})
export class TablesPageComponent implements OnInit {
  private readonly api = inject(TableApiService);
  private readonly tabApi = inject(TabApiService);
  private readonly userApi = inject(UserApiService);
  private readonly feedback = inject(FeedbackService);

  readonly tables = signal<RestaurantTable[]>([]);
  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<RestaurantTable | null>(null);
  readonly openTabTable = signal<RestaurantTable | null>(null);
  readonly currentTab = signal<Tab | null>(null);
  readonly tableStatuses: RestaurantTableStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DISABLED'];
  readonly filters = [
    { label: 'Todas', value: 'ALL' as TableFilter },
    { label: 'Livres', value: 'AVAILABLE' as TableFilter },
    { label: 'Ocupadas', value: 'OCCUPIED' as TableFilter },
    { label: 'Reservadas', value: 'RESERVED' as TableFilter },
    { label: 'Desativadas', value: 'DISABLED' as TableFilter },
  ];
  activeFilter: TableFilter = 'ALL';
  tableForm: RestaurantTableRequest = this.emptyTableForm();
  tabForm = { serviceFee: 0, discountAmount: 0 };

  ngOnInit(): void { this.load(); }

  get filteredTables(): RestaurantTable[] {
    return this.activeFilter === 'ALL'
      ? this.tables()
      : this.tables().filter((table) => this.effectiveStatus(table) === this.activeFilter);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ tables: this.api.getAll(), users: this.userApi.getAll() }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ tables, users }) => { this.tables.set(tables); this.users.set(users.filter((user) => user.active)); },
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  openCreate(): void { this.editing.set(null); this.tableForm = this.emptyTableForm(); this.formOpen.set(true); }
  openEdit(table: RestaurantTable): void {
    this.editing.set(table);
    const status = this.effectiveStatus(table);
    this.tableForm = { number: table.number, name: table.name, status, active: status !== 'DISABLED' };
    this.formOpen.set(true);
  }

  saveTable(): void {
    if (this.tableForm.number < 1) { this.feedback.error('Informe um número de mesa válido.'); return; }
    this.saving.set(true);
    const current = this.editing();
    const payload: RestaurantTableRequest = {
      ...this.tableForm,
      active: this.tableForm.status !== 'DISABLED',
    };
    const operation = current ? this.api.update(current.id, payload) : this.api.create(payload);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.feedback.success(current ? 'Registro atualizado com sucesso.' : 'Registro salvo com sucesso.'); this.closeAll(); this.load(); },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }

  selectTable(table: RestaurantTable): void {
    const status = this.effectiveStatus(table);
    if (status === 'AVAILABLE') {
      this.tabForm = { serviceFee: 0, discountAmount: 0 };
      this.openTabTable.set(table);
      return;
    }
    if (status === 'OCCUPIED') {
      this.tabApi.getCurrentByTable(table.id).subscribe({
        next: (tab) => this.currentTab.set(tab),
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
      return;
    }
    this.feedback.info(status === 'RESERVED' ? 'Mesa reservada. Altere o status para abrir uma comanda.' : 'Mesa indisponível para atendimento.');
  }

  openTab(): void {
    const table = this.openTabTable();
    const user = this.users()[0];
    if (!table || !user) { this.feedback.error('Nenhum usuário ativo disponível.'); return; }
    this.saving.set(true);
    this.tabApi.open({ tableId: table.id, openedByUserId: user.id, ...this.tabForm })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => { this.feedback.success('Comanda aberta com sucesso.'); this.closeAll(); this.load(); },
        error: (error) => this.feedback.error(apiErrorMessage(error)),
      });
  }

  closeAll(): void { this.formOpen.set(false); this.openTabTable.set(null); this.currentTab.set(null); }
  effectiveStatus(table: RestaurantTable): RestaurantTableStatus {
    return table.active ? table.status : 'DISABLED';
  }
  tableCount(filter: TableFilter): number {
    return filter === 'ALL'
      ? this.tables().length
      : this.tables().filter((table) => this.effectiveStatus(table) === filter).length;
  }
  statusLabel(status: RestaurantTableStatus): string { return { AVAILABLE: 'Livre', OCCUPIED: 'Ocupada', RESERVED: 'Reservada', DISABLED: 'Desativada' }[status]; }
  statusTone(status: RestaurantTableStatus): string { return { AVAILABLE: 'success', OCCUPIED: 'info', RESERVED: 'warning', DISABLED: 'neutral' }[status]; }
  statusClass(status: RestaurantTableStatus): string { return status.toLocaleLowerCase(); }
  tableAction(table: RestaurantTable): string {
    return { AVAILABLE: 'Abrir comanda', OCCUPIED: 'Ver comanda', RESERVED: 'Ver reserva', DISABLED: 'Mesa indisponível' }[this.effectiveStatus(table)];
  }
  tableActionIcon(table: RestaurantTable): string {
    return { AVAILABLE: 'pi pi-receipt', OCCUPIED: 'pi pi-eye', RESERVED: 'pi pi-calendar', DISABLED: 'pi pi-lock' }[this.effectiveStatus(table)];
  }
  tableActionEnabled(table: RestaurantTable): boolean { return this.effectiveStatus(table) !== 'DISABLED'; }
  tableStatusAction(table: RestaurantTable): string {
    return this.effectiveStatus(table) === 'DISABLED' ? 'Ativar' : 'Desativar';
  }
  tableStatusActionTitle(table: RestaurantTable): string {
    return this.effectiveStatus(table) === 'OCCUPIED'
      ? 'Mesa ocupada não pode ser desativada'
      : `${this.tableStatusAction(table)} mesa`;
  }
  toggleTableStatus(table: RestaurantTable): void {
    const currentStatus = this.effectiveStatus(table);
    if (currentStatus === 'OCCUPIED') {
      this.feedback.info('Mesa ocupada não pode ser desativada.');
      return;
    }
    const nextStatus: RestaurantTableStatus = currentStatus === 'DISABLED' ? 'AVAILABLE' : 'DISABLED';
    this.api.updateStatus(table.id, nextStatus).subscribe({
      next: () => {
        this.feedback.success(nextStatus === 'DISABLED' ? 'Mesa desativada com sucesso.' : 'Mesa ativada com sucesso.');
        this.load();
      },
      error: (error) => this.feedback.error(apiErrorMessage(error)),
    });
  }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  private emptyTableForm(): RestaurantTableRequest { return { number: 1, name: '', status: 'AVAILABLE', active: true }; }
}
