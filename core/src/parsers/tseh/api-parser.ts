import type { TsehParser } from './parser.js';
import type { TsehParseResult } from './types.js';

/**
 * Реальный парсер TSEH через reverse-engineered API.
 *
 * **СТАТУС: SKELETON, не готов к продакшну.**
 *
 * Требуется research пользователя:
 *  1. Открыть <tseh-site> в браузере (авторизованный, СПб магазин 5590)
 *  2. DevTools → Network → отфильтровать XHR/fetch
 *  3. Скопировать запросы каталога/категорий как fetch (Copy as fetch)
 *  4. Передать сюда:
 *     - Базовый URL API (`TSEH_API_BASE`)
 *     - Заголовки/cookies (`TSEH_API_COOKIE`, `TSEH_API_TOKEN`)
 *     - SAP магазина (`TSEH_STORE_SAP=5590`)
 *
 * См. docs/ARCHITECTURE.md §8.4 и docs/HISTORY.md за дату реализации.
 */
export class ApiTsehParser implements TsehParser {
  async parse(): Promise<TsehParseResult> {
    const base = process.env['TSEH_API_BASE'];
    if (!base) {
      throw new Error(
        'ApiTsehParser: TSEH_API_BASE не задан. ' +
          'Реальный endpoint ещё не подключён — используй TSEH_PARSER_MODE=stub до завершения research-фазы.',
      );
    }
    // TODO: реализация после получения endpoints от пользователя.
    // Шаги:
    //  1. Получить список категорий: GET ${base}/categories
    //  2. По каждой категории: GET ${base}/products?category={id}&store_sap=5590
    //  3. По каждой позиции: GET ${base}/products/{plu}/details (КБЖУ, состав)
    //  4. Собрать TsehParseResult { meta, products[] }
    //  5. Обрабатывать 429/5xx с exponential backoff
    throw new Error('ApiTsehParser.parse(): not implemented yet (см. JSDoc).');
  }
}
