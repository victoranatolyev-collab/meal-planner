import type { TsehParseResult } from './types.js';

/**
 * Контракт парсера: дать TsehParseResult.
 * Имплементации:
 *  - StubTsehParser — читает фикстуру (для dev/тестов)
 *  - ApiTsehParser — реверс-инженерные API endpoints TSEH (живой источник)
 */
export interface TsehParser {
  parse(): Promise<TsehParseResult>;
}

/**
 * Фабрика выбирает имплементацию по env TSEH_PARSER_MODE:
 *  - 'stub' (default) — читает фикстуру
 *  - 'api' — реальные запросы
 *
 * Импорты ленивые, чтобы dev/тесты не тянули http-клиент.
 */
export async function createTsehParser(): Promise<TsehParser> {
  const mode = process.env['TSEH_PARSER_MODE'] ?? 'stub';
  if (mode === 'api') {
    const { ApiTsehParser } = await import('./api-parser.js');
    return new ApiTsehParser();
  }
  const { StubTsehParser } = await import('./stub-parser.js');
  return new StubTsehParser();
}
