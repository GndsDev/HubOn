import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ProductView } from '../../shared/models/product.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, SectionCardComponent, StatusBadgeComponent],
  template: `
    <app-page-header
      kicker="Cardápio"
      title="Produtos"
      description="Gerencie itens de venda com preço, categoria, margem e disponibilidade."
    >
      <button type="button" class="primary-button">
        <i class="pi pi-plus"></i>
        Novo produto
      </button>
    </app-page-header>

    <app-section-card eyebrow="Catálogo" title="Produtos do cardápio">
      <div card-action class="search-box">
        <i class="pi pi-search"></i>
        <span>Buscar produto</span>
      </div>

      <div class="product-table">
        <div class="product-table-head">
          <span>Produto</span>
          <span>Categoria</span>
          <span>Preço</span>
          <span>Margem</span>
          <span>Status</span>
          <span>Ações</span>
        </div>
        @for (product of products; track product.id) {
          <article class="product-row">
            <strong>{{ product.name }}</strong>
            <span>{{ product.category }}</span>
            <b>{{ product.price }}</b>
            <span>{{ product.margin }}</span>
            <app-status-badge
              [label]="product.status === 'active' ? 'Ativo' : 'Inativo'"
              [tone]="product.status === 'active' ? 'success' : 'neutral'"
            />
            <div class="row-actions">
              <button type="button" title="Editar"><i class="pi pi-pencil"></i></button>
              <button type="button" title="Desativar"><i class="pi pi-ban"></i></button>
            </div>
          </article>
        }
      </div>
    </app-section-card>
  `,
})
export class ProductsPageComponent {
  @Input({ required: true }) products: ProductView[] = [];
}
