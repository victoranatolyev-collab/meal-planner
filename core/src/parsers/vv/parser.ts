import type { VvParseResult } from './types.js';

/**
 * Контракт парсера: дать VvParseResult.
 * Имплементации:
 *  - StubVvParser — читает фикстуру (для dev/тестов)
 *  - ApiVvParser — реверс-инженерные API endpoints VV (живой источник)
 */
export interface VvParser {
  parse(): Promise<VvParseResult>;
}

/**
 * Фабрика выбирает имплементацию по env VV_PARSER_MODE:
 *  - 'stub' (default) — читает фикстуру
 *  - 'api' — реальные запросы
 *
 * Импорты ленивые, чтобы dev/тесты не тянули http-клиент.
 */
export async function createVvParser(): Promise<VvParser> {
  const mode = process.env['VV_PARSER_MODE'] ?? 'stub';
  if (mode === 'api') {
    const { ApiVvParser } = await import('./api-parser.js');
    return new ApiVvParser();
  }
  const { StubVvParser } = await import('./stub-parser.js');
  return new StubVvParser();
}
