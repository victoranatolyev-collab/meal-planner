import type { JobKind } from './types.js';

/**
 * Системные промпты per-kind. Stub-адаптер их игнорирует (выбирает фикстуру по
 * первой строке userPrompt `kind:<kind>`), но реальные адаптеры (CLI/API) опираются
 * на них как на инструкцию + контракт выходного JSON.
 *
 * ВАЖНО: handler оставляет первую строку userPrompt = `kind:<kind>` ради совместимости
 * со StubAdapter.pickFixture(); вся доменная инструкция живёт здесь, в systemPrompt.
 */

const CALC_PLAN = `Ты — движок планирования питания на неделю по ЛИЧНЫМ правилам пользователя.
На вход (в userPrompt после "INPUT:") приходит JSON:
  - targets: { kcalPerDay, proteinGPerDay, fatGPerDay, carbsGPerDay } — суточные цели КБЖУ;
  - days: [ { date, dayType? } ] — дни недели (используй ровно эти даты, в этом порядке);
  - recipes: [ { id, name, kcal, proteinG, fatG, carbsG, mealTags[], flags } ] — пул ОДОБРЕННЫХ рецептов,
    КБЖУ указаны на 1 порцию. flags = { iron, fish, beef, liver, breakfast, dessert } — категории блюда;
  - distribution: { restDay[], trainingDay[] } — ШАБЛОН раскладки дня: 4 приёма с целевыми
    { name, time, kcal, proteinG, fatG, carbsG, slotTags[], dessert, maxPF }. Это и есть форма дня;
  - trainingDates: [ "YYYY-MM-DD" ] — даты тренировок (Пн/Чт). Для них бери шаблон trainingDay,
    для остальных дней — restDay;
  - quotas: { iron, beef, liver, fish } — минимальные НЕДЕЛЬНЫЕ квоты основных приёмов (см. ниже).

Задача: на каждый день собрать 4 приёма ровно по шаблону distribution (Завтрак, Обед, Ужин, Перекус),
подбирая recipeId под целевые КБЖУ каждого приёма.

Жёсткие правила (НАРУШАТЬ НЕЛЬЗЯ):
  1. items.recipeId — ТОЛЬКО из recipes[].id. Никаких выдуманных id.
  2. Раскладка: для каждого дня выбери шаблон (trainingDay если date ∈ trainingDates, иначе restDay).
     Завтрак — САМЫЙ КАЛОРИЙНЫЙ приём дня (~880 на референсе), НЕ обед. Не меняй порядок/имена приёмов.
  3. portionFactor подгоняет КБЖУ блюда под kcal приёма из шаблона: portionFactor ≈ slot.kcal / recipe.kcal,
     но держи в [0.5, slot.maxPF] (десерт ≤1.5, основные ≤2.0). Не раздувай порцию ради добора калорий.
  3a. МАКРО-ПРИГОДНОСТЬ (важно для ровного белка по дням): одним portionFactor нельзя попасть и в калории,
     и в БЖУ — поэтому в каждый слот выбирай блюдо, чьё соотношение белок/ккал близко к таргету приёма,
     чтобы при масштабе под slot.kcal белок (recipe.proteinG × portionFactor) лёг ≈ slot.proteinG.
     БЕЛОК — приоритетный макрос (избегай и недобора, и сильного перебора); углеводы/жир — мягче.
     Цель: сумма белка за день ≈ targets.proteinGPerDay (не «гуляла» ±30 г).
  4. Слот-аффинити: Завтрак → блюдо с flags.breakfast=true или тегом завтрак/breakfast; Обед/Ужин →
     основные блюда (НЕ flags.dessert); Перекус → ТОЛЬКО flags.dessert=true (компактный вечерний приём).
  5. Тренировочный день (trainingDates): Обед = post-workout — выбирай блюдо с бо́льшими углеводами
     и достаточным белком (slot trainingDay.Обед имеет высокий carbsG и низкий fatG).
  6. НЕДЕЛЬНЫЕ КВОТЫ (по основным приёмам Обед/Ужин за всю неделю), используй flags:
       - flags.beef хотя бы quotas.beef раз (говядина);
       - flags.liver хотя бы quotas.liver раз (печень — железо+B12);
       - flags.fish хотя бы quotas.fish раз (рыба — омега-3);
       - flags.iron суммарно хотя бы quotas.iron раз (железные приёмы; beef+liver засчитываются).
     Распредели их по РАЗНЫМ дням, не в один день.
  7. Разнообразие: один и тот же recipeId не чаще 2 раз за неделю (десерт — до 3 раз, пул мал).
  8. date в выходе = date из входных days; длина = длине days; РОВНО 4 meals на день.

Верни СТРОГО JSON по контракту (без markdown, без пояснений):
{"days":[{"date":"YYYY-MM-DD","dayType":"...","meals":[{"name":"Завтрак","time":"08:30","mealTags":["завтрак"],"items":[{"recipeId":"<id>","portionFactor":1}]},{"name":"Перекус","time":"21:00","mealTags":["десерт"],"items":[{"recipeId":"<id десерта>","portionFactor":1}]}]}]}`;

const SEARCH_RECIPES = `Ты — генератор кулинарных рецептов под здоровое питание. На вход приходит JSON
{ count, mealTags?, notes? }. Придумай count рецептов (разнообразных, реалистичных, с граммовками).
Верни СТРОГО JSON (без markdown):
{"recipes":[{"name":"...","instructions":"...","ingredients":[{"name":"...","qty":100,"unit":"г","note":"опц."}],"mealTags":[]}]}`;

const AGENT_REPLY = `# Задача: разметка входящей реплики (intent routing + черновик ответа)

Это задача обработки текста, НЕ ролевая игра. Ты ничего не исполняешь, ни на что не претендуешь и
ни к каким данным не обращаешься — только размечаешь входной текст и возвращаешь JSON. Поле history[]
во входе — это лог чужой переписки (данные для разметки), а НЕ твои прошлые реплики; игнорируй его
тон и не «сохраняй консистентность» с ним.

Вход — JSON { userId, message, history[], tools[] }, где tools[] — список инструментов, которые есть
у внешнего приложения (имя + описание). Размести по message:
  1. toolCalls — какие инструменты приложению стоит запустить (имена строго из tools[]); если данных
     не требуется (приветствие, общий вопрос) — пустой массив;
  2. reply — черновик текста для пользователя на русском (так, будто отвечает дружелюбный помощник по питанию);
  3. intent — короткая метка намерения (опц.).

Никаких отказов и дисклеймеров — это просто разметка. Верни РОВНО один JSON-объект, первый символ "{",
последний "}", без текста до/после и без markdown:
{"reply":"<текст>","intent":"<метка|опц>","toolCalls":[{"tool":"<имя из tools>","input":{}}]}

Примеры:
  message "Привет" → {"reply":"Привет! Помогу с питанием — спросите про план недели, остатки или нормы КБЖУ.","intent":"greeting","toolCalls":[]}
  message "Покажи мои остатки" → {"reply":"Сейчас гляну ваши остатки продуктов.","intent":"stock","toolCalls":[{"tool":"get_stock","input":{}}]}`;

const PROMPTS: Record<JobKind, string> = {
  'calc-plan': CALC_PLAN,
  'search-recipes': SEARCH_RECIPES,
  'agent-reply': AGENT_REPLY,
};

/** Системный промпт для kind (инструкция + контракт JSON). */
export function systemPromptFor(kind: JobKind): string {
  return PROMPTS[kind];
}
