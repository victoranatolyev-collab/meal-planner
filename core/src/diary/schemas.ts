import { z } from 'zod';

/**
 * Запись факт-приёма (scr-write-diary). Либо recipeId (известный рецепт → макросы
 * derive из totals × portionFactor), либо customName (ad-hoc, макросы вручную).
 */
export const diaryEntryCreateSchema = z
  .object({
    userId: z.string().uuid(),
    eatenAt: z.coerce.date().optional(),
    // Recipe.id в Prisma — обычная String (@default(uuid()), но сид кладёт демо-id вида
    // `dec0re01-…`, не валидный UUID). Не навязываем формат — как в plan/schemas.ts
    // (recipeId: z.string()). Существование рецепта проверяет сервис (writeDiaryEntry).
    recipeId: z.string().min(1).optional(),
    customName: z.string().min(1).max(200).optional(),
    portionFactor: z.number().positive().max(20).default(1),
    kcal: z.number().nonnegative().max(20000).optional(),
    proteinG: z.number().nonnegative().max(2000).optional(),
    fatG: z.number().nonnegative().max(2000).optional(),
    carbsG: z.number().nonnegative().max(2000).optional(),
    mealName: z.string().max(100).optional(),
    note: z.string().max(1000).optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.recipeId && !val.customName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recipeId'],
        message: 'Нужен recipeId (известный рецепт) или customName (ad-hoc)',
      });
    }
  });
export type DiaryEntryCreate = z.infer<typeof diaryEntryCreateSchema>;
