import pino from 'pino';
import type { ZodTypeAny } from 'zod';
import { prisma } from 'core/db';
import { Prisma } from '@prisma/client';
import type { LLMAdapter } from '../adapters/adapter.js';
import { StubAdapter } from '../adapters/stub.js';
import { ClaudeCliAdapter } from '../adapters/cli.js';
import { KIND_SCHEMAS, type JobKind } from './types.js';
import { systemPromptFor } from './prompts.js';

const logger = pino({ name: 'handler' });

/**
 * Выбирает adapter по env `LLM_MODE`. В этой итерации только Stub реализован.
 */
export function createAdapter(): LLMAdapter {
  const mode = process.env['LLM_MODE'] ?? 'stub';
  switch (mode) {
    case 'stub':
      return new StubAdapter();
    case 'cli':
      return new ClaudeCliAdapter();
    case 'api':
      throw new Error('LLM_MODE=api not implemented in this iteration');
    default:
      throw new Error(`Unknown LLM_MODE: ${mode}`);
  }
}

/**
 * Generic handler — вызывается pg-boss subscriber для всех kinds.
 * Валидирует input → выбирает adapter → запускает generateStructured → пишет audit.
 *
 * jobData: pg-boss передаёт {data, id} — data = input от backend/worker.
 */
export async function handleJob(args: {
  kind: JobKind;
  data: unknown;
  pgBossJobId: string;
  userId?: string | undefined;
}): Promise<unknown> {
  const { kind, data, pgBossJobId, userId } = args;
  const schemas = KIND_SCHEMAS[kind];
  if (!schemas) throw new Error(`Unknown kind: ${kind}`);

  // 1. Создаём/обновляем audit-запись (RUNNING).
  // upsert по уникальному pgBossJobId — идемпотентно: если job был повторно активирован
  // (ручной replay, реактивация после краша воркера, истечение expireInSeconds), мы
  // переиспользуем ту же строку вместо падения на Unique constraint и сбрасываем её в
  // RUNNING как новую попытку. retryLimit=0 (см. queue.ts) убирает штатные pg-boss ретраи,
  // upsert закрывает остальные пути повторного запуска.
  const adapter = createAdapter();
  const audit = await prisma.llmJob.upsert({
    where: { pgBossJobId },
    create: {
      pgBossJobId,
      jobKind: kind,
      userId,
      provider: adapter.provider,
      model: adapter.defaultModel,
      status: 'RUNNING',
      input: data as Prisma.InputJsonValue,
    },
    update: {
      jobKind: kind,
      userId,
      provider: adapter.provider,
      model: adapter.defaultModel,
      status: 'RUNNING',
      input: data as Prisma.InputJsonValue,
      // Сбрасываем результаты предыдущей попытки.
      output: Prisma.DbNull,
      error: null,
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      costUsd: null,
      durationMs: null,
      completedAt: null,
    },
  });

  try {
    // 2. Validate input. Cast to ZodTypeAny — kind-specific narrowing требует discriminated union,
    // которого пока нет (см. TODO: переделать KIND_SCHEMAS как discriminated map).
    const inputSchema = schemas.input as ZodTypeAny;
    const outputSchema = schemas.output as ZodTypeAny;
    const validInput = inputSchema.parse(data);

    // 3. Compose prompts. systemPrompt — доменная инструкция per-kind (для CLI/API адаптеров).
    // Первая строка userPrompt остаётся `kind:<kind>` ради StubAdapter.pickFixture().
    const systemPrompt = systemPromptFor(kind);
    const userPrompt = `kind:${kind}\nINPUT: ${JSON.stringify(validInput)}`;

    // 4. Call adapter.
    const result = await adapter.generateStructured({
      systemPrompt,
      userPrompt,
      responseSchema: outputSchema,
    });

    // 5. Update audit (COMPLETED).
    await prisma.llmJob.update({
      where: { id: audit.id },
      data: {
        status: 'COMPLETED',
        output: result.result as Prisma.InputJsonValue,
        inputTokens: result.cost.inputTokens,
        outputTokens: result.cost.outputTokens,
        cacheReadTokens: result.cost.cacheReadTokens,
        cacheWriteTokens: result.cost.cacheWriteTokens,
        costUsd: new Prisma.Decimal(result.cost.costUsd),
        durationMs: result.durationMs,
        completedAt: new Date(),
      },
    });

    logger.info(
      { kind, pgBossJobId, durationMs: result.durationMs, costUsd: result.cost.costUsd },
      'job done',
    );
    return result.result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.llmJob.update({
      where: { id: audit.id },
      data: {
        status: 'FAILED',
        error: msg,
        completedAt: new Date(),
      },
    });
    logger.error({ kind, pgBossJobId, err: msg }, 'job failed');
    throw err;
  }
}
