import { Hono } from 'hono';
import { prisma } from 'core/db';
import { getBoss } from './jobs/queue.js';
import { jobRequestSchema, JOB_KINDS } from './jobs/types.js';

// getBoss используется в POST /jobs handler (см. ниже).
void getBoss;

/**
 * HTTP-сервер llm-service.
 * См. ARCHITECTURE.md §10.4 контракт.
 */
export function createApp(): Hono {
  const app = new Hono();

  app.get('/healthz', (c) => c.json({ status: 'ok', service: 'llm-service' }));

  /**
   * POST /jobs
   * Body: { kind: 'search-recipes' | 'calc-plan' | 'agent-reply', input: {...}, userId? }
   * Response: { jobId: pg-boss UUID }
   */
  app.post('/jobs', async (c) => {
    const body = await c.req.json();
    const parsed = jobRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
    }
    const boss = getBoss();
    const jobId = await boss.send(parsed.data.kind, {
      data: parsed.data.input,
      userId: parsed.data.userId,
    });
    if (!jobId) {
      return c.json({ error: 'enqueue_failed' }, 500);
    }
    return c.json({ jobId }, 202);
  });

  /**
   * GET /jobs/:id
   * Response: { state, output?, error?, cost? } из pg-boss + audit-table.
   */
  app.get('/jobs/:id', async (c) => {
    const id = c.req.param('id');
    // Читаем audit-запись из llm_jobs (handler заполняет её при выполнении job'а).
    // pg-boss state дублирует, но нам нужны ещё cost/output — поэтому опираемся на audit.
    const audit = await prisma.llmJob.findFirst({ where: { pgBossJobId: id } });
    if (!audit) {
      return c.json({ error: 'job_not_found' }, 404);
    }
    return c.json({
      jobId: id,
      kind: audit.jobKind,
      state: audit.status,
      output: audit.output,
      error: audit.error,
      cost: audit.costUsd ? {
        inputTokens: audit.inputTokens,
        outputTokens: audit.outputTokens,
        cacheReadTokens: audit.cacheReadTokens,
        cacheWriteTokens: audit.cacheWriteTokens,
        costUsd: audit.costUsd,
      } : null,
      durationMs: audit.durationMs,
    });
  });

  /**
   * POST /jobs/:id/wait?timeout=60
   * Long-polling: ждёт до timeout сек, опрашивая llm_jobs.
   */
  app.post('/jobs/:id/wait', async (c) => {
    const id = c.req.param('id');
    const timeoutSec = Number(c.req.query('timeout') ?? '60');
    const deadline = Date.now() + Math.min(Math.max(timeoutSec, 1), 120) * 1000;

    while (Date.now() < deadline) {
      const audit = await prisma.llmJob.findFirst({ where: { pgBossJobId: id } });
      if (!audit) {
        return c.json({ error: 'job_not_found' }, 404);
      }
      if (audit.status === 'COMPLETED' || audit.status === 'FAILED') {
        return c.json({
          jobId: id,
          state: audit.status,
          output: audit.output,
          error: audit.error,
          durationMs: audit.durationMs,
        });
      }
      await sleep(500);
    }
    return c.json({ jobId: id, state: 'TIMEOUT' }, 408);
  });

  app.get('/kinds', (c) => c.json({ kinds: JOB_KINDS }));

  return app;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
