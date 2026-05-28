import { prisma } from '../db.js';
import type { NutritionTargetUpsert } from './schemas.js';

/**
 * Целевые КБЖУ + бюджет пользователя (1:1). Часть scr-edit-rules / ent-nutrition-rules.
 * Decimal-поля принимают number — Prisma конвертирует в Decimal на входе.
 */

export async function getNutritionTarget(userId: string) {
  return prisma.nutritionTarget.findUnique({ where: { userId } });
}

export async function upsertNutritionTarget(input: NutritionTargetUpsert) {
  const { userId, ...fields } = input;
  return prisma.nutritionTarget.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: fields,
  });
}
