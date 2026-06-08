import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { DashboardSnapshot } from '../../shared/models/dashboard.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, SectionCardComponent, StatCardComponent, StatusBadgeComponent],
  template: `
    <app-page-header
      kicker="Dashboard executivo"
      title="Operação em tempo real"
      description="Visão consolidada de vendas, salão, cozinha e caixa para tomada de decisão rápida."
    >
      <button type="button" class="primary-button">
        <i class="pi pi-bolt"></i>
        Iniciar turno
      </button>
    </app-page-header>

    <section class="stats-grid">
      @for (metric of snapshot.stats; track metric.label) {
        <app-stat-card [metric]="metric" />
      }
    </section>

    <section class="dashboard-grid">
      <app-section-card eyebrow="Agora" title="Pedidos recentes">
        <div class="activity-list">
          @for (order of snapshot.recentOrders; track order.id) {
            <article class="activity-row">
              <div>
                <strong>{{ order.id }} · {{ order.table }}</strong>
                <span>{{ order.time }}</span>
              </div>
              <app-status-badge [label]="order.status" [tone]="order.tone" />
              <b>{{ order.amount }}</b>
            </article>
          }
        </div>
      </app-section-card>

      <app-section-card eyebrow="Cardápio" title="Produtos mais vendidos">
        <div class="seller-list">
          @for (product of snapshot.bestSellers; track product.name; let index = $index) {
            <article class="seller-row">
              <span>{{ index + 1 }}</span>
              <div>
                <strong>{{ product.name }}</strong>
                <small>{{ product.category }}</small>
              </div>
              <b>{{ product.quantity }} un.</b>
              <em>{{ product.revenue }}</em>
            </article>
          }
        </div>
      </app-section-card>

      <app-section-card eyebrow="Salão" title="Status das mesas">
        <div class="table-status-list">
          @for (status of snapshot.tableStatus; track status.label) {
            <div class="progress-row">
              <div>
                <span>{{ status.label }}</span>
                <strong>{{ status.value }}/{{ status.total }}</strong>
              </div>
              <div class="progress-track">
                <span [class]="status.tone" [style.width.%]="(status.value / status.total) * 100"></span>
              </div>
            </div>
          }
        </div>
      </app-section-card>

      <app-section-card eyebrow="Financeiro" title="Resumo do caixa">
        <div class="cash-summary-list">
          @for (item of snapshot.cashier; track item.label) {
            <article>
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.detail }}</small>
            </article>
          }
        </div>
      </app-section-card>
    </section>
  `,
})
export class DashboardPageComponent {
  @Input({ required: true }) snapshot!: DashboardSnapshot;
}
