import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, Observable, of, switchMap } from 'rxjs';
import { CategoryApiService } from '../../core/services/category-api.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { IngredientApiService } from '../../core/services/ingredient-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { ProductStockLinkApiService } from '../../core/services/product-stock-link-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AccessibleDialogDirective } from '../../shared/directives/accessible-dialog.directive';
import { BodyPortalDirective } from '../../shared/directives/body-portal.directive';
import { Category } from '../../shared/models/category.model';
import { Ingredient } from '../../shared/models/ingredient.model';
import {
  PreparationFlow,
  Product,
  ProductOption,
  ProductOptionGroup,
  ProductOptionGroupRequest,
  ProductOptionRequest,
  ProductRegistrationRequest,
  ProductRequest,
  ProductVariant,
  ProductVariantRegistrationRequest,
  ProductVariantRequest,
} from '../../shared/models/product.model';
import { apiErrorMessage } from '../../shared/util/api-error';
import { preparationFlowLabel, priceRangeSummary, registrationStepIsValid } from '../../shared/util/catalog-workflow';
import { calculateOverlayPosition, OverlayPosition } from '../../shared/util/overlay-position';
import { formatStockValue } from '../../shared/util/unit-format';

type ProductManagementTab = 'INFORMATION' | 'VARIANTS' | 'CHOICES';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
    AccessibleDialogDirective,
    BodyPortalDirective,
  ],
  template: `
    <app-page-header kicker="Cardápio" title="Produtos" description="Cadastre o item, suas variações e as escolhas da venda em um único fluxo.">
      <button type="button" class="primary-button" (click)="openRegistration()">
        <i class="pi pi-plus"></i>Novo produto
      </button>
    </app-page-header>

    <app-section-card eyebrow="Catálogo" title="Produtos do cardápio">
      <label card-action class="search-box">
        <i class="pi pi-search"></i>
        <input type="search" placeholder="Buscar produto ou categoria" [(ngModel)]="searchTerm" aria-label="Buscar produto" />
      </label>

      @if (loading()) {
        <div class="loading-grid">@for (item of [1,2,3,4]; track item) { <div class="loading-row"></div> }</div>
      } @else if (error()) {
        <div class="error-panel" role="alert">
          <i class="pi pi-exclamation-triangle"></i>
          <div><strong>Não foi possível carregar</strong><p>{{ error() }}</p></div>
          <button type="button" class="ghost-button" (click)="load()"><i class="pi pi-refresh"></i>Tentar novamente</button>
        </div>
      } @else if (filteredProducts.length === 0) {
        <app-empty-state icon="pi pi-box" title="Nenhum produto encontrado" description="Cadastre um produto ou ajuste a busca." />
      } @else {
        <div class="product-table catalog-product-table">
          <div class="product-table-head">
            <span>Produto</span><span>Categoria</span><span>Fluxo</span><span>Variações</span><span>Faixa de preço</span><span>Disponibilidade</span><span>Status</span><span>Ações</span>
          </div>
          @for (product of filteredProducts; track product.id) {
            <article class="product-row">
              <div class="product-name">
                <strong>{{ product.name }}</strong>
                <small>{{ product.complete ? (product.description || 'Sem descrição') : 'Cadastro incompleto' }}</small>
              </div>
              <span>{{ product.categoryName }}</span>
              <app-status-badge class="flow-status-badge" [label]="flowLabel(product.preparationFlow)" [tone]="product.preparationFlow === 'REQUIRES_PREPARATION' ? 'warning' : 'info'" />
              <span>{{ variantSummary(product) }}</span>
              <strong>{{ priceSummary(product) }}</strong>
              <app-status-badge [label]="product.available ? 'Disponível' : 'Indisponível'" [tone]="product.available ? 'success' : 'warning'" />
              <app-status-badge [label]="product.active ? 'Ativo' : 'Inativo'" [tone]="product.active ? 'success' : 'neutral'" />
              <div class="row-actions">
                <button
                  type="button"
                  class="icon-action-button actions-trigger"
                  title="Ações do produto"
                  [attr.aria-label]="'Abrir ações de ' + product.name"
                  [attr.aria-expanded]="actionMenuOpen() === product.id"
                  (click)="toggleActionMenu(product.id, $event)"
                ><i class="pi pi-ellipsis-v"></i></button>
              </div>
            </article>
          }
        </div>
      }
    </app-section-card>

    @if (actionMenuProduct(); as product) {
      <div
        appBodyPortal
        class="action-menu action-menu-overlay product-action-menu"
        role="menu"
        [attr.data-product-menu-id]="product.id"
        [attr.data-placement]="actionMenuPosition().placement"
        [style.left.px]="actionMenuPosition().left"
        [style.top.px]="actionMenuPosition().top"
        [style.max-height.px]="actionMenuPosition().maxHeight"
        (click)="$event.stopPropagation()"
        (keydown)="onActionMenuKeydown($event)"
      >
        <button type="button" role="menuitem" (click)="openEdit(product)"><i class="pi pi-pencil"></i>Gerenciar produto</button>
        <button type="button" role="menuitem" (click)="toggleAvailable(product)"><i [class]="product.available ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>{{ product.available ? 'Indisponibilizar' : 'Disponibilizar' }}</button>
        <button type="button" role="menuitem" [class.danger-menu-item]="product.active" (click)="toggleActive(product)"><i [class]="product.active ? 'pi pi-ban' : 'pi pi-check'"></i>{{ product.active ? 'Desativar' : 'Ativar' }}</button>
      </div>
    }

    @if (registrationOpen()) {
      <div class="modal-backdrop" (click)="closeRegistration()">
        <form class="modal-panel product-wizard-panel" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="registration-title" [dialogCloseDisabled]="saving()" (dialogClose)="closeRegistration()" (click)="$event.stopPropagation()" (ngSubmit)="finishRegistration()">
          <div class="modal-header">
            <div><span>Novo produto</span><h2 id="registration-title">{{ wizardTitle() }}</h2></div>
            <button type="button" class="icon-button" aria-label="Fechar" (click)="closeRegistration()"><i class="pi pi-times"></i></button>
          </div>

          <div class="wizard-progress" aria-label="Etapas do cadastro">
            @for (step of wizardSteps; track step.number) {
              <button type="button" [class.active]="wizardStep() === step.number" [class.complete]="wizardStep() > step.number" (click)="goToStep(step.number)">
                <span>{{ step.number }}</span><small>{{ step.label }}</small>
              </button>
            }
          </div>

          @if (wizardStep() === 1) {
            <div class="form-grid">
              <label class="field"><span>Nome</span><input name="name" [(ngModel)]="registrationProduct.name" maxlength="120" required autofocus /></label>
              <label class="field"><span>Categoria</span><select name="category" [(ngModel)]="registrationProduct.categoryId" required><option [ngValue]="0" disabled>Selecione</option>@for (category of activeCategories; track category.id) { <option [ngValue]="category.id">{{ category.name }}</option> }</select></label>
              <label class="field full"><span>Descrição</span><textarea name="description" [(ngModel)]="registrationProduct.description" maxlength="255"></textarea></label>
              <fieldset class="field full flow-choice"><legend>Fluxo do item</legend>
                <label [class.selected]="registrationProduct.preparationFlow === 'REQUIRES_PREPARATION'"><input type="radio" name="flow" value="REQUIRES_PREPARATION" [(ngModel)]="registrationProduct.preparationFlow" /><i class="pi pi-send"></i><span><strong>Requer preparo</strong><small>Use para pratos, espetos, porções, caldos e itens que precisam ser preparados.</small></span></label>
                <label [class.selected]="registrationProduct.preparationFlow === 'DIRECT_SERVICE'"><input type="radio" name="flow" value="DIRECT_SERVICE" [(ngModel)]="registrationProduct.preparationFlow" /><i class="pi pi-bolt"></i><span><strong>Entrega direta</strong><small>Use para bebidas e produtos prontos que podem ser entregues imediatamente.</small></span></label>
              </fieldset>
              <label class="toggle-field"><input type="checkbox" name="active" [(ngModel)]="registrationProduct.active" /><span>Ativo</span></label>
              <label class="toggle-field"><input type="checkbox" name="available" [(ngModel)]="registrationProduct.available" /><span>Disponível</span></label>
            </div>
          }

          @if (wizardStep() === 2) {
            <div class="form-section-title"><div><span>Variações e preços</span><small>O preço pertence à variação vendável.</small></div><div class="action-cluster"><button type="button" class="ghost-button compact-button" (click)="useDefaultVariant()">Usar variação Padrão</button><button type="button" class="ghost-button compact-button" (click)="addRegistrationVariant()"><i class="pi pi-plus"></i>Adicionar</button></div></div>
            <div class="wizard-list">
              @for (entry of registrationVariants; track $index; let index = $index) {
                <div class="wizard-variant-row">
                  <label class="field"><span>Nome</span><input [name]="'variant-name-' + index" [(ngModel)]="entry.variant.name" maxlength="120" /></label>
                  <label class="field"><span>Preço</span><input [name]="'variant-price-' + index" type="number" min="0" step="0.01" [(ngModel)]="entry.variant.price" /></label>
                  <label class="field"><span>SKU opcional</span><input [name]="'variant-sku-' + index" [(ngModel)]="entry.variant.sku" maxlength="80" /></label>
                  <label class="toggle-field compact"><input type="checkbox" [name]="'variant-active-' + index" [(ngModel)]="entry.variant.active" /><span>Ativa</span></label>
                  <label class="toggle-field compact"><input type="checkbox" [name]="'variant-available-' + index" [(ngModel)]="entry.variant.available" /><span>Disponível</span></label>
                  <button type="button" class="icon-button danger-icon" title="Remover variação" [attr.aria-label]="'Remover variação ' + entry.variant.name" (click)="removeRegistrationVariant(index)" [disabled]="registrationVariants.length === 1"><i class="pi pi-trash"></i></button>
                </div>
              }
            </div>
          }

          @if (wizardStep() === 3) {
            <div class="wizard-optional-section">
              <div class="form-section-title"><div><span>Estoque automático</span><small>Opcional. Disponível apenas para itens com baixa automática.</small></div></div>
              <div class="wizard-list compact-list">
                @for (entry of registrationVariants; track $index; let index = $index) {
                  <div class="wizard-stock-row">
                    <strong>{{ entry.variant.name }}</strong>
                    <label class="field"><span>Item de estoque</span><select [name]="'stock-' + index" [(ngModel)]="entry.stockItemId"><option [ngValue]="null">Sem vínculo</option>@for (item of automaticStockItems; track item.id) { <option [ngValue]="item.id">{{ item.name }} · {{ stockValue(item) }}</option> }</select></label>
                    <label class="field"><span>Quantidade por venda</span><input [name]="'stock-quantity-' + index" type="number" min="0.001" step="0.001" [(ngModel)]="entry.quantityPerSale" [disabled]="!entry.stockItemId" /></label>
                  </div>
                }
              </div>
            </div>
            <div class="wizard-optional-section">
              <div class="form-section-title"><div><span>Grupos de escolhas</span><small>Opcional. Configure acompanhamentos, sabores ou outras decisões do cliente.</small></div><button type="button" class="ghost-button compact-button" (click)="addRegistrationGroup()"><i class="pi pi-plus"></i>Grupo</button></div>
              @for (group of registrationGroups; track $index; let groupIndex = $index) {
                <section class="choice-editor">
                  <div class="choice-editor-head"><label class="field"><span>Nome do grupo</span><input [name]="'group-name-' + groupIndex" [(ngModel)]="group.name" /></label><label class="toggle-field compact"><input type="checkbox" [name]="'group-required-' + groupIndex" [(ngModel)]="group.required" (ngModelChange)="syncRequiredGroup(group)" /><span>Obrigatório</span></label><label class="field number-field"><span>Mín.</span><input [name]="'group-min-' + groupIndex" type="number" min="0" [(ngModel)]="group.minimumSelections" /></label><label class="field number-field"><span>Máx.</span><input [name]="'group-max-' + groupIndex" type="number" min="1" [(ngModel)]="group.maximumSelections" /></label><button type="button" class="icon-button danger-icon" title="Remover grupo" [attr.aria-label]="'Remover grupo ' + group.name" (click)="registrationGroups.splice(groupIndex, 1)"><i class="pi pi-trash"></i></button></div>
                  @for (option of group.options; track $index; let optionIndex = $index) {
                    <div class="choice-option-row"><label class="field"><span>Opção</span><input [name]="'choice-name-' + groupIndex + '-' + optionIndex" [(ngModel)]="option.name" /></label><label class="field"><span>Adicional</span><input [name]="'choice-price-' + groupIndex + '-' + optionIndex" type="number" min="0" step="0.01" [(ngModel)]="option.additionalPrice" /></label><button type="button" class="icon-button danger-icon" title="Remover opção" [attr.aria-label]="'Remover opção ' + option.name" (click)="group.options.splice(optionIndex, 1)"><i class="pi pi-trash"></i></button></div>
                  }
                  <button type="button" class="text-action" (click)="addRegistrationOption(group)"><i class="pi pi-plus"></i>Adicionar opção</button>
                </section>
              } @empty { <p class="form-helper">Este produto não exige escolhas adicionais.</p> }
            </div>
          }

          <div class="modal-actions wizard-actions">
            <button type="button" class="ghost-button" (click)="wizardStep() === 1 ? closeRegistration() : previousStep()">{{ wizardStep() === 1 ? 'Cancelar' : 'Voltar' }}</button>
            @if (wizardStep() < 3) { <button type="button" class="primary-button" (click)="nextStep()">Continuar<i class="pi pi-arrow-right"></i></button> }
            @else { <button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-check"></i>{{ saving() ? 'Salvando...' : 'Concluir cadastro' }}</button> }
          </div>
        </form>
      </div>
    }

    @if (managementTab() && selectedProduct(); as product) {
      <div class="modal-backdrop" (click)="closeManagement()">
        <section class="modal-panel product-management-dialog" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="product-management-title" [dialogCloseDisabled]="saving()" (dialogClose)="closeManagement()" (click)="$event.stopPropagation()">
          <div class="modal-header product-management-header">
            <div><span>{{ product.name }}</span><h2 id="product-management-title">Gerenciar produto</h2></div>
            <button type="button" class="icon-button" title="Fechar" aria-label="Fechar gerenciamento do produto" (click)="closeManagement()"><i class="pi pi-times"></i></button>
          </div>

          <div class="segmented-control product-manager-tabs" aria-label="Seções do produto">
            <button type="button" [class.active]="managementTab() === 'INFORMATION'" [attr.aria-pressed]="managementTab() === 'INFORMATION'" (click)="showManagementTab('INFORMATION')">Informações</button>
            <button type="button" [class.active]="managementTab() === 'VARIANTS'" [attr.aria-pressed]="managementTab() === 'VARIANTS'" (click)="showManagementTab('VARIANTS')">Variações e estoque</button>
            <button type="button" [class.active]="managementTab() === 'CHOICES'" [attr.aria-pressed]="managementTab() === 'CHOICES'" (click)="showManagementTab('CHOICES')">Escolhas</button>
          </div>

          <div class="product-management-content" (scroll)="repositionVariantActionMenu()">
            @if (managementTab() === 'INFORMATION') {
              <div class="product-information-form">
                <div class="content-heading"><div><span>Informações do produto</span><small>Dados exibidos no catálogo e no atendimento.</small></div></div>
                <div class="form-grid">
                  <label class="field"><span>Nome</span><input name="editName" [(ngModel)]="editForm.name" required autofocus /></label>
                  <label class="field"><span>Categoria</span><select name="editCategory" [(ngModel)]="editForm.categoryId">@for (category of categories(); track category.id) { <option [ngValue]="category.id">{{ category.name }}</option> }</select></label>
                  <label class="field full"><span>Descrição</span><textarea name="editDescription" [(ngModel)]="editForm.description"></textarea></label>
                  <label class="field product-flow-field"><span>Fluxo</span><select name="editFlow" [(ngModel)]="editForm.preparationFlow"><option value="REQUIRES_PREPARATION">Requer preparo</option><option value="DIRECT_SERVICE">Entrega direta</option></select></label>
                  <label class="field"><span>Ordem de exibição</span><input name="editOrder" type="number" min="0" [(ngModel)]="editForm.displayOrder" /></label>
                  <label class="toggle-field"><input type="checkbox" name="editActive" [(ngModel)]="editForm.active" /><span>Ativo</span></label>
                  <label class="toggle-field"><input type="checkbox" name="editAvailable" [(ngModel)]="editForm.available" /><span>Disponível</span></label>
                </div>
              </div>
            }

            @if (managementTab() === 'VARIANTS') {
              <div class="variant-manager-layout">
                <section class="variant-manager-section" aria-labelledby="registered-variants-title">
                  <div class="content-heading"><div><span id="registered-variants-title">Variações cadastradas</span><small>Preço, disponibilidade e baixa automática de cada opção.</small></div><span class="content-count">{{ product.variants.length }}</span></div>
                  <div class="variant-manager-list">
                    @for (variant of product.variants; track variant.id) {
                      <article class="variant-manager-row">
                        <div class="variant-identity"><strong>{{ variant.name }}</strong><small>{{ variant.sku || 'Sem SKU' }}</small></div>
                        <div class="variant-detail"><small>Preço</small><b>{{ currency(variant.price) }}</b></div>
                        <div class="variant-detail"><small>Disponibilidade</small><app-status-badge [label]="variant.available ? 'Disponível' : 'Indisponível'" [tone]="variant.available ? 'success' : 'warning'" /></div>
                        <div class="variant-stock-state"><small>Estoque automático</small><strong>{{ variant.stockLinkActive ? variant.stockItemName : 'Sem vínculo' }}</strong>@if (variant.stockLinkActive) { <span>{{ variant.quantityPerSale }} por venda</span> }</div>
                        <div class="variant-row-actions">
                          <button type="button" class="ghost-button compact-button" [title]="'Editar variação ' + variant.name" [attr.aria-label]="'Editar variação ' + variant.name" (click)="editVariant(variant)"><i class="pi pi-pencil"></i>Editar variação</button>
                          <button type="button" class="icon-action-button actions-trigger" title="Mais ações" [attr.aria-label]="'Mais ações da variação ' + variant.name" aria-haspopup="menu" [attr.aria-expanded]="variantActionMenuId() === variant.id" (click)="toggleVariantActionMenu(variant, $event)"><i class="pi pi-ellipsis-v"></i></button>
                        </div>
                      </article>
                    } @empty { <app-empty-state icon="pi pi-list" title="Cadastro incompleto" description="Adicione pelo menos uma variação vendável." /> }
                  </div>
                </section>

                <form id="variant-editor-form" class="variant-editor" (ngSubmit)="saveVariant()">
                  <div class="content-heading"><div><span id="variant-editor-title">{{ variantEditing() ? 'Editar variação' : 'Nova variação' }}</span><small>O mesmo formulário cria e atualiza a variação.</small></div></div>
                  <div class="variant-editor-fields">
                    <label class="field"><span>Nome</span><input data-variant-name name="variantName" [(ngModel)]="variantForm.name" required /></label>
                    <label class="field"><span>Preço</span><input name="variantPrice" type="number" min="0" step="0.01" [(ngModel)]="variantForm.price" required /></label>
                    <label class="field"><span>SKU opcional</span><input name="variantSku" [(ngModel)]="variantForm.sku" /></label>
                    <label class="field"><span>Ordem</span><input name="variantOrder" type="number" min="0" [(ngModel)]="variantForm.displayOrder" /></label>
                    <label class="toggle-field"><input type="checkbox" name="variantActive" [(ngModel)]="variantForm.active" /><span>Ativa</span></label>
                    <label class="toggle-field"><input type="checkbox" name="variantAvailable" [(ngModel)]="variantForm.available" /><span>Disponível</span></label>
                  </div>
                  <section class="variant-stock-editor">
                    <label class="toggle-field"><input type="checkbox" name="variantStockEnabled" [ngModel]="stockLinkEnabled()" (ngModelChange)="stockLinkEnabled.set($event)" /><span>Vínculo de estoque opcional</span></label>
                    @if (stockLinkEnabled()) {
                      <div class="variant-stock-fields">
                        <label class="field"><span>Item com baixa automática</span><select name="stockItem" [(ngModel)]="stockLinkForm.stockItemId" required><option [ngValue]="0" disabled>Selecione</option>@for (item of automaticStockItems; track item.id) { <option [ngValue]="item.id">{{ item.name }} · {{ stockValue(item) }}</option> }</select></label>
                        <label class="field"><span>Quantidade por venda</span><input name="quantityPerSale" type="number" min="0.001" step="0.001" [(ngModel)]="stockLinkForm.quantityPerSale" required /></label>
                      </div>
                    }
                  </section>
                </form>
              </div>
            }

            @if (managementTab() === 'CHOICES') {
              <div class="choice-manager-layout">
                <section class="choice-manager-list">
                  <div class="content-heading"><div><span>Grupos de escolhas</span><small>Opções e adicionais disponíveis durante o atendimento.</small></div></div>
                  @for (group of product.optionGroups; track group.id) {
                    <article class="managed-choice-group">
                      <div class="managed-choice-head"><div><strong>{{ group.name }}</strong><small>{{ group.required ? 'Obrigatório' : 'Opcional' }} · {{ group.minimumSelections }} a {{ group.maximumSelections }}</small></div><div class="row-actions"><button type="button" class="icon-action-button" title="Editar grupo" aria-label="Editar grupo" (click)="editChoiceGroup(group)"><i class="pi pi-pencil"></i></button><button type="button" class="icon-action-button" [title]="group.active ? 'Desativar grupo' : 'Ativar grupo'" [attr.aria-label]="group.active ? 'Desativar grupo' : 'Ativar grupo'" (click)="toggleChoiceGroup(group)"><i [class]="group.active ? 'pi pi-ban' : 'pi pi-check'"></i></button></div></div>
                      @for (option of group.options; track option.id) { <div class="managed-option"><span>{{ option.name }} <small>{{ option.additionalPrice ? '+ ' + currency(option.additionalPrice) : 'sem adicional' }}</small></span><div class="row-actions"><button type="button" class="icon-action-button" title="Editar opção" aria-label="Editar opção" (click)="editChoiceOption(group, option)"><i class="pi pi-pencil"></i></button><button type="button" class="icon-action-button" [title]="option.active ? 'Desativar opção' : 'Ativar opção'" [attr.aria-label]="option.active ? 'Desativar opção' : 'Ativar opção'" (click)="toggleChoiceOption(group, option)"><i [class]="option.active ? 'pi pi-ban' : 'pi pi-check'"></i></button></div></div> }
                      <button type="button" class="text-action" (click)="newChoiceOption(group)"><i class="pi pi-plus"></i>Adicionar opção</button>
                    </article>
                  } @empty { <app-empty-state icon="pi pi-check-square" title="Sem escolhas" description="Este produto ainda não possui grupos de escolhas." /> }
                </section>
                <form id="choice-editor-form" class="variant-editor" (ngSubmit)="saveChoiceEditor()">
                  <div class="content-heading"><div><span>{{ optionEditorGroup() ? (choiceOptionEditing() ? 'Editar opção' : 'Nova opção') : (choiceGroupEditing() ? 'Editar grupo' : 'Novo grupo') }}</span><small>Configure a escolha que será exibida na venda.</small></div></div>
                  @if (optionEditorGroup()) {
                    <label class="field"><span>Nome da opção</span><input name="managedOptionName" [(ngModel)]="choiceOptionForm.name" required /></label><label class="field"><span>Preço adicional</span><input name="managedOptionPrice" type="number" min="0" step="0.01" [(ngModel)]="choiceOptionForm.additionalPrice" /></label><label class="field"><span>Ordem</span><input name="managedOptionOrder" type="number" min="0" [(ngModel)]="choiceOptionForm.displayOrder" /></label><label class="toggle-field"><input type="checkbox" name="managedOptionActive" [(ngModel)]="choiceOptionForm.active" /><span>Ativa</span></label>
                  } @else {
                    <label class="field"><span>Nome do grupo</span><input name="managedGroupName" [(ngModel)]="choiceGroupForm.name" required /></label><label class="toggle-field"><input type="checkbox" name="managedGroupRequired" [(ngModel)]="choiceGroupForm.required" (ngModelChange)="syncRequiredGroup(choiceGroupForm)" /><span>Obrigatório</span></label><div class="form-grid"><label class="field"><span>Mínimo</span><input name="managedGroupMin" type="number" min="0" [(ngModel)]="choiceGroupForm.minimumSelections" /></label><label class="field"><span>Máximo</span><input name="managedGroupMax" type="number" min="1" [(ngModel)]="choiceGroupForm.maximumSelections" /></label></div><label class="field"><span>Ordem</span><input name="managedGroupOrder" type="number" min="0" [(ngModel)]="choiceGroupForm.displayOrder" /></label><label class="toggle-field"><input type="checkbox" name="managedGroupActive" [(ngModel)]="choiceGroupForm.active" /><span>Ativo</span></label>
                  }
                </form>
              </div>
            }
          </div>

          <div class="modal-actions product-management-actions">
            @if (managementTab() === 'INFORMATION') {
              <button type="button" class="ghost-button" (click)="closeManagement()">Cancelar</button><button type="button" class="primary-button" [disabled]="saving()" (click)="saveEdit()"><i class="pi pi-save"></i>Salvar informações</button>
            } @else if (managementTab() === 'VARIANTS') {
              <button type="button" class="ghost-button" (click)="resetVariantForm()">Cancelar</button><button type="submit" form="variant-editor-form" class="primary-button" [disabled]="saving()"><i class="pi pi-save"></i>{{ saving() ? 'Salvando...' : 'Salvar variação' }}</button>
            } @else {
              <button type="button" class="ghost-button" (click)="resetChoiceEditor()">Novo grupo</button><button type="submit" form="choice-editor-form" class="primary-button" [disabled]="saving()"><i class="pi pi-save"></i>{{ saving() ? 'Salvando...' : 'Salvar escolhas' }}</button>
            }
          </div>
        </section>
      </div>
    }

    @if (variantActionMenuVariant(); as variant) {
      <div appBodyPortal class="action-menu action-menu-overlay variant-action-menu" role="menu" [attr.data-variant-menu-id]="variant.id" [attr.data-placement]="variantActionMenuPosition().placement" [style.left.px]="variantActionMenuPosition().left" [style.top.px]="variantActionMenuPosition().top" [style.max-height.px]="variantActionMenuPosition().maxHeight" (click)="$event.stopPropagation()" (keydown)="onVariantActionMenuKeydown($event)">
        <button type="button" role="menuitem" (click)="editVariantStock(variant)"><i class="pi pi-link"></i>{{ variant.stockLinkActive ? 'Alterar vínculo de estoque' : 'Vincular estoque' }}</button>
        @if (variant.stockLinkActive) { <button type="button" role="menuitem" class="danger-menu-item" (click)="removeStockLink(variant)"><i class="pi pi-link"></i>Remover vínculo de estoque</button> }
        <button type="button" role="menuitem" (click)="closeVariantActionMenu(); toggleVariantAvailable(variant)"><i [class]="variant.available ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>{{ variant.available ? 'Indisponibilizar' : 'Disponibilizar' }}</button>
        <button type="button" role="menuitem" [class.danger-menu-item]="variant.active" (click)="closeVariantActionMenu(); toggleVariantActive(variant)"><i [class]="variant.active ? 'pi pi-ban' : 'pi pi-check'"></i>{{ variant.active ? 'Desativar' : 'Ativar' }}</button>
      </div>
    }
  `,
})
export class ProductsPageComponent implements OnInit {
  private readonly api = inject(ProductApiService);
  private readonly categoryApi = inject(CategoryApiService);
  private readonly ingredientApi = inject(IngredientApiService);
  private readonly stockLinkApi = inject(ProductStockLinkApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly document = inject(DOCUMENT);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly ingredients = signal<Ingredient[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly registrationOpen = signal(false);
  readonly wizardStep = signal(1);
  readonly managementTab = signal<ProductManagementTab | null>(null);
  readonly editingProduct = signal<Product | null>(null);
  readonly selectedProduct = signal<Product | null>(null);
  readonly variantEditing = signal<ProductVariant | null>(null);
  readonly choiceGroupEditing = signal<ProductOptionGroup | null>(null);
  readonly choiceOptionEditing = signal<ProductOption | null>(null);
  readonly optionEditorGroup = signal<ProductOptionGroup | null>(null);
  readonly stockLinkEnabled = signal(false);
  readonly actionMenuOpen = signal<number | null>(null);
  readonly actionMenuPosition = signal<OverlayPosition>({ left: 0, top: 0, maxHeight: 320, placement: 'bottom' });
  readonly variantActionMenuId = signal<number | null>(null);
  readonly variantActionMenuPosition = signal<OverlayPosition>({ left: 0, top: 0, maxHeight: 320, placement: 'bottom' });

  private actionMenuTrigger: HTMLElement | null = null;
  private variantActionMenuTrigger: HTMLElement | null = null;
  searchTerm = '';
  readonly wizardSteps = [{ number: 1, label: 'Informações' }, { number: 2, label: 'Variações' }, { number: 3, label: 'Configurações' }];
  registrationProduct: ProductRequest = this.emptyProduct();
  registrationVariants: ProductVariantRegistrationRequest[] = [this.emptyRegistrationVariant()];
  registrationGroups: ProductOptionGroupRequest[] = [];
  editForm: ProductRequest = this.emptyProduct();
  variantForm: ProductVariantRequest = this.emptyVariant();
  choiceGroupForm: ProductOptionGroupRequest = this.emptyGroup(false);
  choiceOptionForm: ProductOptionRequest = this.emptyOption();
  stockLinkForm = { stockItemId: 0, quantityPerSale: 1 };

  ngOnInit(): void { this.load(); }

  get activeCategories(): Category[] { return this.categories().filter((category) => category.active); }
  get automaticStockItems(): Ingredient[] { return this.ingredients().filter((item) => item.active && item.controlMode === 'DIRECT_SALE'); }
  get filteredProducts(): Product[] {
    const search = this.normalize(this.searchTerm);
    return this.products().filter((product) => !search || this.normalize(`${product.name} ${product.categoryName}`).includes(search));
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ products: this.api.getAll(), categories: this.categoryApi.getAll(), ingredients: this.ingredientApi.getAll() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: ({ products, categories, ingredients }) => { this.products.set(products); this.categories.set(categories); this.ingredients.set(ingredients); this.refreshSelectedProduct(); }, error: (error) => this.error.set(apiErrorMessage(error)) });
  }

  openRegistration(): void {
    if (!this.activeCategories.length) { this.feedback.info('Cadastre uma categoria ativa antes do produto.'); return; }
    this.registrationProduct = { ...this.emptyProduct(), categoryId: this.activeCategories[0].id };
    this.registrationVariants = [this.emptyRegistrationVariant()];
    this.registrationGroups = [];
    this.wizardStep.set(1);
    this.registrationOpen.set(true);
  }
  closeRegistration(): void { if (!this.saving()) this.registrationOpen.set(false); }
  wizardTitle(): string { return this.wizardSteps[this.wizardStep() - 1].label; }
  goToStep(step: number): void { if (step <= this.wizardStep() || this.validStep(this.wizardStep())) this.wizardStep.set(step); }
  previousStep(): void { this.wizardStep.update((step) => Math.max(1, step - 1)); }
  nextStep(): void { if (this.validStep(this.wizardStep())) this.wizardStep.update((step) => Math.min(3, step + 1)); }
  useDefaultVariant(): void { this.registrationVariants = [this.emptyRegistrationVariant('Padrão')]; }
  addRegistrationVariant(): void { this.registrationVariants.push(this.emptyRegistrationVariant('')); }
  removeRegistrationVariant(index: number): void { if (this.registrationVariants.length > 1) this.registrationVariants.splice(index, 1); }
  addRegistrationGroup(): void { this.registrationGroups.push(this.emptyGroup(true)); }
  addRegistrationOption(group: ProductOptionGroupRequest): void { group.options.push(this.emptyOption()); }
  syncRequiredGroup(group: ProductOptionGroupRequest): void { if (group.required && group.minimumSelections < 1) group.minimumSelections = 1; }

  finishRegistration(): void {
    if (![1, 2, 3].every((step) => this.validStep(step))) return;
    const request: ProductRegistrationRequest = {
      product: { ...this.registrationProduct, name: this.registrationProduct.name.trim(), description: this.registrationProduct.description?.trim() || null },
      variants: this.registrationVariants.map((entry, index) => ({ variant: { ...entry.variant, name: entry.variant.name.trim(), sku: entry.variant.sku?.trim() || null, displayOrder: index }, stockItemId: entry.stockItemId || null, quantityPerSale: entry.stockItemId ? Number(entry.quantityPerSale) : null })),
      optionGroups: this.registrationGroups.map((group, index) => ({ ...group, name: group.name.trim(), displayOrder: index, options: group.options.map((option, optionIndex) => ({ ...option, name: option.name.trim(), displayOrder: optionIndex })) })),
    };
    this.saving.set(true);
    this.api.register(request).pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { this.feedback.success('Produto cadastrado com sucesso.'); this.registrationOpen.set(false); this.load(); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }

  openEdit(product: Product): void {
    this.closeActionMenu();
    this.prepareManagement(product);
    this.managementTab.set('INFORMATION');
  }
  saveEdit(): void {
    const product = this.editingProduct();
    if (!product || !this.editForm.name.trim() || !this.editForm.categoryId) { this.feedback.error('Preencha nome e categoria.'); return; }
    this.saving.set(true);
    this.api.update(product.id, { ...this.editForm, name: this.editForm.name.trim(), description: this.editForm.description?.trim() || null }).pipe(finalize(() => this.saving.set(false))).subscribe({ next: (updated) => { this.feedback.success('Produto atualizado.'); this.products.update((products) => products.map((item) => item.id === updated.id ? updated : item)); this.prepareManagement(updated, false); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }

  openVariants(product: Product): void { this.closeActionMenu(); this.prepareManagement(product); this.managementTab.set('VARIANTS'); }
  editVariant(variant: ProductVariant): void {
    this.closeVariantActionMenu();
    this.variantEditing.set(variant);
    this.variantForm = { name: variant.name, sku: variant.sku, price: variant.price, active: variant.active, available: variant.available, displayOrder: variant.displayOrder };
    this.stockLinkEnabled.set(variant.stockLinkActive);
    this.stockLinkForm = { stockItemId: variant.stockItemId ?? 0, quantityPerSale: variant.quantityPerSale ?? 1 };
    this.focusVariantEditor();
  }
  resetVariantForm(): void {
    this.closeVariantActionMenu();
    this.variantEditing.set(null);
    this.variantForm = this.emptyVariant('');
    this.stockLinkEnabled.set(false);
    this.stockLinkForm = { stockItemId: 0, quantityPerSale: 1 };
  }
  saveVariant(): void {
    const product = this.selectedProduct();
    if (!product || !this.variantForm.name.trim() || this.variantForm.price < 0) { this.feedback.error('Preencha nome e preço válidos.'); return; }
    if (this.stockLinkEnabled() && (!this.stockLinkForm.stockItemId || this.stockLinkForm.quantityPerSale <= 0)) { this.feedback.error('Selecione o item de estoque e informe uma quantidade válida.'); return; }
    const request = { ...this.variantForm, name: this.variantForm.name.trim(), sku: this.variantForm.sku?.trim() || null };
    const current = this.variantEditing();
    this.saving.set(true);
    const operation = current ? this.api.updateVariant(product.id, current.id, request) : this.api.createVariant(product.id, request);
    operation.pipe(
      switchMap((savedVariant) => this.syncVariantStockLink(savedVariant, current)),
      finalize(() => this.saving.set(false)),
    ).subscribe({ next: () => { this.feedback.success('Variação salva.'); this.resetVariantForm(); this.reloadProduct(product.id); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }
  toggleVariantActive(variant: ProductVariant): void { const product = this.selectedProduct(); if (!product) return; (variant.active ? this.api.deactivateVariant(product.id, variant.id) : this.api.activateVariant(product.id, variant.id)).subscribe({ next: () => this.reloadProduct(product.id), error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  toggleVariantAvailable(variant: ProductVariant): void { const product = this.selectedProduct(); if (!product) return; this.api.setVariantAvailable(product.id, variant.id, !variant.available).subscribe({ next: () => this.reloadProduct(product.id), error: (error) => this.feedback.error(apiErrorMessage(error)) }); }

  openChoices(product: Product): void { this.closeActionMenu(); this.prepareManagement(product); this.managementTab.set('CHOICES'); }
  editChoiceGroup(group: ProductOptionGroup): void { this.optionEditorGroup.set(null); this.choiceGroupEditing.set(group); this.choiceGroupForm = { name: group.name, required: group.required, minimumSelections: group.minimumSelections, maximumSelections: group.maximumSelections, displayOrder: group.displayOrder, active: group.active, options: [] }; }
  newChoiceOption(group: ProductOptionGroup): void { this.optionEditorGroup.set(group); this.choiceOptionEditing.set(null); this.choiceOptionForm = this.emptyOption(); }
  editChoiceOption(group: ProductOptionGroup, option: ProductOption): void { this.optionEditorGroup.set(group); this.choiceOptionEditing.set(option); this.choiceOptionForm = { name: option.name, additionalPrice: option.additionalPrice, displayOrder: option.displayOrder, active: option.active }; }
  resetChoiceEditor(): void { this.optionEditorGroup.set(null); this.choiceGroupEditing.set(null); this.choiceOptionEditing.set(null); this.choiceGroupForm = this.emptyGroup(false); this.choiceOptionForm = this.emptyOption(); }
  saveChoiceEditor(): void {
    const product = this.selectedProduct(); if (!product) return;
    const group = this.optionEditorGroup();
    this.saving.set(true);
    const operation: Observable<ProductOption | ProductOptionGroup> = group
      ? (this.choiceOptionEditing() ? this.api.updateOption(product.id, group.id, this.choiceOptionEditing()!.id, this.choiceOptionForm) : this.api.createOption(product.id, group.id, this.choiceOptionForm))
      : (this.choiceGroupEditing() ? this.api.updateOptionGroup(product.id, this.choiceGroupEditing()!.id, this.choiceGroupForm) : this.api.createOptionGroup(product.id, this.choiceGroupForm));
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { this.feedback.success('Escolhas atualizadas.'); this.resetChoiceEditor(); this.reloadProduct(product.id); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }
  toggleChoiceGroup(group: ProductOptionGroup): void { const product = this.selectedProduct(); if (!product) return; this.api.setOptionGroupActive(product.id, group.id, !group.active).subscribe({ next: () => this.reloadProduct(product.id), error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  toggleChoiceOption(group: ProductOptionGroup, option: ProductOption): void { const product = this.selectedProduct(); if (!product) return; this.api.setOptionActive(product.id, group.id, option.id, !option.active).subscribe({ next: () => this.reloadProduct(product.id), error: (error) => this.feedback.error(apiErrorMessage(error)) }); }

  editVariantStock(variant: ProductVariant): void { this.editVariant(variant); this.stockLinkEnabled.set(true); }
  removeStockLink(variant: ProductVariant): void {
    this.closeVariantActionMenu();
    this.saving.set(true);
    this.stockLinkApi.deactivate(variant.id).pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { this.feedback.success('Vínculo de estoque removido.'); if (this.variantEditing()?.id === variant.id) this.resetVariantForm(); this.reloadProduct(variant.productId); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }

  showManagementTab(tab: ProductManagementTab): void {
    this.closeVariantActionMenu();
    this.managementTab.set(tab);
  }
  closeManagement(): void {
    if (this.saving()) return;
    this.closeVariantActionMenu();
    this.managementTab.set(null);
  }

  toggleAvailable(product: Product): void { this.closeActionMenu(); this.api.setAvailable(product.id, !product.available).subscribe({ next: () => { this.feedback.success(product.available ? 'Produto indisponibilizado.' : 'Produto disponibilizado.'); this.load(); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  toggleActive(product: Product): void { this.closeActionMenu(); (product.active ? this.api.deactivate(product.id) : this.api.activate(product.id)).subscribe({ next: () => { this.feedback.success(product.active ? 'Produto desativado.' : 'Produto ativado.'); this.load(); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }

  flowLabel(flow: PreparationFlow): string { return preparationFlowLabel(flow); }
  variantSummary(product: Product): string { return product.variantCount === 1 ? '1 variação' : `${product.variantCount} variações`; }
  priceSummary(product: Product): string { return priceRangeSummary(product.minimumVariantPrice, product.maximumVariantPrice, (value) => this.currency(value)); }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  stockValue(item: Ingredient): string { return formatStockValue(item.currentStock, item.unit); }

  @HostListener('document:click') onDocumentClick(): void { this.closeActionMenu(); this.closeVariantActionMenu(); }
  @HostListener('document:keydown', ['$event']) onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (this.variantActionMenuId() != null) this.closeVariantActionMenu(true);
    else if (this.actionMenuOpen() != null) this.closeActionMenu(true);
  }
  @HostListener('window:resize') onResize(): void { this.repositionActionMenu(); this.repositionVariantActionMenu(); }
  @HostListener('window:scroll') onScroll(): void { this.repositionActionMenu(); this.repositionVariantActionMenu(); }
  toggleActionMenu(productId: number, event: MouseEvent): void { event.stopPropagation(); if (this.actionMenuOpen() === productId) { this.closeActionMenu(); return; } this.actionMenuTrigger = event.currentTarget as HTMLElement; this.actionMenuPosition.set({ left: -9999, top: -9999, maxHeight: 9999, placement: 'bottom' }); this.actionMenuOpen.set(productId); requestAnimationFrame(() => { this.repositionActionMenu(); this.document.querySelector<HTMLButtonElement>(`[data-product-menu-id="${productId}"] button`)?.focus(); }); }
  closeActionMenu(restoreFocus = false): void { const trigger = this.actionMenuTrigger; this.actionMenuOpen.set(null); this.actionMenuTrigger = null; if (restoreFocus) queueMicrotask(() => trigger?.focus()); }
  actionMenuProduct(): Product | null { const id = this.actionMenuOpen(); return id == null ? null : this.products().find((product) => product.id === id) ?? null; }
  onActionMenuKeydown(event: KeyboardEvent): void { if (event.key === 'Escape') { event.stopPropagation(); this.closeActionMenu(true); } this.navigateMenu(event, '.product-action-menu'); }

  toggleVariantActionMenu(variant: ProductVariant, event: MouseEvent): void {
    event.stopPropagation();
    if (this.variantActionMenuId() === variant.id) { this.closeVariantActionMenu(true); return; }
    this.closeActionMenu();
    this.variantActionMenuTrigger = event.currentTarget as HTMLElement;
    this.variantActionMenuPosition.set({ left: -9999, top: -9999, maxHeight: 9999, placement: 'bottom' });
    this.variantActionMenuId.set(variant.id);
    requestAnimationFrame(() => {
      this.repositionVariantActionMenu();
      this.document.querySelector<HTMLButtonElement>(`[data-variant-menu-id="${variant.id}"] button`)?.focus();
    });
  }
  closeVariantActionMenu(restoreFocus = false): void { const trigger = this.variantActionMenuTrigger; this.variantActionMenuId.set(null); this.variantActionMenuTrigger = null; if (restoreFocus) queueMicrotask(() => trigger?.focus()); }
  variantActionMenuVariant(): ProductVariant | null { const id = this.variantActionMenuId(); return id == null ? null : this.selectedProduct()?.variants.find((variant) => variant.id === id) ?? null; }
  onVariantActionMenuKeydown(event: KeyboardEvent): void { if (event.key === 'Escape') { event.stopPropagation(); this.closeVariantActionMenu(true); } this.navigateMenu(event, '.variant-action-menu'); }
  repositionVariantActionMenu(): void {
    const id = this.variantActionMenuId();
    const trigger = this.variantActionMenuTrigger;
    const view = this.document.defaultView;
    if (id == null || !trigger || !view) return;
    const menu = this.document.querySelector<HTMLElement>(`[data-variant-menu-id="${id}"]`);
    if (!menu) return;
    this.variantActionMenuPosition.set(calculateOverlayPosition(trigger.getBoundingClientRect(), menu.getBoundingClientRect(), view.innerWidth, view.innerHeight));
  }

  private repositionActionMenu(): void { const id = this.actionMenuOpen(); const trigger = this.actionMenuTrigger; const view = this.document.defaultView; if (id == null || !trigger || !view) return; const menu = this.document.querySelector<HTMLElement>(`[data-product-menu-id="${id}"]`); if (!menu) return; this.actionMenuPosition.set(calculateOverlayPosition(trigger.getBoundingClientRect(), menu.getBoundingClientRect(), view.innerWidth, view.innerHeight)); }
  private prepareManagement(product: Product, resetEditors = true): void {
    this.selectedProduct.set(product);
    this.editingProduct.set(product);
    this.editForm = { categoryId: product.categoryId, name: product.name, description: product.description, preparationFlow: product.preparationFlow, active: product.active, available: product.available, displayOrder: product.displayOrder, imageUrl: product.imageUrl };
    if (resetEditors) { this.resetVariantForm(); this.resetChoiceEditor(); }
  }
  private syncVariantStockLink(savedVariant: ProductVariant, previous: ProductVariant | null): Observable<unknown> {
    if (this.stockLinkEnabled()) {
      return previous?.stockLinkActive
        ? this.stockLinkApi.update(savedVariant.id, this.stockLinkForm)
        : this.stockLinkApi.create(savedVariant.id, this.stockLinkForm);
    }
    return previous?.stockLinkActive ? this.stockLinkApi.deactivate(savedVariant.id) : of(savedVariant);
  }
  private focusVariantEditor(): void {
    requestAnimationFrame(() => {
      this.document.querySelector<HTMLElement>('[data-variant-name]')?.focus();
      this.document.getElementById('variant-editor-title')?.scrollIntoView({ block: 'nearest' });
    });
  }
  private navigateMenu(event: KeyboardEvent, selector: string): void {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') return;
    const menu = (event.target as HTMLElement).closest<HTMLElement>(selector);
    const items = Array.from(menu?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    if (!items.length) return;
    const current = Math.max(0, items.indexOf(event.target as HTMLButtonElement));
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }
  private reloadProduct(productId: number): void { this.api.getById(productId).subscribe({ next: (product) => { this.products.update((products) => products.map((item) => item.id === product.id ? product : item)); this.selectedProduct.set(product); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  private refreshSelectedProduct(): void { const selected = this.selectedProduct(); if (selected) this.selectedProduct.set(this.products().find((product) => product.id === selected.id) ?? null); }
  private validStep(step: number): boolean { if (registrationStepIsValid(step, this.registrationProduct, this.registrationVariants, this.registrationGroups)) return true; const message = step === 1 ? 'Preencha nome e categoria.' : step === 2 ? 'Cadastre ao menos uma variação com nome e preço válidos.' : 'Revise os vínculos e grupos de escolhas.'; this.feedback.error(message); return false; }
  private emptyProduct(): ProductRequest { return { categoryId: 0, name: '', description: null, preparationFlow: 'REQUIRES_PREPARATION', active: true, available: true, displayOrder: 0, imageUrl: null }; }
  private emptyVariant(name = 'Padrão'): ProductVariantRequest { return { name, sku: null, price: 0, active: true, available: true, displayOrder: 0 }; }
  private emptyRegistrationVariant(name = 'Padrão'): ProductVariantRegistrationRequest { return { variant: this.emptyVariant(name), stockItemId: null, quantityPerSale: null }; }
  private emptyGroup(withOption: boolean): ProductOptionGroupRequest { return { name: '', required: false, minimumSelections: 0, maximumSelections: 1, displayOrder: 0, active: true, options: withOption ? [this.emptyOption()] : [] }; }
  private emptyOption(): ProductOptionRequest { return { name: '', additionalPrice: 0, displayOrder: 0, active: true }; }
  private normalize(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim(); }
}
