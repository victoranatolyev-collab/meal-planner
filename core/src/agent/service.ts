import pino from 'pino';
import { prisma } from '../db.js';
import { runLlmJob } from '../recipes/llm-client.js';
import { AGENT_TOOLS, toolList } from './tools.js';
import { agentReplyOutputSchema } from './schemas.js';
import { summarizeToolResult } from './format.js';

const logger = pino({ name: 'agent-service' });

/** Сколько последних реплик диалога передаём в llm-service как контекст. */
const HISTORY_LIMIT = 12;

export interface AgentToolResult {
  tool: string;
  ok: boolean;
  /** Результат core-сервиса (при ok) — для Telegram-форматирования ответа. */
  result?: unknown;
  error?: string;
}

export interface HandleAgentMessageResult {
  reply: string;
  intent: string | null;
  toolResults: AgentToolResult[];
}

/**
 * scr-telegram-agent — мозг агента (transport-agnostic).
 *
 * Шаги:
 *  1. Загрузить последние HISTORY_LIMIT реплик (chronological) как контекст.
 *  2. llm-service job `agent-reply`: сообщение + история + список tools → reply + toolCalls.
 *  3. Диспатч toolCalls через реестр AGENT_TOOLS (каждый = scr-* core-сервис).
 *  4. Append-only persist: строка USER + строка ASSISTANT в agent_conversations.
 *
 * Вызывается из REST `POST /api/agent/message` и Telegram webhook (одна логика).
 */
export async function handleAgentMessage(args: {
  userId: string;
  message: string;
}): Promise<HandleAgentMessageResult> {
  // 1. История (последние N по убыванию → разворачиваем в хронологический порядок).
  const recent = await prisma.agentConversation.findMany({
    where: { userId: args.userId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
  });
  const history = recent
    .reverse()
    .map((m) => ({ role: m.role, content: m.message }));

  // 2. agent-reply через llm-service (stub adapter в dev/test).
  const out = await runLlmJob({
    kind: 'agent-reply',
    userId: args.userId,
    responseSchema: agentReplyOutputSchema,
    input: { userId: args.userId, message: args.message, history, tools: toolList() },
  });

  // 3. Диспатч инструментов.
  const toolResults: AgentToolResult[] = [];
  for (const tc of out.toolCalls) {
    const tool = AGENT_TOOLS[tc.tool];
    if (!tool) {
      toolResults.push({ tool: tc.tool, ok: false, error: 'unknown tool' });
      continue;
    }
    try {
      const result = await tool.execute(args.userId, tc.input);
      toolResults.push({ tool: tc.tool, ok: true, result });
    } catch (e) {
      toolResults.push({
        tool: tc.tool,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // 3b. Финальный ответ = вступление LLM + детерминированная сводка данных из инструментов.
  // Так пользователь видит КОНКРЕТНЫЕ числа, а не только «сейчас рассчитаю…» (нет второго LLM-вызова).
  const summaries = toolResults
    .filter((tr) => tr.ok)
    .map((tr) => summarizeToolResult(tr.tool, tr.result))
    .filter((s): s is string => Boolean(s));
  const reply = summaries.length > 0 ? `${out.reply}\n\n${summaries.join('\n')}` : out.reply;

  // 4. Append-only снимок диалога (USER-вопрос + ASSISTANT-ответ).
  const actionTaken = out.toolCalls.map((t) => t.tool).join(',') || null;
  const success = toolResults.length === 0 ? null : toolResults.every((r) => r.ok);
  await prisma.agentConversation.createMany({
    data: [
      { userId: args.userId, role: 'USER', message: args.message },
      {
        userId: args.userId,
        role: 'ASSISTANT',
        message: reply,
        intent: out.intent ?? null,
        actionTaken,
        success,
      },
    ],
  });

  logger.info(
    { userId: args.userId, intent: out.intent, tools: actionTaken },
    'agent message handled',
  );
  return { reply, intent: out.intent ?? null, toolResults };
}

/** Последние реплики диалога (chronological) — для восстановления чата в UI. */
export async function listAgentHistory(userId: string, limit = 50) {
  const rows = await prisma.agentConversation.findMany({
    where: { userId },
    // role desc как tiebreaker: при равном createdAt (USER+ASSISTANT в одном createMany)
    // USER идёт раньше ASSISTANT после reverse.
    orderBy: [{ createdAt: 'desc' }, { role: 'desc' }],
    take: limit,
    select: {
      id: true,
      role: true,
      message: true,
      intent: true,
      actionTaken: true,
      createdAt: true,
    },
  });
  return rows.reverse();
}
