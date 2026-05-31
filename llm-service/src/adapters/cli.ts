import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { LLMAdapter, GenerateArgs, GenerateResult } from './adapter.js';

/**
 * ClaudeCliAdapter: вызывает локальный `claude` CLI в headless-режиме (`claude -p`)
 * на авторизованном аккаунте пользователя — БЕЗ ANTHROPIC_API_KEY. Промпт подаётся
 * в stdin, ответ читается как `--output-format json` envelope.
 *
 * Используется при `LLM_MODE=cli`. Модель — env `LLM_CLI_MODEL` (default sonnet).
 * Путь к бинарю — env `CLAUDE_CLI_BIN` (default 'claude' из PATH).
 *
 * Envelope CLI: { is_error, result (текст ассистента), total_cost_usd, usage{...}, duration_ms }.
 * `result` инструктируется быть чистым JSON; на всякий случай снимаем ```-ограждения.
 */
export class ClaudeCliAdapter implements LLMAdapter {
  readonly provider = 'claude-cli';
  readonly defaultModel: string;
  private readonly bin: string;
  private readonly timeoutMs: number;

  constructor() {
    this.defaultModel = process.env['LLM_CLI_MODEL'] ?? 'claude-sonnet-4-6';
    this.bin = process.env['CLAUDE_CLI_BIN'] ?? 'claude';
    this.timeoutMs = Number(process.env['LLM_CLI_TIMEOUT_MS'] ?? '180000');
  }

  async generateStructured<T>(args: GenerateArgs<T>): Promise<GenerateResult<T>> {
    const start = Date.now();
    const prompt = `${args.systemPrompt}\n\n${args.userPrompt}\n\nОтветь СТРОГО валидным JSON-объектом по контракту. Без markdown-ограждений, без пояснений.`;

    const envelope = await this.runCli(prompt);
    if (envelope.is_error) {
      throw new Error(`claude-cli error: ${envelope.result ?? 'unknown'}`);
    }

    const text = typeof envelope.result === 'string' ? envelope.result : JSON.stringify(envelope.result);
    const result = parseWithFallback(text, args) as T;

    const usage = envelope.usage ?? {};
    return {
      result,
      model: this.defaultModel,
      durationMs: Date.now() - start,
      cost: {
        inputTokens: numberOr0(usage.input_tokens),
        outputTokens: numberOr0(usage.output_tokens),
        cacheReadTokens: numberOr0(usage.cache_read_input_tokens),
        cacheWriteTokens: numberOr0(usage.cache_creation_input_tokens),
        costUsd: numberOr0(envelope.total_cost_usd),
      },
    };
  }

  /** Спавнит `claude -p --output-format json`, пишет prompt в stdin, парсит JSON-envelope. */
  private runCli(prompt: string): Promise<CliEnvelope> {
    return new Promise((resolve, reject) => {
      // --strict-mcp-config без --mcp-config → отключает все MCP-серверы (главный источник
      // задержки холодного старта). cwd=tmpdir → не подтягиваем project CLAUDE.md/настройки/хуки.
      // НЕ используем --bare: он ломает OAuth-авторизацию (требует API-ключ).
      const child = spawn(
        this.bin,
        ['-p', '--output-format', 'json', '--strict-mcp-config', '--model', this.defaultModel],
        { stdio: ['pipe', 'pipe', 'pipe'], cwd: tmpdir() },
      );

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`claude-cli timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`claude-cli spawn failed: ${err.message}`));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`claude-cli exited ${code}: ${stderr.slice(0, 500)}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout) as CliEnvelope);
        } catch {
          reject(new Error(`claude-cli: cannot parse envelope: ${stdout.slice(0, 500)}`));
        }
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }
}

interface CliEnvelope {
  is_error?: boolean;
  result?: unknown;
  total_cost_usd?: number;
  duration_ms?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

function numberOr0(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Парсит ответ модели в схему. Если модель вернула прозу (не JSON) и задан lenientTextField —
 * оборачивает весь текст как `{ [field]: text }` и валидирует (для разговорных kind'ов проза = ответ).
 */
function parseWithFallback<T>(text: string, args: GenerateArgs<T>): T {
  try {
    return args.responseSchema.parse(extractJson(text));
  } catch (parseErr) {
    if (args.lenientTextField) {
      return args.responseSchema.parse({ [args.lenientTextField]: text.trim() });
    }
    throw parseErr;
  }
}

/** Снимает ```json … ``` ограждения (если модель их добавила) и парсит JSON. */
function extractJson(text: string): unknown {
  let s = text.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence && fence[1]) s = fence[1].trim();
  // Фоллбэк: вырезать от первой { до последней } — на случай обрамляющего текста.
  if (!s.startsWith('{')) {
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last > first) s = s.slice(first, last + 1);
  }
  return JSON.parse(s);
}
