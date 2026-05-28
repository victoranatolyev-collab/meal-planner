import pino from 'pino';
import type { z, ZodTypeAny } from 'zod';

const logger = pino({ name: 'llm-client' });

/**
 * Базовый URL llm-service. В docker compose — `http://llm-service:3001`,
 * в локальном dev — `http://localhost:3001` (default).
 */
const DEFAULT_LLM_SERVICE_URL = 'http://localhost:3001';

function baseUrl(): string {
  return process.env['LLM_SERVICE_URL'] ?? DEFAULT_LLM_SERVICE_URL;
}

export interface RunLlmJobArgs<S extends ZodTypeAny> {
  kind: string;
  input: unknown;
  responseSchema: S;
  userId?: string | undefined;
  /** Long-poll timeout (сек). llm-service клампит до 120. */
  timeoutSec?: number;
  /** Override базового URL (для тестов/смоука). */
  serviceUrl?: string;
}

/**
 * Generic-клиент к llm-service (ARCHITECTURE §10.4): enqueue job → long-poll → validate.
 *
 * Шаги:
 *  1. POST /jobs            → { jobId }
 *  2. POST /jobs/:id/wait   → { state, output, error }
 *  3. Zod-валидация `output` нашей схемой (defence-in-depth на границе сервиса).
 *
 * Переиспользуется будущими потребителями: scr-calc-week-plan, scr-telegram-agent.
 *
 * Бросает Error при: недоступности сервиса, FAILED job, TIMEOUT, schema mismatch.
 */
export async function runLlmJob<S extends ZodTypeAny>(args: RunLlmJobArgs<S>): Promise<z.infer<S>> {
  const url = args.serviceUrl ?? baseUrl();
  const timeoutSec = args.timeoutSec ?? 60;

  // 1. Enqueue.
  const enqueueResp = await fetch(`${url}/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: args.kind, input: args.input, userId: args.userId }),
  });
  if (!enqueueResp.ok) {
    throw new Error(
      `llm-service enqueue failed: HTTP ${enqueueResp.status} ${await safeText(enqueueResp)}`,
    );
  }
  const enqueueBody = (await enqueueResp.json()) as { jobId?: string };
  const jobId = enqueueBody.jobId;
  if (!jobId) {
    throw new Error('llm-service did not return a jobId');
  }

  // 2. Long-poll до завершения.
  const waitResp = await fetch(`${url}/jobs/${jobId}/wait?timeout=${timeoutSec}`, {
    method: 'POST',
  });
  if (waitResp.status === 408) {
    throw new Error(`llm-service job ${jobId} timed out after ${timeoutSec}s`);
  }
  if (!waitResp.ok) {
    throw new Error(`llm-service wait failed: HTTP ${waitResp.status} ${await safeText(waitResp)}`);
  }
  const waitBody = (await waitResp.json()) as {
    state?: string;
    output?: unknown;
    error?: string;
  };
  if (waitBody.state === 'FAILED') {
    throw new Error(`llm-service job ${jobId} failed: ${waitBody.error ?? 'unknown error'}`);
  }
  if (waitBody.state !== 'COMPLETED') {
    throw new Error(`llm-service job ${jobId} ended in unexpected state: ${String(waitBody.state)}`);
  }

  // 3. Валидация ответа.
  const result = args.responseSchema.parse(waitBody.output) as z.infer<S>;
  logger.info({ kind: args.kind, jobId, userId: args.userId }, 'llm job completed');
  return result;
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return '';
  }
}
