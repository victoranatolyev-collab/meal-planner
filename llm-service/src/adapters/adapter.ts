import type { ZodSchema } from 'zod';

/**
 * Стоимость одного LLM-вызова в токенах + долларах.
 * Поля cache_* — для Anthropic prompt caching (для других провайдеров — 0/null).
 */
export interface LlmCost {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

/**
 * Аргументы вызова adapter.generateStructured().
 */
export interface GenerateArgs<T> {
  systemPrompt: string;
  userPrompt: string;
  responseSchema: ZodSchema<T>;
  maxRetries?: number;
  enablePromptCache?: boolean;
  /**
   * Имя текстового поля схемы для «мягкого» фоллбэка: если модель вернула прозу вместо JSON,
   * адаптер оборачивает весь текст как `{ [lenientTextField]: text }` и валидирует схемой
   * (остальные поля закрываются дефолтами). Для разговорных kind'ов (agent-reply → 'reply'),
   * где обычная проза — валидный ответ. Сериализуемо (строка) — задаётся в handler по kind.
   */
  lenientTextField?: string;
}

/**
 * Результат вызова: распарсенный JSON + cost + длительность.
 */
export interface GenerateResult<T> {
  result: T;
  cost: LlmCost;
  durationMs: number;
  model: string;
}

/**
 * Контракт LLM-адаптера. Имплементации:
 *  - StubAdapter — для тестов и dev без API key
 *  - AnthropicAdapter — реальный Claude API
 *  - OpenAIAdapter, GeminiAdapter — будущие провайдеры
 *  - ClaudeCliAdapter — spawns `claude` CLI (опц. для local dev)
 */
export interface LLMAdapter {
  /**
   * Идентификатор провайдера для логирования (например 'anthropic', 'openai', 'stub').
   */
  readonly provider: string;

  /**
   * Дефолтная модель адаптера (для логирования / cost-расчёта).
   */
  readonly defaultModel: string;

  generateStructured<T>(args: GenerateArgs<T>): Promise<GenerateResult<T>>;
}
