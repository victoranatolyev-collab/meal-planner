import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { LLMAdapter, GenerateArgs, GenerateResult } from './adapter.js';

/**
 * Stub-адаптер: не делает реальных LLM-вызовов. Читает фикстуру по job kind
 * из `src/fixtures/<kind>.json`, валидирует Zod-схемой, возвращает.
 *
 * Используется когда `LLM_MODE=stub` (default для dev/тестов).
 * Cost всегда нулевой.
 *
 * Kind определяется через первое слово user prompt:
 *   `kind:search-recipes\n...` → fixture 'search-recipes.json'
 * Хелпер `pickFixture()` ниже.
 */
export class StubAdapter implements LLMAdapter {
  readonly provider = 'stub';
  readonly defaultModel = 'stub-v1';

  async generateStructured<T>(args: GenerateArgs<T>): Promise<GenerateResult<T>> {
    const start = Date.now();
    const kind = pickFixture(args.userPrompt);
    const fixturePath = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'fixtures',
      `${kind}.json`,
    );
    const raw = await readFile(fixturePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    // Validate against schema (если фикстура не соответствует — это баг разработки).
    const result = args.responseSchema.parse(parsed) as T;

    return {
      result,
      model: this.defaultModel,
      durationMs: Date.now() - start,
      cost: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: 0,
      },
    };
  }
}

/**
 * Извлекает kind из user prompt по convention `kind:<name>` в первой строке.
 * Если convention не найдена — fallback `default`.
 */
function pickFixture(userPrompt: string): string {
  const firstLine = userPrompt.split('\n', 1)[0] ?? '';
  const match = firstLine.match(/^kind:([a-z-]+)/i);
  return match?.[1] ?? 'default';
}
