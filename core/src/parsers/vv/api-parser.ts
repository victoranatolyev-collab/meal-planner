import type { VvParser } from './parser.js';
import type { VvParseResult } from './types.js';

/**
 * Реальный парсер VV через reverse-engineered API.
 *
 * **СТАТУС: SKELETON, не готов к продакшну.**
 *
 * Требуется research пользователя:
 *  1. Открыть <vv-site> в браузере (авторизованный, СПб магазин 5590)
 *  2. DevTools → Network → отфильтровать XHR/fetch
 *  3. Скопировать запросы каталога/категорий как fetch (Copy as fetch)
 *  4. Передать сюда:
 *     - Базовый URL API (`VV_API_BASE`)
 *     - Заголовки/cookies (`VV_API_COOKIE`, `VV_API_TOKEN`)
 *     - SAP магазина (`VV_STORE_SAP=5590`)
 *
 * См. docs/ARCHITECTURE.md §8.4 и docs/HISTORY.md за дату реализации.
 */
export class ApiVvParser implements VvParser {
  async parse(): Promise<VvParseResult> {
    const base = process.env['VV_API_BASE'];
    if (!base) {
      throw new Error(
        'ApiVvParser: VV_API_BASE не задан. ' +
          'Реальный endpoint ещё не подключён — используй VV_PARSER_MODE=stub до завершения research-фазы.',
      );
    }
    // TODO: реализация после получения endpoints от пользователя.
    // Шаги:
    //  1. Получить список категорий: GET ${base}/categories
    //  2. По каждой категории: GET ${base}/products?category={id}&store_sap=5590
    //  3. По каждой позиции: GET ${base}/products/{plu}/details (КБЖУ, состав)
    //  4. Собрать VvParseResult { meta, products[] }
    //  5. Обрабатывать 429/5xx с exponential backoff
    throw new Error('ApiVvParser.parse(): not implemented yet (см. JSDoc).');
  }
}
