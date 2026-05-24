import { z } from 'zod';
import { IngredientSource } from '@prisma/client';

/**
 * Zod-схемы для слоя ingredients.
 * Используется и в route handler (для request validation), и в tool-definitions для LLM-агента
 * (см. ARCHITECTURE.md §9.2).
 */

/**
 * Query params для `GET /api/ingredients`.
 * Coerce — параметры приходят как строки из querystring, конвертируем в нужные типы.
 */
export const listIngredientsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  source: z.nativeEnum(IngredientSource).optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export type ListIngredientsQuery = z.infer<typeof listIngredientsQuerySchema>;
