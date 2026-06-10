import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { DashboardApiService } from '../../core/services/dashboard-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import {
  CollectionItem,
  CollectionPageComponent,
} from '../../shared/components/collection-page/collection-page.component';
import { DashboardSummary } from '../../shared/models/dashboard.model';
import { apiErrorMessage } from '../../shared/util/api-error';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CollectionPageComponent],
  template: `
    <app-collection-page
      kicker="Gestão"
      title="Relatórios"
      description="Resumo básico da operação atual. Filtros por período e exportação ficam fora deste MVP."
      actionLabel="Exportar relatório"
      actionIcon="pi pi-download"
      sectionEyebrow="Dados reais"
      sectionTitle="Resumo operacional"
      [items]="items()"
      [loading]="loading()"
      [errorMessage]="error()"
      (retry)="load()"
      (action)="exportNotice()"
    />
  `,
})
export class ReportsPageComponent implements OnInit {
  private readonly api = inject(DashboardApiService);
  private readonly feedback = inject(FeedbackService);

  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = computed<CollectionItem[]>(() => {
    const data = this.summary();
    if (!data) return [];

    return [
      {
        title: 'Vendas de hoje',
        subtitle: 'Comandas fechadas no dia',
        meta: `${data.openTabs} comandas ainda abertas`,
        value: this.currency(data.todaySales),
        status: 'Atual',
        tone: 'success',
        icon: 'pi pi-wallet',
      },
      {
        title: 'Ticket médio',
        subtitle: 'Média das comandas fechadas',
        meta: 'Cálculo simples do dia',
        value: this.currency(data.averageTicket),
        status: 'Atual',
        tone: 'info',
        icon: 'pi pi-chart-line',
      },
      {
        title: 'Produção em andamento',
        subtitle: 'Pedidos recebidos ou em preparo',
        meta: `${data.tableSummary.occupied} mesas ocupadas`,
        value: `${data.ordersInPreparation}`,
        status: 'Operacional',
        tone: 'warning',
        icon: 'pi pi-send',
      },
      {
        title: 'Recebido hoje',
        subtitle: 'Pagamentos registrados no dia',
        meta: `${this.currency(data.cashSummary.openAmount)} ainda em aberto`,
        value: this.currency(data.cashSummary.received),
        status: 'Caixa',
        tone: 'success',
        icon: 'pi pi-credit-card',
      },
    ];
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getSummary()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (summary) => this.summary.set(summary),
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  exportNotice(): void {
    this.feedback.info('Funcionalidade em desenvolvimento.');
  }

  private currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }
}
