import { PrismaClient } from '@prisma/client';

/** Разовая установка реального базового запаса пользователя (инвентаризация с голоса). */
const prisma = new PrismaClient();
const USER_ID = 'dec00000-0000-0000-0000-000000000001';

// [externalCode, qtyG, человекочитаемо]
const STOCK: Array<[string, number, string]> = [
  ['local:chicken_petelinka_cubes', 200, 'готовая грудка (батч)'],
  ['plu:3191298', 700, 'сырая грудка на кости'],
  ['local:liver_severnaya', 325, 'печень (полпачки)'],
  ['plu:43347', 500, 'перец болгарский'],
  ['local:onion_loose', 1000, 'лук'],
  ['plu:14374', 1000, 'морковь'],
  ['plu:4406329', 180, 'сливочное масло'],
  ['plu:3294954', 100, 'лимон (1 шт)'],
  ['plu:4345356', 400, 'рис (полпачки)'],
  ['plu:4206940', 180, 'творог 5% 180г'],
];

async function main() {
  // Чистим старый демо-запас.
  const del = await prisma.stockItem.deleteMany({ where: { userId: USER_ID } });
  console.log(`удалено старых позиций запаса: ${del.count}`);

  let ok = 0;
  for (const [code, qtyG, label] of STOCK) {
    const ing = await prisma.ingredient.findFirst({ where: { externalCode: code }, select: { id: true, name: true } });
    if (!ing) {
      console.warn(`  ⚠ не найден ингредиент ${code} (${label}) — пропуск`);
      continue;
    }
    await prisma.stockItem.upsert({
      where: { uniq_user_ingredient: { userId: USER_ID, ingredientId: ing.id } },
      create: { userId: USER_ID, ingredientId: ing.id, qtyG },
      update: { qtyG },
    });
    ok += 1;
    console.log(`  ✅ ${label}: ${ing.name} = ${qtyG} г`);
  }
  console.log(`\nзаписано позиций запаса: ${ok}/${STOCK.length}`);
}

main()
  .catch((e) => {
    console.error('set-stock failed:', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
