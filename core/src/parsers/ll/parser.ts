import type { LlParseResult } from './types.js';

/**
 * Контракт парсера: дать LlParseResult.
 * Имплементации:
 *  - StubLlParser — читает фикстуру (для dev/тестов)
 *  - ApiLlParser — реверс-инженерные API endpoints LL (живой источник)
 */
export interface LlParser {
  parse(): Promise<LlParseResult>;
}

/**
 * Фабрика выбирает имплементацию по env LL_PARSER_MODE:
 *  - 'stub' (default) — читает фикстуру
 *  - 'api' — реальные запросы
 *
 * Импорты ленивые, чтобы dev/тесты не тянули http-клиент.
 */
export async function createLlParser(): Promise<LlParser> {
  const mode = process.env['LL_PARSER_MODE'] ?? 'stub';
  if (mode === 'api') {
    const { ApiLlParser } = await import('./api-parser.js');
    return new ApiLlParser();
  }
  const { StubLlParser } = await import('./stub-parser.js');
  return new StubLlParser();
}
