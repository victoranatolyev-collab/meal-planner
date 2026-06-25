import { describe, it, expect } from 'vitest';
import { composePlanGreedy, type GreedyRecipe } from './greedy.js';
import { distributionFor } from './rules.js';

const targets = { kcalPerDay: 2455, proteinGPerDay: 161, fatGPerDay: 90, carbsGPerDay: 250 };

function recipe(id: string, name: string, kcal: number, p: number, tags: string[] = []): GreedyRecipe {
  return { id, name, kcal, proteinG: p, fatG: kcal * 0.3 / 9, carbsG: kcal * 0.4 / 4, mealTags: tags };
}

// Пул с явными источниками квот + достаточным разнообразием, чтобы не упираться в повторы.
const pool: GreedyRecipe[] = [
  recipe('beef', 'Говядина тушёная с овощами', 600, 45),
  recipe('liver', 'Печень куриная с луком', 580, 44),
  recipe('fish1', 'Лосось запечённый с овощами', 620, 42, ['рыба']),
  recipe('fish2', 'Скумбрия на гриле', 640, 40, ['рыба']),
  recipe('ch1', 'Куриная грудка с рисом', 610, 46, ['обед', 'lunch']),
  recipe('ch2', 'Куриные котлеты с картофелем', 620, 44, ['ужин', 'dinner']),
  recipe('ch3', 'Курица терияки с рисом', 600, 43, ['обед']),
  recipe('ch4', 'Куриный салат с киноа', 590, 41, ['ужин']),
  recipe('ch5', 'Индейка с овощами', 605, 45, ['обед']),
  recipe('ch6', 'Курица карри с рисом', 615, 42, ['ужин']),
  recipe('bf1', 'Овсяная каша с ягодами', 880, 30, ['завтрак', 'breakfast']),
  recipe('bf2', 'Омлет с овощами и сыром', 870, 40, ['завтрак']),
  recipe('bf3', 'Творожная запеканка', 860, 45, ['завтрак']),
  recipe('bf4', 'Сырники с мёдом', 890, 38, ['завтрак']),
  recipe('bf5', 'Гранола с йогуртом', 875, 32, ['breakfast']),
  recipe('bf6', 'Яичница с тостом', 850, 35, ['завтрак']),
  recipe('bf7', 'Каша пшённая с тыквой', 880, 28, ['завтрак']),
  recipe('d1', 'Творог с бананом', 360, 25, ['десерт', 'dessert']),
  recipe('d2', 'Протеиновое мороженое', 350, 22, ['десерт']),
  recipe('d3', 'Йогурт с ягодами', 340, 20, ['dessert']),
  recipe('d4', 'Чизкейк протеиновый', 380, 24, ['десерт']),
];

const week = Array.from({ length: 7 }, (_, i) => ({ date: `2026-06-0${i + 1}` })); // Пн..Вс

describe('distributionFor', () => {
  it('завтрак — крупнейший приём, сумма ≈ дневной цели', () => {
    const slots = distributionFor(false, targets);
    const [breakfast, lunch, dinner, dessert] = slots;
    expect(breakfast!.kcal).toBeGreaterThan(lunch!.kcal);
    expect(breakfast!.kcal).toBeGreaterThan(dinner!.kcal);
    expect(breakfast!.kcal).toBeGreaterThan(dessert!.kcal);
    const sum = slots.reduce((a, s) => a + s.kcal, 0);
    expect(Math.abs(sum - targets.kcalPerDay)).toBeLessThan(10);
  });

  it('тренировочный день: обед post-workout — углеводный и низкожировой', () => {
    const rest = distributionFor(false, targets)[1]!;
    const train = distributionFor(true, targets)[1]!;
    expect(train.slotTags).toContain('post_workout');
    expect(train.carbsG).toBeGreaterThan(rest.carbsG);
    expect(train.fatG).toBeLessThan(rest.fatG);
  });
});

describe('composePlanGreedy', () => {
  const { days } = composePlanGreedy(targets, week, pool, { quotas: { iron: 3, beef: 1, liver: 1, fish: 1 } });

  it('4 приёма в день, 7 дней', () => {
    expect(days).toHaveLength(7);
    for (const d of days) expect(d.meals).toHaveLength(4);
  });

  it('выполняет недельные квоты (железо≥3, говядина≥1, печень≥1, рыба≥1)', () => {
    const mains = days.flatMap((d) => d.meals.filter((m) => m.name === 'Обед' || m.name === 'Ужин'));
    const ids = mains.map((m) => m.items[0]!.recipeId);
    const beef = ids.filter((id) => id === 'beef').length;
    const liver = ids.filter((id) => id === 'liver').length;
    const fish = ids.filter((id) => id.startsWith('fish')).length;
    expect(beef).toBeGreaterThanOrEqual(1);
    expect(liver).toBeGreaterThanOrEqual(1);
    expect(fish).toBeGreaterThanOrEqual(1);
    expect(beef + liver + fish).toBeGreaterThanOrEqual(3); // железо
  });

  it('десерты только в слоте Перекус', () => {
    for (const d of days) {
      for (const m of d.meals) {
        const isDessertId = m.items[0]!.recipeId.startsWith('d');
        if (m.name !== 'Перекус') expect(isDessertId).toBe(false);
      }
    }
  });

  it('ни одно основное блюдо не повторяется больше 2 раз', () => {
    const mains = days.flatMap((d) =>
      d.meals.filter((m) => m.name !== 'Перекус').map((m) => m.items[0]!.recipeId),
    );
    const counts = new Map<string, number>();
    for (const id of mains) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const c of counts.values()) expect(c).toBeLessThanOrEqual(2);
  });

  it('калорийность дня близка к цели (±12%)', () => {
    const byId = new Map(pool.map((r) => [r.id, r]));
    for (const d of days) {
      const kcal = d.meals.reduce((sum, m) => {
        const r = byId.get(m.items[0]!.recipeId)!;
        return sum + r.kcal * m.items[0]!.portionFactor;
      }, 0);
      expect(Math.abs(kcal - targets.kcalPerDay) / targets.kcalPerDay).toBeLessThan(0.12);
    }
  });

  it('суточный белок держится близко к цели (макро-fit, ±25%)', () => {
    const byId = new Map(pool.map((r) => [r.id, r]));
    for (const d of days) {
      const protein = d.meals.reduce((sum, m) => {
        const r = byId.get(m.items[0]!.recipeId)!;
        return sum + r.proteinG * m.items[0]!.portionFactor;
      }, 0);
      expect(Math.abs(protein - targets.proteinGPerDay) / targets.proteinGPerDay).toBeLessThan(0.25);
    }
  });
});
