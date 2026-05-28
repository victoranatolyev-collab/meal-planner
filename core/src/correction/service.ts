import pino from 'pino';
import { prisma } from '../db.js';
import { computeCorrection } from './compute.js';
import type { DayCorrection, Macros } from './types.js';

const logger = pino({ name: 'plan:correct' });

export interface CorrectPlanResult {
  weekIso: string;
  dailyTarget: Macros;
  days: DayCorrection[];
}

/**
 * scr-correct-plan (DB-wrapper): сверка факт vs план за неделю.
 * dailyTarget = snapshot целей из week_plan. actual = сумма макросов дневника по дате.
 * Возвращает остаток (target − actual) по каждому дню плана. Бросает, если плана нет.
 */
export async function correctPlan(userId: string, weekIso: string): Promise<CorrectPlanResult> {
  const plan = await prisma.weekPlan.findUnique({
    where: { uniq_user_week: { userId, weekIso } },
    include: { days: { select: { date: true } } },
  });
  if (!plan) throw new Error(`Нет плана ${weekIso} для ${userId}`);

  const dailyTarget: Macros = {
    kcal: Number(plan.kcalTarget),
    proteinG: Number(plan.proteinGTarget),
    fatG: Number(plan.fatGTarget),
    carbsG: Number(plan.carbsGTarget),
  };
  const dates = plan.days.map((d) => d.date.toISOString().slice(0, 10)).sort();

  const endExclusive = new Date(plan.endDate);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const entries = await prisma.foodDiaryEntry.findMany({
    where: { userId, eatenAt: { gte: plan.startDate, lt: endExclusive } },
    select: { eatenAt: true, kcal: true, proteinG: true, fatG: true, carbsG: true },
  });

  const actualByDate = new Map<string, Macros>();
  for (const e of entries) {
    const date = e.eatenAt.toISOString().slice(0, 10);
    const prev = actualByDate.get(date) ?? { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 };
    prev.kcal += Number(e.kcal ?? 0);
    prev.proteinG += Number(e.proteinG ?? 0);
    prev.fatG += Number(e.fatG ?? 0);
    prev.carbsG += Number(e.carbsG ?? 0);
    actualByDate.set(date, prev);
  }

  const days = computeCorrection({ dailyTarget, dates, actualByDate });
  logger.info({ userId, weekIso, days: days.length }, 'plan correction computed');
  return { weekIso, dailyTarget, days };
}
