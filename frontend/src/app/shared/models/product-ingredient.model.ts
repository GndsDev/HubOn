import { UnitOfMeasure } from './ingredient.model';

export interface ProductIngredientRequest {
  ingredientId: number;
  quantity: number;
}

export interface ProductIngredient {
  id: number;
  ingredientId: number;
  ingredientName: string;
  unit: UnitOfMeasure;
  quantity: number;
}

export interface ProductRecipe {
  productId: number;
  productName: string;
  ingredients: ProductIngredient[];
}
