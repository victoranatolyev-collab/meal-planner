// Типы сырых данных от TSEH-парсера.
// Структура повторяет shape из старого ingredients_spb.json (см. main branch),
// откуда было видно, что TSEH отдаёт по позиции: PLU, name, weight, prices, kbju, categories, brand, и т.д.
// Здесь — минимальное подмножество, нужное для маппинга в нашу Ingredient.

/**
 * Сырой продукт от TSEH (одна позиция каталога).
 * Поля опциональны — у части позиций КБЖУ/категории/brand могут отсутствовать.
 */
export interface TsehProduct {
  plu: number;
  name: string;
  uom?: string; // unit of measure: 'шт' | 'кг'
  weight?: {
    label?: string;
    grams: number | null;
  };
  prices?: {
    regular?: number | null;
    discount?: number | null;
  };
  categories?: string[];
  is_available?: boolean;
  kbju?: {
    kcal?: number | null;
    protein?: number | null;
    fat?: number | null;
    carbs?: number | null;
  };
  brand?: string | null;
  country?: string | null;
}

/**
 * Метаданные парсинга: какой магазин, сколько позиций, и т.д.
 * Используются для записи в source_tseh.summary jsonb.
 */
export interface TsehParseMeta {
  storeSap: string;
  storeAddress?: string;
  parsedAt: string; // ISO timestamp
  productCount: number;
  withKbjuCount: number;
}

/**
 * Полный результат одного запуска парсера.
 */
export interface TsehParseResult {
  meta: TsehParseMeta;
  products: TsehProduct[];
}
