import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { KitchenColumnStatus, KitchenOrder, KitchenPriority } from '../../shared/models/order.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-kitchen-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header
      kicker="Produção"
      title="Cozinha"
      description="Kanban operacional para acompanhar preparo, prioridade e entrega dos pedidos."
    >
      <button type="button" class="ghost-button">
        <i class="pi pi-volume-up"></i>
        Modo chamada
      </button>
    </app-page-header>

    <section class="kitchen-kanban">
      @for (column of columns; track column.status) {
        <article class="kanban-column">
          <div class="kanban-header">
            <div>
              <span>{{ column.label }}</span>
              <strong>{{ ordersByStatus(column.status).length }}</strong>
            </div>
            <i [class]="column.icon"></i>
          </div>

          <div class="kanban-list">
            @for (order of ordersByStatus(column.status); track order.id) {
              <article class="kitchen-order-card" [ngClass]="order.priority">
                <div class="kitchen-order-top">
                  <strong>{{ order.id }}</strong>
                  <app-status-badge [label]="priorityLabel(order.priority)" [tone]="priorityTone(order.priority)" />
                </div>
                <div class="kitchen-order-meta">
                  <span><i class="pi pi-table"></i>{{ order.table }}</span>
                  <span><i class="pi pi-clock"></i>{{ order.elapsed }}</span>
                </div>
                <div class="kitchen-items">
                  @for (item of order.items; track item.name) {
                    <span>{{ item.quantity }}x {{ item.name }}</span>
                  }
                </div>
                <p>{{ order.notes }}</p>
              </article>
            }
          </div>
        </article>
      }
    </section>
  `,
})
export class KitchenPageComponent {
  @Input({ required: true }) orders: KitchenOrder[] = [];

  readonly columns: Array<{ status: KitchenColumnStatus; label: string; icon: string }> = [
    { status: 'received', label: 'Recebidos', icon: 'pi pi-inbox' },
    { status: 'preparing', label: 'Preparando', icon: 'pi pi-cog' },
    { status: 'ready', label: 'Prontos', icon: 'pi pi-check-circle' },
  ];

  ordersByStatus(status: KitchenColumnStatus): KitchenOrder[] {
    return this.orders.filter((order) => order.status === status);
  }

  priorityLabel(priority: KitchenPriority): string {
    return { normal: 'Normal', high: 'Alta', urgent: 'Urgente' }[priority];
  }

  priorityTone(priority: KitchenPriority): string {
    return { normal: 'neutral', high: 'warning', urgent: 'danger' }[priority];
  }
}
