import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RestaurantTableStatus, RestaurantTableView } from '../../shared/models/table.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-tables-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header
      kicker="Mapa do salão"
      title="Mesas"
      description="Acompanhe ocupação, valor parcial e tempo aberto de cada mesa."
    >
      <div class="segmented-control">
        <button type="button" class="active">Todas</button>
        <button type="button">Livres</button>
        <button type="button">Ocupadas</button>
      </div>
    </app-page-header>

    <section class="table-board">
      @for (table of tables; track table.id) {
        <article class="restaurant-table-card" [ngClass]="table.status">
          <div class="table-card-top">
            <div>
              <span>Mesa</span>
              <strong>{{ table.number }}</strong>
            </div>
            <app-status-badge [label]="statusLabel(table.status)" [tone]="statusTone(table.status)" />
          </div>
          <div class="table-card-body">
            <div>
              <small>Lugares</small>
              <b>{{ table.seats }}</b>
            </div>
            <div>
              <small>Parcial</small>
              <b>{{ table.amount }}</b>
            </div>
            <div>
              <small>Aberta</small>
              <b>{{ table.openedFor }}</b>
            </div>
          </div>
          <div class="table-card-footer">
            <span>{{ table.waiter }}</span>
            <i class="pi pi-arrow-right"></i>
          </div>
        </article>
      }
    </section>
  `,
})
export class TablesPageComponent {
  @Input({ required: true }) tables: RestaurantTableView[] = [];

  statusLabel(status: RestaurantTableStatus): string {
    return {
      free: 'Livre',
      occupied: 'Ocupada',
      reserved: 'Reservada',
      disabled: 'Desativada',
    }[status];
  }

  statusTone(status: RestaurantTableStatus): string {
    return {
      free: 'success',
      occupied: 'info',
      reserved: 'warning',
      disabled: 'neutral',
    }[status];
  }
}
