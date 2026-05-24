import type { FiveKaParseResult } from './types.js';

/**
 * Контракт парсера: дать FiveKaParseResult.
 * Имплементации:
 *  - StubFiveKaParser — читает фикстуру (для dev/тестов)
 *  - ApiFiveKaParser — реверс-инженерные API endpoints 5K (живой источник)
 */
export interface FiveKaParser {
  parse(): Promise<FiveKaParseResult>;
}

/**
 * Фабрика выбирает имплементацию по env FIVEKA_PARSER_MODE:
 *  - 'stub' (default) — читает фикстуру
 *  - 'api' — реальные запросы
 *
 * Импорты ленивые, чтобы dev/тесты не тянули http-клиент.
 */
export async function createFiveKaParser(): Promise<FiveKaParser> {
  const mode = process.env['FIVEKA_PARSER_MODE'] ?? 'stub';
  if (mode === 'api') {
    const { ApiFiveKaParser } = await import('./api-parser.js');
    return new ApiFiveKaParser();
  }
  const { StubFiveKaParser } = await import('./stub-parser.js');
  return new StubFiveKaParser();
}
