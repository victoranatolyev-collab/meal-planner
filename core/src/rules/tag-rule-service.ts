import { prisma } from '../db.js';
import type { TagRuleCreate, TagRuleUpdate } from './schemas.js';

/**
 * CRUD правил питания на тегах (`tag_rules`). Часть scr-edit-rules / ent-nutrition-rules.
 * Эти же service-функции переиспользует Telegram-агент (tool-use, Phase 6).
 *
 * update/delete возвращают null/false если правило не найдено — route отдаёт 404
 * без привязки к Prisma-специфичным кодам ошибок.
 */

export async function listTagRules(userId: string) {
  return prisma.tagRule.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createTagRule(input: TagRuleCreate) {
  return prisma.tagRule.create({ data: input });
}

export async function updateTagRule(id: string, patch: TagRuleUpdate) {
  const existing = await prisma.tagRule.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.tagRule.update({ where: { id }, data: patch });
}

export async function deleteTagRule(id: string): Promise<boolean> {
  const existing = await prisma.tagRule.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.tagRule.delete({ where: { id } });
  return true;
}
