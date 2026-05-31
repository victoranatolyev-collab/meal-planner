import { apiGet, apiPost, apiPatch, apiDelete } from './client';

export interface RecipeIngredientDto {
  qtyG: number;
  freshAddon: boolean;
  ingredient: {
    id: string;
    name: string;
    kcal100g: string | null;
    protein100g: string | null;
    fat100g: string | null;
    carbs100g: string | null;
  };
}

export interface RecipeListItemDto {
  id: string;
  name: string;
  instructions: string;
  source: string;
  isApproved: boolean;
  isNormalized: boolean;
  totalKcal: string | null;
  totalProteinG: string | null;
  totalFatG: string | null;
  totalCarbsG: string | null;
  tags: { tagName: string }[];
  ingredients: RecipeIngredientDto[];
}

/** GET /api/recipes — пул блюд планировщика (approved+normalized). */
export const fetchRecipes = (userId: string) =>
  apiGet<{ items: RecipeListItemDto[]; total: number }>(
    `/recipes?userId=${encodeURIComponent(userId)}`,
  );

export interface RecipeIngredientInput {
  ingredientId: string;
  qtyG: number;
}

export interface RecipeInput {
  name: string;
  instructions: string;
  tags: string[];
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  ingredients: RecipeIngredientInput[];
  isApproved: boolean;
  isNormalized: boolean;
}

export const createRecipe = (userId: string, input: RecipeInput) =>
  apiPost<{ id: string }>('/recipes', { userId, ...input });

export const updateRecipe = (id: string, input: RecipeInput) =>
  apiPatch<{ id: string }>(`/recipes/${id}`, input);

export const deleteRecipe = (id: string) => apiDelete(`/recipes/${id}`);
