import { z } from 'zod';

/** Запрос на сборку корзины (scr-assemble-cart). */
export const assembleCartRequestSchema = z.object({
  userId: z.string().uuid(),
  weekIso: z.string().regex(/^\d{4}-W\d{2}$/),
});
export type AssembleCartRequest = z.infer<typeof assembleCartRequestSchema>;
