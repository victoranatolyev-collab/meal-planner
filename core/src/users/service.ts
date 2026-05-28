import { prisma } from '../db.js';

/**
 * Список пользователей. Пока auth отложена (Auth.js — позже), frontend берёт первого
 * как «текущего» (single-user dev). Возвращаем только безопасные поля.
 */
export async function listUsers() {
  const items = await prisma.user.findMany({
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return { items, total: items.length };
}
