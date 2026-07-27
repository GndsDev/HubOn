import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { IngredientApiService } from '../../core/services/ingredient-api.service';
import { InventoryMovementApiService } from '../../core/services/inventory-movement-api.service';
import { Ingredient } from '../../shared/models/ingredient.model';
import { StockPageComponent } from './stock-page.component';

describe('StockPageComponent', () => {
  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [StockPageComponent],
      providers: [
        provideRouter([]),
        { provide: IngredientApiService, useValue: { getAll: () => of([]) } },
        { provide: InventoryMovementApiService, useValue: { getRecent: () => of([]) } },
        { provide: AuthService, useValue: { hasAnyRole: () => true } },
        { provide: FeedbackService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(StockPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('closes the actions menu on outside click and Escape', async () => {
    const component = (await createComponent()).componentInstance;
    component.actionMenuOpen.set(1);
    component.onDocumentClick();
    expect(component.actionMenuOpen()).toBeNull();

    component.actionMenuOpen.set(1);
    component.onDocumentKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.actionMenuOpen()).toBeNull();
  });

  it('calculates the predicted manual exit balance and blocks negative stock', async () => {
    const component = (await createComponent()).componentInstance;
    const ingredient: Ingredient = {
      id: 1,
      name: 'Carne',
      description: null,
      unit: 'KG',
      controlMode: 'MANUAL',
      currentStock: 10,
      minimumStock: 2,
      idealStock: 12,
      active: true,
      stockStatus: 'NORMAL',
      createdAt: '',
      updatedAt: '',
    };
    component.movementIngredient.set(ingredient);
    component.movementType.set('EXIT');
    component.movementForm.quantity = 3;
    expect(component.predictedExitBalance()).toBe(7);
    expect(component.exitOverStock()).toBe(false);

    component.movementForm.quantity = 11;
    expect(component.predictedExitBalance()).toBe(-1);
    expect(component.exitOverStock()).toBe(true);
  });

  it('renders the six indicators in the dedicated balanced grid', async () => {
    const fixture = await createComponent();
    const grid = fixture.nativeElement.querySelector('.stock-stats-grid') as HTMLElement | null;

    expect(grid).not.toBeNull();
    expect(grid?.querySelectorAll('.stat-card')).toHaveLength(6);
  });
});
