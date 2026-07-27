import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, Observable } from 'rxjs';
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
        <button type="button" role="menuitem" (click)="openEdit(product)"><i class="pi pi-pencil"></i>Editar produto</button>
        <button type="button" role="menuitem" (click)="openVariants(product)"><i class="pi pi-list"></i>Gerenciar variações</button>
        <button type="button" role="menuitem" (click)="openChoices(product)"><i class="pi pi-check-square"></i>Gerenciar escolhas</button>
        <button type="button" role="menuitem" (click)="openVariants(product)"><i class="pi pi-link"></i>Gerenciar estoque</button>
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
                  <button type="button" class="icon-button danger-icon" title="Remover variação" (click)="removeRegistrationVariant(index)" [disabled]="registrationVariants.length === 1"><i class="pi pi-trash"></i></button>
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
                  <div class="choice-editor-head"><label class="field"><span>Nome do grupo</span><input [name]="'group-name-' + groupIndex" [(ngModel)]="group.name" /></label><label class="toggle-field compact"><input type="checkbox" [name]="'group-required-' + groupIndex" [(ngModel)]="group.required" (ngModelChange)="syncRequiredGroup(group)" /><span>Obrigatório</span></label><label class="field number-field"><span>Mín.</span><input [name]="'group-min-' + groupIndex" type="number" min="0" [(ngModel)]="group.minimumSelections" /></label><label class="field number-field"><span>Máx.</span><input [name]="'group-max-' + groupIndex" type="number" min="1" [(ngModel)]="group.maximumSelections" /></label><button type="button" class="icon-button danger-icon" title="Remover grupo" (click)="registrationGroups.splice(groupIndex, 1)"><i class="pi pi-trash"></i></button></div>
                  @for (option of group.options; track $index; let optionIndex = $index) {
                    <div class="choice-option-row"><label class="field"><span>Opção</span><input [name]="'choice-name-' + groupIndex + '-' + optionIndex" [(ngModel)]="option.name" /></label><label class="field"><span>Adicional</span><input [name]="'choice-price-' + groupIndex + '-' + optionIndex" type="number" min="0" step="0.01" [(ngModel)]="option.additionalPrice" /></label><button type="button" class="icon-button danger-icon" title="Remover opção" (click)="group.options.splice(optionIndex, 1)"><i class="pi pi-trash"></i></button></div>
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

    @if (editOpen()) {
      <div class="modal-backdrop" (click)="editOpen.set(false)">
        <form class="modal-panel" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="edit-product-title" [dialogCloseDisabled]="saving()" (dialogClose)="editOpen.set(false)" (click)="$event.stopPropagation()" (ngSubmit)="saveEdit()">
          <div class="modal-header"><div><span>Produto base</span><h2 id="edit-product-title">Editar produto</h2></div><button type="button" class="icon-button" aria-label="Fechar" (click)="editOpen.set(false)"><i class="pi pi-times"></i></button></div>
          <div class="form-grid">
            <label class="field"><span>Nome</span><input name="editName" [(ngModel)]="editForm.name" required autofocus /></label>
            <label class="field"><span>Categoria</span><select name="editCategory" [(ngModel)]="editForm.categoryId">@for (category of categories(); track category.id) { <option [ngValue]="category.id">{{ category.name }}</option> }</select></label>
            <label class="field full"><span>Descrição</span><textarea name="editDescription" [(ngModel)]="editForm.description"></textarea></label>
            <label class="field product-flow-field"><span>Fluxo</span><select name="editFlow" [(ngModel)]="editForm.preparationFlow"><option value="REQUIRES_PREPARATION">Requer preparo</option><option value="DIRECT_SERVICE">Entrega direta</option></select></label>
            <label class="field"><span>Ordem de exibição</span><input name="editOrder" type="number" min="0" [(ngModel)]="editForm.displayOrder" /></label>
            <label class="toggle-field"><input type="checkbox" name="editActive" [(ngModel)]="editForm.active" /><span>Ativo</span></label>
            <label class="toggle-field"><input type="checkbox" name="editAvailable" [(ngModel)]="editForm.available" /><span>Disponível</span></label>
          </div>
          <div class="modal-actions"><button type="button" class="ghost-button" (click)="editOpen.set(false)">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-save"></i>Salvar</button></div>
        </form>
      </div>
    }

    @if (variantsOpen() && selectedProduct(); as product) {
      <div class="modal-backdrop" (click)="closeVariants()">
        <section class="modal-panel wide" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="variants-title" (dialogClose)="closeVariants()" (click)="$event.stopPropagation()">
          <div class="modal-header"><div><span>{{ product.name }}</span><h2 id="variants-title">Variações e preços</h2></div><button type="button" class="icon-button" aria-label="Fechar" (click)="closeVariants()"><i class="pi pi-times"></i></button></div>
          <div class="variant-manager-layout">
            <div class="variant-manager-list">
              @for (variant of product.variants; track variant.id) {
                <article class="variant-manager-row">
                  <div><strong>{{ variant.name }}</strong><small>{{ variant.sku || 'Sem SKU' }}</small></div><b>{{ currency(variant.price) }}</b><app-status-badge [label]="variant.available ? 'Disponível' : 'Indisponível'" [tone]="variant.available ? 'success' : 'warning'" /><small>{{ variant.stockLinkActive ? (variant.stockItemName + ' · ' + variant.quantityPerSale) : 'Sem estoque automático' }}</small>
                  <div class="row-actions"><button type="button" class="icon-action-button" title="Editar" (click)="editVariant(variant)"><i class="pi pi-pencil"></i></button><button type="button" class="icon-action-button" title="Estoque" (click)="openStockLink(variant)"><i class="pi pi-link"></i></button><button type="button" class="icon-action-button" [title]="variant.available ? 'Indisponibilizar' : 'Disponibilizar'" (click)="toggleVariantAvailable(variant)"><i [class]="variant.available ? 'pi pi-eye-slash' : 'pi pi-eye'"></i></button><button type="button" class="icon-action-button" [class.danger]="variant.active" [title]="variant.active ? 'Desativar' : 'Ativar'" (click)="toggleVariantActive(variant)"><i [class]="variant.active ? 'pi pi-ban' : 'pi pi-check'"></i></button></div>
                </article>
              } @empty { <app-empty-state icon="pi pi-list" title="Cadastro incompleto" description="Adicione pelo menos uma variação vendável." /> }
            </div>
            <form class="variant-editor" (ngSubmit)="saveVariant()">
              <h3>{{ variantEditing() ? 'Editar variação' : 'Nova variação' }}</h3>
              <label class="field"><span>Nome</span><input name="variantName" [(ngModel)]="variantForm.name" required /></label><label class="field"><span>Preço</span><input name="variantPrice" type="number" min="0" step="0.01" [(ngModel)]="variantForm.price" required /></label><label class="field"><span>SKU opcional</span><input name="variantSku" [(ngModel)]="variantForm.sku" /></label><label class="field"><span>Ordem</span><input name="variantOrder" type="number" min="0" [(ngModel)]="variantForm.displayOrder" /></label><label class="toggle-field"><input type="checkbox" name="variantActive" [(ngModel)]="variantForm.active" /><span>Ativa</span></label><label class="toggle-field"><input type="checkbox" name="variantAvailable" [(ngModel)]="variantForm.available" /><span>Disponível</span></label>
              <div class="split-actions"><button type="button" class="ghost-button" (click)="resetVariantForm()">Limpar</button><button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-save"></i>Salvar variação</button></div>
            </form>
          </div>
        </section>
      </div>
    }

    @if (choicesOpen() && selectedProduct(); as product) {
      <div class="modal-backdrop" (click)="closeChoices()">
        <section class="modal-panel wide" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="choices-title" (dialogClose)="closeChoices()" (click)="$event.stopPropagation()">
          <div class="modal-header"><div><span>{{ product.name }}</span><h2 id="choices-title">Grupos de escolhas</h2></div><button type="button" class="icon-button" aria-label="Fechar" (click)="closeChoices()"><i class="pi pi-times"></i></button></div>
          <div class="choice-manager-layout">
            <div class="choice-manager-list">
              @for (group of product.optionGroups; track group.id) {
                <article class="managed-choice-group">
                  <div class="managed-choice-head"><div><strong>{{ group.name }}</strong><small>{{ group.required ? 'Obrigatório' : 'Opcional' }} · {{ group.minimumSelections }} a {{ group.maximumSelections }}</small></div><div class="row-actions"><button type="button" class="icon-action-button" title="Editar grupo" (click)="editChoiceGroup(group)"><i class="pi pi-pencil"></i></button><button type="button" class="icon-action-button" [title]="group.active ? 'Desativar grupo' : 'Ativar grupo'" (click)="toggleChoiceGroup(group)"><i [class]="group.active ? 'pi pi-ban' : 'pi pi-check'"></i></button></div></div>
                  @for (option of group.options; track option.id) { <div class="managed-option"><span>{{ option.name }} <small>{{ option.additionalPrice ? '+ ' + currency(option.additionalPrice) : 'sem adicional' }}</small></span><div class="row-actions"><button type="button" class="icon-action-button" title="Editar opção" (click)="editChoiceOption(group, option)"><i class="pi pi-pencil"></i></button><button type="button" class="icon-action-button" [title]="option.active ? 'Desativar opção' : 'Ativar opção'" (click)="toggleChoiceOption(group, option)"><i [class]="option.active ? 'pi pi-ban' : 'pi pi-check'"></i></button></div></div> }
                  <button type="button" class="text-action" (click)="newChoiceOption(group)"><i class="pi pi-plus"></i>Adicionar opção</button>
                </article>
              } @empty { <app-empty-state icon="pi pi-check-square" title="Sem escolhas" description="Este produto ainda não possui grupos de escolhas." /> }
            </div>
            <form class="variant-editor" (ngSubmit)="saveChoiceEditor()">
              <h3>{{ optionEditorGroup() ? (choiceOptionEditing() ? 'Editar opção' : 'Nova opção') : (choiceGroupEditing() ? 'Editar grupo' : 'Novo grupo') }}</h3>
              @if (optionEditorGroup()) {
                <label class="field"><span>Nome da opção</span><input name="managedOptionName" [(ngModel)]="choiceOptionForm.name" required /></label><label class="field"><span>Preço adicional</span><input name="managedOptionPrice" type="number" min="0" step="0.01" [(ngModel)]="choiceOptionForm.additionalPrice" /></label><label class="field"><span>Ordem</span><input name="managedOptionOrder" type="number" min="0" [(ngModel)]="choiceOptionForm.displayOrder" /></label><label class="toggle-field"><input type="checkbox" name="managedOptionActive" [(ngModel)]="choiceOptionForm.active" /><span>Ativa</span></label>
              } @else {
                <label class="field"><span>Nome do grupo</span><input name="managedGroupName" [(ngModel)]="choiceGroupForm.name" required /></label><label class="toggle-field"><input type="checkbox" name="managedGroupRequired" [(ngModel)]="choiceGroupForm.required" (ngModelChange)="syncRequiredGroup(choiceGroupForm)" /><span>Obrigatório</span></label><div class="form-grid"><label class="field"><span>Mínimo</span><input name="managedGroupMin" type="number" min="0" [(ngModel)]="choiceGroupForm.minimumSelections" /></label><label class="field"><span>Máximo</span><input name="managedGroupMax" type="number" min="1" [(ngModel)]="choiceGroupForm.maximumSelections" /></label></div><label class="field"><span>Ordem</span><input name="managedGroupOrder" type="number" min="0" [(ngModel)]="choiceGroupForm.displayOrder" /></label><label class="toggle-field"><input type="checkbox" name="managedGroupActive" [(ngModel)]="choiceGroupForm.active" /><span>Ativo</span></label>
              }
              <div class="split-actions"><button type="button" class="ghost-button" (click)="resetChoiceEditor()">Novo grupo</button><button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-save"></i>Salvar</button></div>
            </form>
          </div>
        </section>
      </div>
    }

    @if (stockLinkOpen() && stockVariant(); as variant) {
      <div class="modal-backdrop nested-modal" (click)="closeStockLink()">
        <form class="modal-panel compact" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="stock-link-title" [dialogCloseDisabled]="saving()" (dialogClose)="closeStockLink()" (click)="$event.stopPropagation()" (ngSubmit)="saveStockLink()">
          <div class="modal-header"><div><span>{{ variant.productName }} · {{ variant.name }}</span><h2 id="stock-link-title">Vínculo de estoque</h2></div><button type="button" class="icon-button" aria-label="Fechar" (click)="closeStockLink()"><i class="pi pi-times"></i></button></div>
          <label class="field"><span>Item com baixa automática</span><select name="stockItem" [(ngModel)]="stockLinkForm.stockItemId" required><option [ngValue]="0" disabled>Selecione</option>@for (item of automaticStockItems; track item.id) { <option [ngValue]="item.id">{{ item.name }} · {{ stockValue(item) }}</option> }</select></label><label class="field"><span>Quantidade por venda</span><input name="quantityPerSale" type="number" min="0.001" step="0.001" [(ngModel)]="stockLinkForm.quantityPerSale" required /></label>
          <div class="modal-actions">@if (variant.stockLinkActive) { <button type="button" class="danger-button" (click)="removeStockLink()">Remover vínculo</button> }<button type="button" class="ghost-button" (click)="closeStockLink()">Cancelar</button><button type="submit" class="primary-button" [disabled]="saving()"><i class="pi pi-link"></i>Salvar vínculo</button></div>
        </form>
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
  readonly editOpen = signal(false);
  readonly editingProduct = signal<Product | null>(null);
  readonly variantsOpen = signal(false);
  readonly choicesOpen = signal(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly variantEditing = signal<ProductVariant | null>(null);
  readonly choiceGroupEditing = signal<ProductOptionGroup | null>(null);
  readonly choiceOptionEditing = signal<ProductOption | null>(null);
  readonly optionEditorGroup = signal<ProductOptionGroup | null>(null);
  readonly stockLinkOpen = signal(false);
  readonly stockVariant = signal<ProductVariant | null>(null);
  readonly actionMenuOpen = signal<number | null>(null);
  readonly actionMenuPosition = signal<OverlayPosition>({ left: 0, top: 0, maxHeight: 320, placement: 'bottom' });

  private actionMenuTrigger: HTMLElement | null = null;
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
    this.editingProduct.set(product);
    this.editForm = { categoryId: product.categoryId, name: product.name, description: product.description, preparationFlow: product.preparationFlow, active: product.active, available: product.available, displayOrder: product.displayOrder, imageUrl: product.imageUrl };
    this.editOpen.set(true);
  }
  saveEdit(): void {
    const product = this.editingProduct();
    if (!product || !this.editForm.name.trim() || !this.editForm.categoryId) { this.feedback.error('Preencha nome e categoria.'); return; }
    this.saving.set(true);
    this.api.update(product.id, { ...this.editForm, name: this.editForm.name.trim(), description: this.editForm.description?.trim() || null }).pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { this.feedback.success('Produto atualizado.'); this.editOpen.set(false); this.load(); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }

  openVariants(product: Product): void { this.closeActionMenu(); this.selectedProduct.set(product); this.resetVariantForm(); this.variantsOpen.set(true); }
  closeVariants(): void { if (!this.stockLinkOpen()) this.variantsOpen.set(false); }
  editVariant(variant: ProductVariant): void { this.variantEditing.set(variant); this.variantForm = { name: variant.name, sku: variant.sku, price: variant.price, active: variant.active, available: variant.available, displayOrder: variant.displayOrder }; }
  resetVariantForm(): void { this.variantEditing.set(null); this.variantForm = this.emptyVariant(''); }
  saveVariant(): void {
    const product = this.selectedProduct();
    if (!product || !this.variantForm.name.trim() || this.variantForm.price < 0) { this.feedback.error('Preencha nome e preço válidos.'); return; }
    const request = { ...this.variantForm, name: this.variantForm.name.trim(), sku: this.variantForm.sku?.trim() || null };
    const current = this.variantEditing();
    this.saving.set(true);
    const operation = current ? this.api.updateVariant(product.id, current.id, request) : this.api.createVariant(product.id, request);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { this.feedback.success('Variação salva.'); this.resetVariantForm(); this.reloadProduct(product.id); }, error: (error) => this.feedback.error(apiErrorMessage(error)) });
  }
  toggleVariantActive(variant: ProductVariant): void { const product = this.selectedProduct(); if (!product) return; (variant.active ? this.api.deactivateVariant(product.id, variant.id) : this.api.activateVariant(product.id, variant.id)).subscribe({ next: () => this.reloadProduct(product.id), error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  toggleVariantAvailable(variant: ProductVariant): void { const product = this.selectedProduct(); if (!product) return; this.api.setVariantAvailable(product.id, variant.id, !variant.available).subscribe({ next: () => this.reloadProduct(product.id), error: (error) => this.feedback.error(apiErrorMessage(error)) }); }

  openChoices(product: Product): void { this.closeActionMenu(); this.selectedProduct.set(product); this.resetChoiceEditor(); this.choicesOpen.set(true); }
  closeChoices(): void { this.choicesOpen.set(false); }
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

  openStockLink(variant: ProductVariant): void { this.stockVariant.set(variant); this.stockLinkForm = { stockItemId: variant.stockItemId ?? 0, quantityPerSale: variant.quantityPerSale ?? 1 }; this.stockLinkOpen.set(true); }
  closeStockLink(): void { if (!this.saving()) this.stockLinkOpen.set(false); }
  saveStockLink(): void { const variant = this.stockVariant(); if (!variant || !this.stockLinkForm.stockItemId || this.stockLinkForm.quantityPerSale <= 0) { this.feedback.error('Selecione o item e informe a quantidade.'); return; } this.saving.set(true); const operation = variant.stockLinkActive ? this.stockLinkApi.update(variant.id, this.stockLinkForm) : this.stockLinkApi.create(variant.id, this.stockLinkForm); operation.pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { this.feedback.success('Vínculo salvo.'); this.stockLinkOpen.set(false); this.reloadProduct(variant.productId); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  removeStockLink(): void { const variant = this.stockVariant(); if (!variant) return; this.stockLinkApi.deactivate(variant.id).subscribe({ next: () => { this.feedback.success('Vínculo removido.'); this.stockLinkOpen.set(false); this.reloadProduct(variant.productId); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }

  toggleAvailable(product: Product): void { this.closeActionMenu(); this.api.setAvailable(product.id, !product.available).subscribe({ next: () => { this.feedback.success(product.available ? 'Produto indisponibilizado.' : 'Produto disponibilizado.'); this.load(); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }
  toggleActive(product: Product): void { this.closeActionMenu(); (product.active ? this.api.deactivate(product.id) : this.api.activate(product.id)).subscribe({ next: () => { this.feedback.success(product.active ? 'Produto desativado.' : 'Produto ativado.'); this.load(); }, error: (error) => this.feedback.error(apiErrorMessage(error)) }); }

  flowLabel(flow: PreparationFlow): string { return preparationFlowLabel(flow); }
  variantSummary(product: Product): string { return product.variantCount === 1 ? '1 variação' : `${product.variantCount} variações`; }
  priceSummary(product: Product): string { return priceRangeSummary(product.minimumVariantPrice, product.maximumVariantPrice, (value) => this.currency(value)); }
  currency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
  stockValue(item: Ingredient): string { return formatStockValue(item.currentStock, item.unit); }

  @HostListener('document:click') onDocumentClick(): void { this.closeActionMenu(); }
  @HostListener('document:keydown', ['$event']) onDocumentKeydown(event: KeyboardEvent): void { if (event.key === 'Escape') this.closeActionMenu(); }
  @HostListener('window:resize') onResize(): void { this.repositionActionMenu(); }
  @HostListener('window:scroll') onScroll(): void { this.repositionActionMenu(); }
  toggleActionMenu(productId: number, event: MouseEvent): void { event.stopPropagation(); if (this.actionMenuOpen() === productId) { this.closeActionMenu(); return; } this.actionMenuTrigger = event.currentTarget as HTMLElement; this.actionMenuPosition.set({ left: -9999, top: -9999, maxHeight: 9999, placement: 'bottom' }); this.actionMenuOpen.set(productId); requestAnimationFrame(() => { this.repositionActionMenu(); this.document.querySelector<HTMLButtonElement>(`[data-product-menu-id="${productId}"] button`)?.focus(); }); }
  closeActionMenu(): void { this.actionMenuOpen.set(null); this.actionMenuTrigger = null; }
  actionMenuProduct(): Product | null { const id = this.actionMenuOpen(); return id == null ? null : this.products().find((product) => product.id === id) ?? null; }
  onActionMenuKeydown(event: KeyboardEvent): void { const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape']; if (!keys.includes(event.key)) return; event.preventDefault(); if (event.key === 'Escape') { this.closeActionMenu(); return; } const menu = (event.target as HTMLElement).closest<HTMLElement>('.product-action-menu'); const items = Array.from(menu?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []); if (!items.length) return; const current = Math.max(0, items.indexOf(event.target as HTMLButtonElement)); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length; items[next]?.focus(); }

  private repositionActionMenu(): void { const id = this.actionMenuOpen(); const trigger = this.actionMenuTrigger; const view = this.document.defaultView; if (id == null || !trigger || !view) return; const menu = this.document.querySelector<HTMLElement>(`[data-product-menu-id="${id}"]`); if (!menu) return; this.actionMenuPosition.set(calculateOverlayPosition(trigger.getBoundingClientRect(), menu.getBoundingClientRect(), view.innerWidth, view.innerHeight)); }
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
