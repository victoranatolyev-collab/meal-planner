import { getWeekPlan } from '../plan/index.js';
import { calcNormsForUser } from '../norms/index.js';
import { calcStock } from '../stock/index.js';
import { correctPlan } from '../correction/index.js';
import { writeDiaryEntry } from '../diary/index.js';
import { diaryEntryCreateSchema } from '../diary/schemas.js';

/**
 * Реестр инструментов агента (scr-telegram-agent). Каждый tool = существующий scr-* core-сервис.
 * Claude (через llm-service agent-reply) выбирает tool по сообщению; orchestration вызывает execute.
 * Расширяется: добавь запись в AGENT_TOOLS (имя → описание + execute).
 */
export interface AgentTool {
  name: string;
  description: string;
  execute(userId: string, input: Record<string, unknown>): Promise<unknown>;
}

export const AGENT_TOOLS: Record<string, AgentTool> = {
  get_week_plan: {
    name: 'get_week_plan',
    description: 'Показать план недели. input: { weekIso: "2026-W22" }',
    execute: (userId, input) => getWeekPlan(userId, String(input['weekIso'] ?? '')),
  },
  calc_norms: {
    name: 'calc_norms',
    description: 'Рассчитать целевые КБЖУ из последней антропометрии. input: {}',
    execute: (userId) => calcNormsForUser(userId),
  },
  get_stock: {
    name: 'get_stock',
    description: 'Текущие остатки (проекция baseline + заказы − дневник). input: {}',
    execute: (userId) => calcStock(userId),
  },
  correct_plan: {
    name: 'correct_plan',
    description: 'Сверка факт vs план за неделю (остаток КБЖУ). input: { weekIso }',
    execute: (userId, input) => correctPlan(userId, String(input['weekIso'] ?? '')),
  },
  write_diary: {
    name: 'write_diary',
    description: 'Записать съеденное. input: { recipeId? | customName, portionFactor?, kcal?... }',
    execute: (userId, input) => writeDiaryEntry(diaryEntryCreateSchema.parse({ userId, ...input })),
  },
};

/** Список инструментов (имя + описание) для передачи в llm-service agent-reply. */
export function toolList(): Array<{ name: string; description: string }> {
  return Object.values(AGENT_TOOLS).map((t) => ({ name: t.name, description: t.description }));
}
