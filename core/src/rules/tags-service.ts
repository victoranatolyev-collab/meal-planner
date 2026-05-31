import { prisma } from '../db.js';

/**
 * Все известные теги для UI-автокомплита (scr-edit-rules). Объединяет три источника:
 *  - tag_dictionary (канонический справочник),
 *  - ingredients.tags[] (теги ингредиентов),
 *  - recipe_tags.tag_name (теги рецептов / meal-теги).
 * Дедуп + сортировка по алфавиту. Loose coupling: ни один источник не обязателен.
 */
export async function listTags(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT DISTINCT name FROM (
      SELECT name FROM tag_dictionary
      UNION
      SELECT unnest(tags) AS name FROM ingredients WHERE tags IS NOT NULL
      UNION
      SELECT tag_name AS name FROM recipe_tags
    ) s
    WHERE name IS NOT NULL AND name <> ''
    ORDER BY name
  `;
  return rows.map((r) => r.name);
}
