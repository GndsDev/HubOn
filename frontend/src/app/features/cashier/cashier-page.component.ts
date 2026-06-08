import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CashierView } from '../../shared/models/cashier.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';

@Component({
  selector: 'app-cashier-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, SectionCardComponent],
  template: `
    <app-page-header
      kicker="Financeiro"
      title="Caixa"
      description="Finalize comandas com clareza de total, pago, restante e formas de pagamento."
    >
      <button type="button" class="ghost-button">
        <i class="pi pi-print"></i>
        Imprimir parcial
      </button>
    </app-page-header>

    <section class="cashier-layout">
      <app-section-card eyebrow="Comanda selecionada" title="{{ cashier.tab }} · {{ cashier.table }}">
        <div class="cashier-summary">
          <div>
            <span>Garçom</span>
            <strong>{{ cashier.waiter }}</strong>
          </div>
          <div>
            <span>Itens</span>
            <strong>{{ cashier.itemsTotal }}</strong>
          </div>
          <div>
            <span>Serviço</span>
            <strong>{{ cashier.serviceFee }}</strong>
          </div>
          <div>
            <span>Desconto</span>
            <strong>{{ cashier.discount }}</strong>
          </div>
        </div>
      </app-section-card>

      <app-section-card eyebrow="Pagamento" title="Resumo financeiro">
        <div class="payment-total-card">
          <div>
            <span>Total</span>
            <strong>{{ cashier.total }}</strong>
          </div>
          <div>
            <span>Pago</span>
            <strong>{{ cashier.paid }}</strong>
          </div>
          <div class="remaining">
            <span>Restante</span>
            <strong>{{ cashier.remaining }}</strong>
          </div>
        </div>

        <div class="payment-method-grid">
          @for (method of cashier.payments; track method.label) {
            <button type="button" [class.selected]="method.selected">
              <i [class]="method.icon"></i>
              <span>{{ method.label }}</span>
              <strong>{{ method.value }}</strong>
            </button>
          }
        </div>

        <button type="button" class="primary-button finish-payment">
          <i class="pi pi-check-circle"></i>
          Finalizar pagamento
        </button>
      </app-section-card>
    </section>
  `,
})
export class CashierPageComponent {
  @Input({ required: true }) cashier!: CashierView;
}
