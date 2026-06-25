import { PrismaClient } from '@prisma/client';
import { generateWeekPlan } from '../src/index.js';
import { isIron, isBeef, isLiver, isFish } from '../src/plan/rules.js';

/**
 * Проверка блока правил: генерирует план недели через greedy и печатает отчёт —
 * КБЖУ по дням/приёмам, выполнение недельных квот (железо/говядина/печень/рыба), повторы.
 * Запуск: PLAN_ENGINE=greedy DATABASE_URL=... npx tsx prisma/plan-report.ts
 */
const prisma = new PrismaClient();
const USER_ID = 'dec00000-0000-0000-0000-000000000001';
const WEEK = '2026-W23';
const START = '2026-06-01'; // понедельник

const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const r0 = (v: number) => Math.round(v);

async function main() {
  const res = await generateWeekPlan({ userId: USER_ID, weekIso: WEEK, startDate: START, dayCount: 7 });
  console.log(`сгенерировано: дней ${res.days}, приёмов ${res.meals}, позиций ${res.items}, замен ${res.substitutions}\n`);

  const plan = await prisma.weekPlan.findUnique({
    where: { uniq_user_week: { userId: USER_ID, weekIso: WEEK } },
    include: {
      days: {
        orderBy: { date: 'asc' },
        include: {
          meals: {
            orderBy: { sortOrder: 'asc' },
            include: { items: { include: { recipe: { select: { name: true, totalKcal: true, totalProteinG: true, totalFatG: true, totalCarbsG: true } } } } },
          },
        },
      },
    },
  });
  if (!plan) throw new Error('план не найден');

  console.log(`цель/день: ${r0(Number(plan.kcalTarget))} ккал · Б${r0(Number(plan.proteinGTarget))} Ж${r0(Number(plan.fatGTarget))} У${r0(Number(plan.carbsGTarget))}\n`);

  const usage = new Map<string, number>();
  const q = { iron: 0, beef: 0, liver: 0, fish: 0 };

  for (const d of plan.days) {
    const wd = WD[new Date(d.date).getUTCDay()]!;
    let dk = 0, dp = 0, df = 0, dc = 0;
    const lines: string[] = [];
    for (const m of d.meals) {
      for (const it of m.items) {
        const pf = Number(it.portionFactor);
        const rc = it.recipe;
        const cat = { name: rc.name, mealTags: [] as string[] };
        const kcal = Number(rc.totalKcal ?? 0) * pf;
        dk += kcal;
        dp += Number(rc.totalProteinG ?? 0) * pf;
        df += Number(rc.totalFatG ?? 0) * pf;
        dc += Number(rc.totalCarbsG ?? 0) * pf;
        usage.set(rc.name, (usage.get(rc.name) ?? 0) + 1);
        if (m.name !== 'Завтрак' && m.name !== 'Перекус') {
          if (isBeef(cat)) q.beef += 1;
          if (isLiver(cat)) q.liver += 1;
          if (isFish(cat)) q.fish += 1;
          if (isIron(cat)) q.iron += 1;
        }
        const flags = [isIron(cat) ? '🩸' : '', isFish(cat) ? '🐟' : ''].join('');
        lines.push(`    ${m.name.padEnd(8)} ×${pf.toFixed(2)} ${r0(kcal)}k  ${rc.name.slice(0, 40)} ${flags}`);
      }
    }
    console.log(`${wd} ${d.date}  ИТОГ ${r0(dk)} ккал · Б${r0(dp)} Ж${r0(df)} У${r0(dc)}`);
    lines.forEach((l) => console.log(l));
  }

  console.log(`\n📊 недельные квоты: железо ${q.iron} (цель ≥3) · говядина ${q.beef} (≥1) · печень ${q.liver} (≥1) · рыба ${q.fish} (≥1)`);
  const repeats = [...usage.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  console.log(`уникальных блюд: ${usage.size} из ${res.items} позиций. Повторы (>1):`);
  repeats.forEach(([n, c]) => console.log(`   ×${c}  ${n}`));
}

main()
  .catch((e) => {
    console.error('plan-report failed:', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
