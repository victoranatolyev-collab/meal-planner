# История разработки

> **Хронологический лог итераций.**
> Что сделано, с чем столкнулся, какие решения принял. Кратко — 2-5 строк на запись.
>
> **Заполнять при КАЖДОЙ значимой итерации.** Правило прописано в `CLAUDE.md`.

---

## Формат записи

```markdown
## YYYY-MM-DD — <Краткий заголовок>
- **Сделано:** ...
- **Столкнулся:** ... *(опционально, если было)*
- **Решение:** ... *(опционально, если принимал)*
- **Файлы:** path/to/file.ts, path/to/other.ts *(опционально)*
- **Коммит:** <hash> *(после коммита)*
```

Записи в **обратном хронологическом порядке** (новые сверху).

---

## 2026-05-31 — Fix: рассинхрон валидации diary recipeId vs формат id рецептов

- **Сделано:** ослабил `recipeId` в `diaryEntryCreateSchema` (`core/src/diary/schemas.ts`) с `z.string().uuid()` до `z.string().min(1)`.
- **Столкнулся:** `Recipe.id` в Prisma — обычная `String` (`@default(uuid())`), но сид кладёт демо-рецепты с id вида `dec0re01-…` (буква `r` не hex → не валидный UUID). POST `/api/diary` с таким recipeId падал на 400 `invalid_body`, хотя записи живут в БД (сид кладёт напрямую). LLM-рецепты с валидным UUID работали — демо-флоу был сломан.
- **Решение:** не навязывать формат UUID — согласовано с `plan/schemas.ts` (`recipeId: z.string()`); `cart`/`correction` recipeId на уровне схемы вообще не валидируют. Существование рецепта уже проверяет сервис-слой `writeDiaryEntry` (`findUnique` → throw). Варианты «привести сид к UUID» / «проверка существования в схеме» отклонены: первый оставил бы схему строже остального кода и сломался бы на любом не-UUID id, второй дублировал бы сервисную проверку.
- **Проверка:** `core:test` 128 unit (macros.test.ts 6→8: +демо-id не-UUID → ok, +пустой recipeId → fail), `core:typecheck` ✅.
- **Файлы:** core/src/diary/schemas.ts, core/src/diary/macros.test.ts

---

## 2026-05-29 — ✅ Phase 6 ЗАКРЫТА: scr-telegram-agent — grammY webhook + linking (подзадача 2/2). **37/37 → RALPH_DONE**

- **Сделано:** Telegram-транспорт поверх «мозга» из подзадачи 1 — **последняя фича проекта**.
  - `core/src/telegram/`: linking-сервис — `createLinkToken` (одноразовый uuid-токен, upsert TelegramAccount, isActive=false до /start), `linkTelegramAccount` (token→chatId, гасит токен, isActive=true), `resolveUserIdByChatId` (авторизация), pure `buildStartDeepLink` + unit-тест.
  - `backend/lib/telegram-bot.ts`: grammY `Bot` — хендлеры `/start <token>` (линковка) и `message:text` (resolve chatId→userId → `handleAgentMessage` → `ctx.reply`).
  - `backend/app/api/telegram/webhook/route.ts`: `webhookCallback(bot,'std/http',{secretToken})` (проверка `X-Telegram-Bot-Api-Secret-Token`). `.../link/route.ts`: POST {userId}→{linkToken, deepLink}.
- **Столкнулся:** (1) grammY `new Bot('')` бросает на пустом токене, а реальный бот нужен credentials (backlog). Решение — **offline-stub**: фиксированный `botInfo` (бот не зовёт getMe) + API-transformer короткозамыкает исходящие вызовы. Webhook смоук-тестится симулированными update без сети. (2) grammY `command('start')` матчит по `entities:bot_command`, не по тексту → в симулированном /start update обязателен `entities:[{type:'bot_command',offset:0,length:6}]`. (3) App Router → адаптер `std/http` (один arg `Request`→`Promise<Response>`), не `next-js` (тот для Pages API).
- **Решение:** stub-first (как scr-search-recipes/scr-calc-week-plan): полный pipeline (webhook→авторизация→агент→tool→ответ→персист) работает на stub; реальный Anthropic-адаптер (`LLM_MODE=api`) + `TELEGRAM_BOT_TOKEN` + setWebhook — backlog (нужны ключи). Это и есть проектный «done» для LLM-фич.
- **Проверка:** core tsc+lint+test (126 unit, +1 deeplink), backend tsc + `next build` (+2 route), lint ✅. Smoke HTTP (5 кейсов): link→token; /start<token>+secret → telegram_accounts привязан (chat_id, token cleared, active); text от привязанного → agent_conversations +2 (action_taken=get_stock); text от непривязанного → 200 без записей (scope); неверный secret → 401.
- **Файлы:** core/src/telegram/*, core/src/index.ts, backend/lib/telegram-bot.ts, backend/app/api/telegram/{webhook,link}/route.ts, backend/package.json (grammy).
- **Итог:** `scr-telegram-agent` → **done**. **Phase 6 ✅ 3/3 → История фаз. 37/37 фич done → RALPH_DONE.**

---

## 2026-05-29 — Phase 6 / шаг 2: scr-telegram-agent — мозг агента (подзадача 1/2)

- **Сделано:** transport-agnostic «мозг» агента (tool-use оркестрация), без Telegram-транспорта.
  - `llm-service`: дополнил job `agent-reply` (input: userId/message/history/tools; output: reply/intent/toolCalls[{tool,input}]) + фикстура `fixtures/agent-reply.json` (stub: reply + toolCall `get_stock`).
  - `core/src/agent/`: `tools.ts` — реестр `AGENT_TOOLS` (5 инструментов = scr-* сервисы: get_week_plan→getWeekPlan, calc_norms→calcNormsForUser, get_stock→calcStock, correct_plan→correctPlan, write_diary→writeDiaryEntry). `service.ts` — `handleAgentMessage`: load last-12 диалога → `runLlmJob('agent-reply')` → диспатч toolCalls по реестру → append-only снимок (строки USER+ASSISTANT). `schemas.ts` — зеркало output + `agentMessageRequestSchema`.
  - `backend`: `POST /api/agent/message` { userId, message } → 200 { reply, intent, toolResults }.
- **Проверка:** core tsc + lint ✅, 125 unit (3 новых tools.test) ✅, llm/backend tsc ✅, next build ✅. Smoke HTTP: POST → reply «остатки» + `get_stock` ok:true (lines:[]) + 2 строки в agent_conversations (intent=show_stock, action_taken=get_stock, success=t).
- **Решение:** мозг отделён от транспорта — та же `handleAgentMessage` обслужит и REST, и Telegram-webhook (подзадача 2). Реестр инструментов расширяется одной записью.
- **Следующее (подзадача 2/2):** grammY webhook + /start-линковка (token→chatId) → `handleAgentMessage` → ответ в чат. Закроет `scr-telegram-agent` → **37/37 → RALPH_DONE**.

---

## 2026-05-29 — Phase 6 / шаг 1: ent-telegram-account + ent-agent-conversations (2 сущности)

- **Сделано:** старт Phase 6 (Agent). Две связанные сущности агента в одной миграции (обе trivial, нужны до scr-telegram-agent).
  - `TelegramAccount` (table telegram_accounts, 1:1 user): chatId? unique, username, firstName, **linkToken? unique** (одноразовый для /start linking), isActive, linkedAt. chatId/linkToken nullable+unique (несколько NULL в Postgres OK).
  - `AgentConversation` (table agent_conversations): **role enum AgentRole (USER/ASSISTANT)**, message, intent?, actionTaken?, success?. index (userId, createdAt DESC) — для контекста last-N.
- **Решение:** обе сущности одной миграцией (Phase 6 schema) — tightly coupled (агенту нужны и линк, и память). Линковка: token → /start <token> → chatId привязывается, token очищается.
- **Закрыто как done:** `ent-telegram-account` + `ent-agent-conversations`. **36/37.** Осталась 1 фича — scr-telegram-agent.
- **Проверки:** prisma format/validate/migrate/generate; core vitest 122/122, tsc core/backend/worker OK. **Smoke (psql):** линковка token→chatId (linkedAt) → 1 account; 2 agent-сообщения (USER/ASSISTANT).
- **Файлы:** `core/prisma/schema.prisma` (+enum AgentRole, +TelegramAccount/AgentConversation, +relations User), `core/prisma/migrations/*_telegram_agent/migration.sql`, `docs/ROADMAP.json`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — ✅ Phase 5 закрыта: scr-edit-schedule (CRUD расписания)

- **Сделано:** последняя фича Phase 5 — backend CRUD расписания уведомлений. Паттерн scr-edit-rules.
  - `core/src/notifications/schedule-schemas.ts` — scheduleCreateSchema (triggerType nativeEnum, schedule, reminderList default Daily, template, isActive default true) + scheduleUpdateSchema (partial, non-empty).
  - `core/src/notifications/schedule-service.ts` — list/create/update(null если нет)/delete(bool).
  - `backend`: GET/POST /api/notification-schedules + PATCH/DELETE /api/notification-schedules/[id].
- **Решение:** schedule CRUD в домене notifications/ (рядом с push-логикой). UI /schedule — отложенная acceptance.
- **Закрыто как done:** `scr-edit-schedule`. **34/37. Phase 5 ✅ DONE (6/6)** — перенесена в «История фаз». Активная фаза → Phase 6 (Agent, последняя).
- **Проверки:** vitest core 122/122 (+5 schedule schemas), tsc core/backend, eslint, next build (routes /api/notification-schedules[/:id]). **Smoke HTTP**: create→GET list(1)→PATCH isActive=false→POST 400 (нет template)→DELETE 204→DELETE 404. ✓
- **Файлы:** `core/src/notifications/{schedule-schemas,schedule-service,schedule-schemas.test}.ts` (3 новых), `core/src/notifications/index.ts`, `backend/app/api/notification-schedules/route.ts` + `/[id]/route.ts` (новые), `core/src/index.ts`, `docs/PLAN.md` (Phase 5 → история).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 5 / шаг 5: scr-correct-plan (сверка факт vs план)

- **Сделано:** коррекция плана = сверка факт (дневник) vs план за неделю. core/src/correction/ (pure + DB-wrapper).
  - `compute.ts` — pure `computeCorrection({dailyTarget, dates, actualByDate})` → по дням {target, actual, remaining = target − actual}. remaining<0 = перебор.
  - `service.ts` — `correctPlan(userId, weekIso)`: dailyTarget = snapshot целей из week_plan; actual = сумма макросов food_diary по дате (в диапазоне недели). 
  - `backend`: GET /api/correction?userId&weekIso.
- **Решение:** v1 = отчёт остатка (target − факт), как scr-calc-stock. «Loop: факт → регенерация плана» (greedy replace под остаток) — extension. correction.Macros НЕ ре-экспортируем из core (коллизия с diary.Macros).
- **Закрыто как done:** `scr-correct-plan`. 33/37.
- **Проверки:** vitest core 117/117 (+4: remaining / день без факта / перебор<0 / multi-day), tsc core/backend, eslint, next build (route /api/correction). **Smoke** (plan target 2000/150/60/200 + diary 1200/90/30/140): remaining 800/60/30/60. ✓
- **Файлы:** `core/src/correction/{types,compute,service,index,compute.test}.ts` (5 новых), `backend/app/api/correction/route.ts` (новый), `core/src/index.ts`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 5 / шаг 4: scr-notifications (Apple Reminders CalDAV, stub-first)

- **Сделано:** генерация напоминаний из расписаний → Apple Reminders. core/src/notifications/ (pure + Adapter pattern).
  - `build.ts` — pure `buildReminderTasks(schedules, dateIso)`: активные → задачи с **детерминированным uid** `scheduleId:date` (дедуп), title=template, list=reminderList; TIME "HH:MM" → dueAt.
  - `adapter-stub.ts` — `StubReminderAdapter` (лог + Set uid, без CalDAV). Реальный CalDAV — backlog.
  - `service.ts` — `pushReminders(userId, dateIso, adapter?)` + `runDailyReminders(dateIso)` (все users с active schedules).
  - `worker/src/jobs/notifications.ts` + cron **04:00 daily** в worker/src/index.ts.
  - `backend`: POST /api/notifications/run (ручной триггер).
- **Решение:** Adapter pattern + stub-first (как llm-service/парсеры) — реальный CalDAV (caldav npm + APPLE_ID/APPLE_APP_PASSWORD) backlog. Дедуп acceptance закрыт детерминированным UID (повторный push идемпотентен).
- **Закрыто как done:** `scr-notifications`. 32/37.
- **Проверки:** vitest core 113/113 (+5 build: active-filter / детерминир. uid / TIME dueAt / MEAL_RELATIVE null / дедуп), tsc core/backend/worker, eslint, next build (route /api/notifications/run). **Smoke HTTP** (seed 2 schedules): run #1 → 2 задачи с uid; run #2 (та же дата) → ТЕ ЖЕ uid (дедуп). ✓
- **Файлы:** `core/src/notifications/{types,build,adapter-stub,service,index,build.test}.ts` (6 новых), `worker/src/jobs/notifications.ts` (новый), `worker/src/index.ts` (+cron), `backend/app/api/notifications/run/route.ts` (новый), `core/src/index.ts`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 5 / шаг 3: ent-notification-schedule (расписание уведомлений)

- **Сделано:** `NotificationSchedule` (table `notification_schedules`): `triggerType` enum (TIME/EVENT/MEAL_RELATIVE), `schedule` string (cron/datetime/relative-spec "meal:lunch+30m"), `reminderList` (default "Daily"), `template`, `isActive`, note. Enum NotificationTrigger. index (userId, isActive). Relation User.notifSchedules, onDelete Cascade.
- **Решение:** schedule как строка (полиморфно по triggerType) — гибко, парсится в scr-notifications. reminderList по умолчанию "Daily" (ARCHITECTURE §8.3).
- **Миграция:** migrate dev --create-only --name notification_schedule → deploy → generate.
- **Smoke (psql):** insert MEAL_RELATIVE правило ("Iron-окно: без кофе") → active schedules ≥1. ✓
- **Закрыто как done:** `ent-notification-schedule`. 31/37.
- **Проверки:** prisma format/validate/migrate/generate; core vitest 108/108, tsc core/backend/worker OK.
- **Файлы:** `core/prisma/schema.prisma` (+enum NotificationTrigger, +NotificationSchedule, +relation), `core/prisma/migrations/*_notification_schedule/migration.sql`, `docs/ROADMAP.json`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 5 / шаг 2: scr-write-diary (запись факт-приёмов)

- **Сделано:** запись в дневник питания. core/src/diary/ (pure + DB-wrapper).
  - `macros.ts` — pure `scaleMacros(totals, factor)` (null-safe) — КБЖУ рецепта × portionFactor.
  - `schemas.ts` — `diaryEntryCreateSchema` (recipeId? | customName + макросы? + portionFactor + eatenAt? + mealName?), superRefine: recipeId ИЛИ customName обязателен.
  - `service.ts` — `writeDiaryEntry`: если recipeId и макросы не заданы → derive из recipe totals × portionFactor (снимок в запись). `listDiary(userId)`.
  - `backend`: POST /api/diary (201) + GET /api/diary?userId.
- **Решение:** макросы — снимок в запись (derive из рецепта или вручную для ad-hoc), переживает удаление рецепта (FoodDiaryEntry.recipe SetNull). Сравнение с планом (deviation) — в scr-correct-plan.
- **Закрыто как done:** `scr-write-diary`. 30/37.
- **Проверки:** vitest core 108/108 (+6: scaleMacros + schema refine), tsc core/backend, eslint, next build (route /api/diary). **Smoke HTTP** (seed user+recipe totals 600/45/15/70): POST recipe ×2 → derived kcal 1200/P90/F30/C140; ad-hoc → 201; без recipe/custom → 400; GET total 2. ✓
- **Файлы:** `core/src/diary/{macros,schemas,service,index,macros.test}.ts` (5 новых), `backend/app/api/diary/route.ts` (новый), `core/src/index.ts`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — ✅ Phase 3 закрыта: scr-calc-stock (проекция остатков)

- **Сделано:** последняя фича Phase 3 — расчёт остатков. core/src/stock/ (pure + DB-wrapper).
  - `project.ts` — pure `projectStock({baseline, bought, consumed})` → строки {ingredientId, baselineG, boughtG, consumedG, projectedG = baseline+bought−consumed}. projectedG<0 = дефицит.
  - `service.ts` — `calcStock(userId)`: baseline (StockItem) + куплено (order_history OrderItems) − съедено (food_diary с recipeId → recipe_ingredients × portionFactor). Ad-hoc записи не влияют. Возвращает {lines, asOf}.
  - `backend`: GET /api/stock?userId → проекция.
- **Решение:** scr-calc-stock = **отчёт-проекция БЕЗ мутации StockItem** (ROADMAP допускал «инкрементально или batch»; проекция избегает double-count; применение к инвентарю = отдельный manual-шаг). Forward-проекция по плану — расширение.
- **Закрыто как done:** `scr-calc-stock`. **29/37. Phase 3 ✅ DONE ПОЛНОСТЬЮ (7/7)** — перенесена в «История фаз». Активная фаза → Phase 5.
- **Проверки:** vitest core 102/102 (+3 project), tsc core/backend, eslint, next build (route /api/stock). **Smoke** (stock 500 + order 300 + diary recipe 100×2): calcStock → projectedG = 500+300−200 = 600. SMOKE_OK.
- **Файлы:** `core/src/stock/{types,project,service,index,project.test}.ts` (5 новых), `backend/app/api/stock/route.ts` (новый), `core/src/index.ts`, `docs/ROADMAP.json`, `docs/PLAN.md` (Phase 3 → история).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 5 / шаг 1: ent-food-diary (дневник питания)

- **Сделано:** старт Phase 5 (Tracking). `FoodDiaryEntry` (table `food_diary`): `recipeId?` (известный рецепт + portionFactor) ИЛИ `customName` (ad-hoc) + макросы (kcal/proteinG/fatG/carbsG) + `eatenAt` + `mealName` + note. recipe onDelete **SetNull** (история переживает удаление рецепта), user Cascade. index (userId, eatenAt DESC). Relations User.diaryEntries, Recipe.diaryEntries.
- **Решение:** одна таблица (не wrapper) — запись = один приём. recipe? + customName покрывают «съел рецепт из плана» и «съел snickers». Макросы хранятся (для ad-hoc / снимок). Связь с планом (факт vs план) — логика в scr-correct-plan, без жёсткого FK на plan_meal_items (меньше связности). SetNull, не Restrict — дневник это история, переживает удаление рецепта.
- **Миграция:** migrate dev --create-only --name food_diary → deploy → generate.
- **Smoke (psql):** 2 записи (recipe-based + ad-hoc Snickers); DELETE рецепта → recipe_id записи = NULL (SetNull). ✓
- **Закрыто как done:** `ent-food-diary`. 28/37. **РАЗБЛОКИРОВАЛ `scr-calc-stock`** (Phase 3) — все его deps (stock/order-history/food-diary/week-plan) теперь done.
- **Проверки:** prisma format/validate/migrate/generate; core vitest 99/99, tsc core/backend/worker OK.
- **Файлы:** `core/prisma/schema.prisma` (+FoodDiaryEntry, +relations), `core/prisma/migrations/*_food_diary/migration.sql`, `docs/ROADMAP.json`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 4 / шаг 4: scr-order-products — Phase 4 фичи ВСЕ done

- **Сделано:** корзина → история заказов (последняя фича Phase 4). Pure + DB-wrapper.
  - `core/src/orders/group.ts` — pure `groupCartIntoOrders(items)`: группирует по shop, priceRub = pricePer100g × qtyG / 100 (null если цены нет), totalRub = сумма известных.
  - `core/src/orders/service.ts` — `placeOrder(userId)`: ACTIVE Cart → Order на каждый shop (PLACED) + OrderItems, cart → ORDERED (tx). `listOrders(userId)`.
  - `backend`: POST /api/orders (place, 201 {orders}) + GET /api/orders?userId (история).
- **Решение:** заказ per-shop. Реальный API магазина (5ka.ru и т.д.) — backlog (stub-first, как парсеры). order_match (сверка факт/план) — отложенная Phase-4 acceptance.
- **Закрыто как done:** `scr-order-products`. **27/37. Все фичи Phase 4 done** (ent-cart, ent-order-history, scr-assemble-cart, scr-order-products).
- **Проверки:** vitest core 99/99 (+4 group: shop-группировка / цена / null / total), tsc core/backend, eslint, next build (route /api/orders). **Smoke end-to-end** (assemble→placeOrder): cart (250г FIVEKA, 100г VV) → 2 заказа (FIVEKA 200₽, VV 30₽), cart → ORDERED, order_history заполнен. SMOKE_OK.
- **Отложено (acceptance, не фичи):** POST /api/orders/:id/match (diff факт/план), UI /cart (dnd-kit).
- **Файлы:** `core/src/orders/{types,group,service,schemas,index,group.test}.ts` (6 новых), `backend/app/api/orders/route.ts` (новый), `core/src/index.ts` (re-export).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 4 / шаг 3: scr-assemble-cart (сборка корзины)

- **Сделано:** сборка корзины из плана недели. Паттерн plan/ (pure + DB-wrapper).
  - `core/src/cart/assemble.ts` — pure `assembleCartLines({planItems, recipeIngredients, stockGrams})`: аккумулирует граммы по ингредиенту (recipe_ingredient.qtyG × portionFactor, суммарно по всем позициям плана) − остатки → `ceil(needed)`, shop = ingredient.source. needed≤0 не покупается.
  - `core/src/cart/service.ts` — `assembleCart(userId, weekIso)` (load план-дерево + recipe_ingredients[+ingredient.source] + stock → pure → replace ACTIVE Cart в tx) + `getActiveCart(userId)`.
  - `backend`: POST /api/cart/assemble (201 {cartId, lines, byShop}; 422) + GET /api/cart?userId (active cart + ингредиенты; 404).
- **Решение:** shop = ingredient.source (источник каталога). Регенерация ACTIVE-корзины (deleteMany ACTIVE + create). order_match (сверка факт/план) — в scr-order-products.
- **Закрыто как done:** `scr-assemble-cart`. 26/37.
- **Проверки:** vitest core 95/95 (+5 assemble: accumulate ×portionFactor / stock-subtract / 0-при-достатке / ceil / shop-group), tsc core/backend, eslint, next build (routes /api/cart, /api/cart/assemble). **Smoke end-to-end** (docker pg + seed plan+stock): assembleCart('2026-W30') → ingA 200×2−50=350(FIVEKA), ingB 80×2=160(VV), 2 lines byShop{FIVEKA:1,VV:1}, persisted + read-back. SMOKE_OK.
- **Файлы:** `core/src/cart/{types,assemble,service,schemas,index,assemble.test}.ts` (6 новых), `backend/app/api/cart/route.ts` + `backend/app/api/cart/assemble/route.ts` (новые), `core/src/index.ts` (re-export).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 4 / шаг 2: ent-order-history (миграция истории заказов)

- **Сделано:** `Order` (table `order_history`, per-user, `shop` IngredientSource, `status` enum PLACED/DELIVERED/CANCELLED, totalRub, orderedAt/deliveredAt) + `OrderItem` (ingredient FK, qtyG, `priceRub` фактическая цена), unique (orderId, ingredientId). onDelete Cascade(order→items, user→orders) / Restrict(ingredient). Enum OrderStatus. Relations User.orders, Ingredient.orderItems.
- **Решение:** заказ per-shop (корзина группируется по магазинам → каждый shop-group = отдельный Order). priceRub на item = фактическая цена (для сверки факт vs план). Аналог actual_orders[] из legacy.
- **Миграция:** migrate dev --create-only --name order_history → deploy → generate.
- **Smoke (psql):** Order + OrderItem (total 1234.50, price 89.90) → 1 item; DELETE order → cascade items=0. ✓
- **Закрыто как done:** `ent-order-history`. 25/37. **Все entity Phase 4 done** (ent-cart + ent-order-history).
- **NB:** scr-calc-stock (Phase 3) частично разблокирован (ent-order-history готов), но полностью — после ent-food-diary (Phase 5).
- **Проверки:** prisma format/validate/migrate/generate; core vitest 90/90, tsc core/backend/worker OK.
- **Файлы:** `core/prisma/schema.prisma` (+enum OrderStatus, +Order/OrderItem, +relations), `core/prisma/migrations/*_order_history/migration.sql`, `docs/ROADMAP.json`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 4 / шаг 1: ent-cart (миграция корзины)

- **Сделано:** старт Phase 4 (Procurement). Таблицы корзины: `Cart` (per-user, `status` enum ACTIVE/ORDERED) + `CartItem` (ingredient FK, qtyG, `shop` IngredientSource, note). unique (cartId, ingredientId, shop) — один товар из разных магазинов = разные строки. onDelete Cascade(cart→items, user→carts) / Restrict(ingredient). Relations User.carts, Ingredient.cartItems. Enum CartStatus.
- **Решение:** Cart-wrapper + items (соответствует `carts` в ARCHITECTURE §7.4; паттерн week_plans wrapper+items). shop на item (не только ingredient.source) — один товар можно купить в разных магазинах, scr-assemble-cart группирует по shop. status для lifecycle (ACTIVE собирается → ORDERED после scr-order-products).
- **Миграция:** migrate dev --create-only --name cart (20260528221206) → deploy → generate.
- **Smoke (psql):** upsert по (cart,ingredient,shop) → 1 строка; та же пара другой shop → 2 строки; DELETE cart → cascade items=0. ✓
- **Закрыто как done:** `ent-cart`. 24/37.
- **Проверки:** prisma format/validate/migrate/generate; core vitest 90/90, tsc core/backend/worker OK.
- **Файлы:** `core/prisma/schema.prisma` (+enum CartStatus, +Cart/CartItem, +relations), `core/prisma/migrations/20260528221206_cart/migration.sql`, `docs/ROADMAP.json`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 3 / шаг 9: UI /plan (read-only) + GET /api/plans list mode

- **Сделано:** acceptance-критерий Phase 3 — страница просмотра недельного плана.
  - **Backend:** `listWeekPlans(userId)` (core/plan) + `GET /api/plans?userId` БЕЗ weekIso → список планов {items, total}; с weekIso → дерево (как было). collection-vs-item на одном endpoint.
  - **Frontend:** `src/api/plans.ts` (fetchPlans list + fetchPlan tree, 404→null) + `src/pages/plan/plan-page.tsx` — useCurrentUser → fetchPlans → Untitled UI Select недели (default = последняя) → fetchPlan → дерево (DayCard: дата+day_type → приёмы name/time/meal_tags → позиции recipe.name × portionFactor + from_stock/хвост). Read-only, TanStack Query, как /rules. Роут `/plan` в main.tsx.
- **Столкнулся:** smoke list-режима сначала упал (weekIso Required) — `next start` отдавал СТАРЫЙ build (в этой итерации сначала собрал только frontend). Пересобрал backend → list заработал. (Урок: после правки route.ts нужен `npm run build --workspace backend` перед `next start`.)
- **Проверки:** vitest core 90/90, tsc core/backend, eslint backend/frontend, frontend build (2573 modules), next build (route /api/plans). **Smoke**: GET /api/plans?userId → list total 1 (2026-W23/DRAFT); user без планов → total 0; GET с weekIso → 200 дерево; bad userId → 400. ✓
- **Phase 3:** все actionable фичи + acceptance (/plan UI) закрыты. Остался только `scr-calc-stock` — ЗАБЛОКИРОВАН (deps ent-order-history Phase 4 + ent-food-diary Phase 5). Активная работа → Phase 4. 23/37 (UI — acceptance, не ROADMAP-фича).
- **НЕ проверено:** визуальный рендер /plan в браузере (build/types/lint зелёные, API smoke-verified).
- **Файлы:** `core/src/plan/{service,index}.ts`, `core/src/index.ts`, `backend/app/api/plans/route.ts`, `frontend/src/api/plans.ts` (новый), `frontend/src/pages/plan/plan-page.tsx` (новый), `frontend/src/main.tsx`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 3 / шаг 8: scr-import-health (импорт в health-таблицы)

- **Сделано:** импорт данных здоровья — create+list для 4 видов записей. Паттерн rules/ + dynamic route.
  - `core/src/health/schemas.ts` — Zod create-схемы: anthropometry / lab-test / training-log / mood-log (z.coerce.date для дат → default now в service; z.nativeEnum для Sex/ActivityLevel/Goal; isFlagged/symptoms defaults) + HEALTH_KINDS + healthListQuery (coerce limit).
  - `core/src/health/service.ts` — createX/listX × 4 (8 функций, append-only, desc по дате).
  - `backend/app/api/health/[kind]/route.ts` — dynamic route: GET(?userId&limit) + POST, switch по kind (404 unknown_kind, 400 invalid_*). Один файл на 4 ресурса.
- **Решение:** dynamic `[kind]` route вместо 4 отдельных файлов — компактнее, switch type-safe (exhaustive по union). OCR/PDF анализов — backlog (сначала ручной/JSON ввод).
- **Закрыто как done:** `scr-import-health`. 23/37. **Все READY фичи Phase 3 закрыты** (scr-calc-stock заблокирован Phase 4/5).
- **Проверки:** vitest core 90/90 (+10 health schemas: required/enum/defaults/date-coerce), tsc core/backend, eslint, next build (route /api/health/[kind]). **Smoke** (docker pg + backend): POST anthropometry/lab-tests/training-logs/mood-logs → 201; GET lab-tests → read-back (hemoglobin 110 flagged); unknown kind → 404; invalid (нет sex) → 400. ✓
- **Файлы:** `core/src/health/{schemas,service,index,schemas.test}.ts` (4 новых), `backend/app/api/health/[kind]/route.ts` (новый), `core/src/index.ts` (re-export).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 3 / шаг 7: scr-calc-week-plan подзадача 3/3 — DONE (REST endpoints)

- **Сделано:** закрыл самую сложную фичу — REST-слой над orchestration.
  - `core/src/plan/service.ts` +`getWeekPlan(userId, weekIso)` — читает полное дерево (days→meals→items + recipe-инфо), null если нет. findUnique по uniq_user_week.
  - `core/src/plan/schemas.ts` +`generateWeekPlanRequestSchema` (userId/weekIso/startDate/dayCount?/dayTypes?) + `getWeekPlanQuerySchema`.
  - `backend/app/api/plans/route.ts` — POST (generate → 201 summary; 422 generate_failed) + GET (?userId&weekIso → дерево; 404).
- **Проверки:** tsc core/backend, vitest 80/80, eslint, next build (route /api/plans). **HTTP smoke** (docker pg + llm-service stub + backend, seed target+approved recipe): POST /api/plans → 201 {2дн/6приёмов/6поз/6 substitutions}; GET /api/plans → полное дерево (status DRAFT, snapshot kcalTarget=2455, days→meals→items с recipe.name); GET несуществующей недели → 404; POST без startDate → 400; POST для юзера без рецептов → 422. ✓
- **Закрыто как done:** `scr-calc-week-plan` (все 3 подзадачи). 22/37.
- **Backlog (не блокирует):** week-level правила (MIN/MAX_PER_WEEK) в greedy; реальный AnthropicAdapter (calc-plan в api-режиме — сейчас stub).
- **Файлы:** `core/src/plan/{service,schemas,index}.ts`, `core/src/index.ts`, `backend/app/api/plans/route.ts` (новый).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-29 — Phase 3 / шаг 6: scr-calc-week-plan подзадача 2/3 (orchestration)

- **Сделано:** оркестрация генерации плана в `core/src/plan/` (паттерн pure + DB-wrapper).
  - `schemas.ts` — `calcPlanOutputSchema` (Zod, зеркало llm-service calc-plan output) + типы DraftPlan/DraftDay.
  - `resolve.ts` — pure `resolveDraftToApproved(days, pool)`: greedy fallback — каждый item с recipeId не из approved-пула заменяется на рецепт из пула (round-robin). Покрывает (1) stub placeholder id, (2) LLM-галлюцинации. Возвращает substitutions count.
  - `service.ts` — `generateWeekPlan({userId, weekIso, startDate, dayCount?, dayTypes?})`: NutritionTarget → targets snapshot; approved+normalized recipes → пул; buildDays (Date-арифметика, доступна в core); runLlmJob('calc-plan'); resolveDraftToApproved; persist в дерево week_plans (tx: deleteMany существующий + nested create через 4 уровня). Регенерация по (userId, weekIso).
- **Решение:** greedy = подстановка из approved-пула (рецепты уже прошли scr-validate-recipes, значит recipe-level валидны). Week-level правила (MIN/MAX_PER_WEEK) — отдельный проход (refinement, не блокирует). NutritionTarget обязателен (иначе нет targets для snapshot); пул approved обязателен.
- **Проверки:** vitest core 80/80 (+4 resolve: keep/substitute/round-robin/empty-throws), tsc core, eslint core. **Smoke end-to-end** (docker pg + llm-service stub + seed user/target/approved recipe): generateWeekPlan → 2 дня/6 приёмов/6 позиций, 6 substitutions (placeholder→approved), snapshot kcalTarget=2455, status DRAFT, все items с валидным recipeId FK; повторный вызов → planCount=1 (регенерация). SMOKE_OK.
- **Статус:** `scr-calc-week-plan` остаётся **in_progress** (2/3). Осталось: 3/3 — endpoint POST /api/plans + e2e. 21/37.
- **Файлы:** `core/src/plan/{schemas,resolve,resolve.test,service,index}.ts` (5 новых), `core/src/index.ts` (re-export).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-28 — Phase 3 / шаг 5: scr-calc-week-plan подзадача 1/3 (calc-plan LLM-контракт)

- **Сделано:** начал самую сложную фичу (hybrid LLM+greedy), разбив на 3 подзадачи. Эта — контракт LLM-job `calc-plan` в llm-service (был placeholder).
  - `llm-service/src/jobs/types.ts`: `calcPlanInputSchema` (weekIso, startDate/endDate, targets КБЖУ, days[]{date,dayType?}, recipes[] — пул одобренных {id,name,kcal,proteinG,fatG,carbsG,mealTags}, notes?) + `calcPlanOutputSchema` (days → meals{name,time,mealTags,items} → items{recipeId, portionFactor, fromStock, tail}) — зеркало дерева ent-week-plan. Экспорт CalcPlanInput/CalcPlanOutput.
  - `llm-service/src/fixtures/calc-plan.json` — валидный draft (2 дня) для stub-режима.
  - handler уже generic по KIND_SCHEMAS — правок не потребовалось.
- **Решение:** разбивка на 3 подзадачи (правило Ralph «слишком большая → закрой первую»): (1) контракт+stub [эта]; (2) core/src/plan/ orchestration (LLM→validate→greedy→persist); (3) endpoint+e2e. NB: stub возвращает фикстуру с placeholder recipeId — реальный маппинг на approved-рецепты делает orchestration (подзадача 2); в api-режиме LLM получит реальный пул в input.
- **Статус:** `scr-calc-week-plan` → **in_progress** (1/3). 21/37 без изменений.
- **Проверки:** tsc llm-service + eslint llm-service clean. **Stub smoke** (docker pg + llm-service stub): POST /jobs {kind:calc-plan, валидный input} → jobId → /wait → COMPLETED с валидным draft-планом из фикстуры (days→meals→items, defaults применены). ✓
- **Файлы:** `llm-service/src/jobs/types.ts` (calc-plan schemas), `llm-service/src/fixtures/calc-plan.json` (новый).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-28 — Phase 3 / шаг 4: scr-calc-norms (расчёт целевых КБЖУ)

- **Сделано:** первый расчётный скрипт Phase 3 — целевые КБЖУ из антропометрии. Паттерн validation/: pure-функция + DB-wrapper + endpoint.
  - `core/src/norms/calc.ts` — pure `calcNorms(input)`: BMR Mifflin-St Jeor (sex-константа +5/−161) × activity-множитель (SEDENTARY 1.2 .. VERY_ACTIVE 1.9) × goal-поправка (CUT 0.85 / MAINTAIN 1.0 / GAIN 1.1) → kcal; макросы: белок = proteinGPerKg × вес (default 1.8), жир = 30% kcal, углеводы = остаток. Возвращает bmr/tdee/kcal/P/F/C + breakdown.
  - `core/src/norms/service.ts` — `calcNormsForUser(userId)`: последний снимок anthropometry + proteinGPerKgMin из NutritionTarget → calcNorms. Бросает если нет anthropometry / не заданы activityLevel/goal.
  - `backend/app/api/norms/route.ts` — GET ?userId (422 calc_failed если нет данных).
- **Решение:** scr-calc-norms = **рекомендация-оценка**, НЕ перезаписывает NutritionTarget (authoritative-цели правит пользователь через /rules — так уже устроено). Стандартная формула (Mifflin + activity multipliers); reference data/nutrition_norms.json — для сверки порядка величин. Точная подгонка под внешний калькулятор (doctorushakov 2455) не цель — это evidence-based estimate, пользователь корректирует.
- **Закрыто как done:** `scr-calc-norms`. 21/37.
- **Проверки:** vitest core 76/76 (+8 norms: BMR male/female, TDEE, goal-порядок, белок default+override, жир %, макро-баланс ±6 ккал), tsc core/backend, eslint core/backend, next build (route /api/norms). **Smoke** (docker pg + seed anthropometry + GET /api/norms): male 86кг/190/24/MODERATE/MAINTAIN → bmr 1933, tdee 2995, kcal 2995, P155/F100/C369 (формула сходится); user без anthropometry → 422. ✓
- **Файлы:** `core/src/norms/{types,calc,service,index,calc.test}.ts` (5 новых), `backend/app/api/norms/route.ts` (новый), `core/src/index.ts` (re-export), `docs/ROADMAP.json`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-28 — Phase 3 / шаг 3: ent-health-records (4 нормализованные таблицы)

- **Сделано:** сущность здоровья — полная нормализация + append-only (решение пользователя via AskUserQuestion, grounded в reference user_profile.json / ABCDEFG framework). 4 таблицы + 3 enum.
  - `anthropometry`: measured_at + sex/age/height/weight/bodyFat/leanMass/bmi/ffmi/waist + **activityLevel/stepsPerDay/goal** — снимок «входов норм» для scr-calc-norms. index (userId, measured_at DESC).
  - `lab_tests`: analyte/value/unit + reference_low/high + status + **isFlagged** (напр. anemia при Hb<норма). 1 строка/анализ. index (userId, analyte, measured_at DESC).
  - `training_logs`: performed_at + kind + durationMin + intensity.
  - `mood_logs`: logged_at + mood/energy/sleepHours + symptoms[].
  - Enums: Sex, ActivityLevel (SEDENTARY..VERY_ACTIVE), Goal (CUT/MAINTAIN/GAIN). Все таблицы append-only, per-user FK Cascade.
- **Решение (AskUserQuestion):** (1) полная нормализация (отдельные таблицы), НЕ jsonb — максимально queryable/типизировано; (2) append-only снимки с measured_at — тренды (вес, динамика Hb при анемии, лог тренировок). scr-calc-norms берёт последний снимок anthropometry. activityLevel/goal положены на anthropometry (снимок метаболич. состояния) — без 5-й таблицы. authoritative targets уже в NutritionTarget (редактируется через /rules), поэтому scr-calc-norms = вычисление-предложение → туда.
- **Миграция:** migrate dev --create-only --name health_records (20260528195225) → deploy → generate.
- **Smoke (psql):** insert по строке в каждую таблицу с reference-данными (male/24/190/86/11%/FFMI21.2; Hb 110 flagged anemia; strength 90мин; mood 7). Latest-snapshot query (как scr-calc-norms): weight=86, Hb=110 flagged=true. ✓
- **Закрыто как done:** `ent-health-records`. 20/37. **Все entity Phase 3 done** (ent-stock/ent-week-plan/ent-health-records).
- **Проверки:** prisma format/validate (valid 🚀)/migrate/generate; core vitest 68/68, tsc core/backend/worker OK.
- **Файлы:** `core/prisma/schema.prisma` (+3 enum, +4 модели, +relations User), `core/prisma/migrations/20260528195225_health_records/migration.sql`, `docs/ROADMAP.json`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-28 — Phase 3 / шаг 2: ent-week-plan (миграция `week_plan`, 4 таблицы)

- **Сделано:** центральная сущность планирования — недельный план. 4 таблицы + enum (точно как legacy plans/week_*.json, по решению пользователя через AskUserQuestion).
  - `WeekPlan` (week_plans): weekIso, start/end date, `status` enum (DRAFT/ACTIVE/ARCHIVED), **snapshot целей** (kcal/protein/fat/carbs target + budget target/softcap — копия NutritionTarget на момент создания), unique (userId, weekIso), index (userId, status).
  - `PlanDay` (plan_days): date + dayType (свободная строка: training/office/rest) + notes, unique (weekPlanId, date).
  - `PlanMeal` (plan_meals): name + time ("08:30") + sortOrder + **mealTags[]** (sweet_breakfast/c1_exclusion/iron_meal — для валидатора недели) + notes.
  - `PlanMealItem` (plan_meal_items): recipe FK + **portionFactor** Decimal default 1.0 (предрасчитанные объёмы 0.8/1/2, одна ссылка на рецепт) + fromStock + tail (сладкий хвост) флаги + sortOrder.
  - Relations: User.weekPlans, Recipe.planItems. Cascade через всё дерево (plan→day→meal→item); recipe onDelete Restrict.
- **Решения пользователя (AskUserQuestion):** (1) схема ТОЧНО как legacy (day_type, meal time/tags/notes, item from_stock/tail) — meal_tags нужны валидатору недели; (2) targets+budget — SNAPSHOT в план (исторический артефакт); (3) порция — одна ссылка на рецепт + предрасчитанный portionFactor (0.8/1/2), не свободный множитель.
- **Миграция:** `migrate dev --create-only --name week_plan` (20260528191402) → deploy → generate. Plain tables.
- **Smoke (psql):** построил дерево week_plan→day→meal→item (join к плану = 1); DELETE week_plan → cascade снял plan_days=0 и plan_meal_items=0 (каскад через 4 уровня работает).
- **Столкнулся:** psql DO-блок — id-колонки TEXT (Prisma String @default(uuid)), не uuid-тип; переменные надо `text` + `gen_random_uuid()::text`. (Gotcha: Prisma uuid → TEXT в postgres.)
- **Закрыто как done:** `ent-week-plan`. 19/37.
- **Проверки:** prisma format/validate (valid 🚀)/migrate/generate; core vitest 68/68, tsc core/backend/worker OK.
- **Файлы:** `core/prisma/schema.prisma` (+enum WeekPlanStatus, +4 модели, +relations User/Recipe), `core/prisma/migrations/20260528191402_week_plan/migration.sql`, `docs/ROADMAP.json`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-28 — Phase 3 / шаг 1: ent-stock (миграция `stock`)

- **Сделано:** первая фича Phase 3 — таблица остатков. Модель `StockItem` (table `stock`): `userId`+`ingredientId` FK, `qtyG Int`, `note?`, timestamps. `@@unique([userId, ingredientId])` (одна строка на ингредиент → upsert), index `userId`. onDelete: Cascade(user) / Restrict(ingredient) — как у recipe_ingredients. Relations добавлены на `User` (stockItems) и `Ingredient` (stockItems).
- **Решение:** хранение текущего количества (одна строка на пару user-ingredient), НЕ append-only ledger — пересчёт делает scr-calc-stock (последняя инвентаризация ± план ± заказы ± дневник). qty в граммах (qtyG), consistent с recipe_ingredients и gram-based пайплайном. Структурно простая фича (estimated low) — без AskUserQuestion.
- **Миграция:** `prisma migrate dev --create-only --name stock` (20260528190123_stock) → migrate deploy. Plain table (без GIN/extension), ручных правок SQL не требовалось.
- **Smoke (psql):** insert qty 500 → upsert на conflict (user+ingredient) → qty 999, count пары = 1 (unique работает); insert с несуществующим ingredient_id → FK violation (constraint enforced). ✓
- **Закрыто как done:** `ent-stock`. 18/37.
- **Проверки:** prisma format/validate (valid 🚀), migrate deploy, generate; core vitest 68/68, tsc core/backend/worker — все зелёные.
- **Файлы:** `core/prisma/schema.prisma` (+StockItem, +relations на User/Ingredient), `core/prisma/migrations/20260528190123_stock/migration.sql`, `docs/ROADMAP.json`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-28 — ✅ Phase 2 закрыта: e2e acceptance (rule→recipe→normalize→validate)

- **Сделано:** закрыл последний acceptance-критерий Phase 2 — e2e-тест всего пайплайна рецептов, и перенёс Phase 2 в «История фаз».
  - `worker/src/cli/e2e-phase2.ts` (+ npm script `e2e:phase2`) — integration-smoke, прогоняющий цепочку через реальные core-сервисы + БД: seed user + 3 ингредиента с тегами (CUSTOM) + правило BAN_TAG garlic → `searchRecipes` (stub) → создание 2 контролируемых рецептов (с чесноком / чистый) → `normalizeRecipe` (pg_trgm) → `validateRecipe` → assert + проверка персистентности флагов. 8 проверок, exit 0/1.
- **Решение:** e2e как **CLI integration-смоук** (паттерн worker `seed-*`), НЕ vitest-тест — чтобы не тащить живую БД/llm-service в дефолтный unit-прогон (core тесты остаются чистыми). Запускается против docker pg + llm-service stub.
- **End-to-end прогон (зелёный):** [1/4] searchRecipes → 2 рецепта is_relevant; [2/4] normalize → «чеснок»→«Чеснок свежий» (pg_trgm); [3/4] validate → рецепт с чесноком ОТКЛОНЁН (`BAN_TAG(garlic): ингредиент «Чеснок свежий»…`), чистый ОДОБРЕН; [4/4] флаги в БД (is_normalized, is_approved=false, rejection_reasons). ✅ E2E PASSED.
- **Столкнулся:** `createTagRule(input: TagRuleCreate)` требует `isActive` (Zod `.default(true)` → output-тип обязателен), прямой вызов без parse падал на tsc — добавил `isActive: true`. (Минорный API-нюанс: post-parse output type у service-функций.)
- **Phase 2 ✅ DONE.** Все 6 фич + 6 acceptance-критериев закрыты. 17/37. Перенесена в «История фаз» в PLAN.md с полным summary. Активная фаза → **Phase 3 (Plan)**.
- **Проверки:** worker tsc + eslint clean; e2e прогон зелёный (8/8). Регресс не трогал (только worker + docs).
- **Файлы:** `worker/src/cli/e2e-phase2.ts` (new), `worker/package.json` (+e2e:phase2), `docs/PLAN.md` (Phase 2 → история, Активная → Phase 3), `docs/ROADMAP.json` (updated_at), `AGENTS.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-28 — Phase 2 / scr-edit-rules UI (шаг 2/2): tag-rules CRUD → scr-edit-rules DONE

- **Сделано:** секция CRUD правил-тегов на `/rules` — закрывает `scr-edit-rules`. Все 6 фич Phase 2 теперь done (17/37).
  - `src/api/tag-rules.ts` — TagRuleDto + list/create/update/delete (типизированные обёртки над `/api/tag-rules[/:id]`).
  - `src/pages/rules/tag-rule-schema.ts` — Zod форма (enum ruleKind, tagName, conditional superRefine: quantity для MIN/MAX_PER_WEEK, mealTag для *_IN_MEAL) + RULE_KIND_LABELS (ru).
  - `src/pages/rules/tag-rules-section.tsx` — список правил (useQuery) с toggle isActive (PATCH) + delete (DELETE), форма добавления (RHF + Untitled UI `Select` ruleKind + `Input`/`InputNumber`, conditional поля по `watch('ruleKind')`, POST). invalidate + reset на успехе.
  - `rules-page.tsx` — добавлена `<TagRulesSection>` под формой КБЖУ.
- **Решения:** `Select` (React Aria) — items + render `Select.Item`, `selectedKey`/`onSelectionChange` через Controller. Кнопки toggle/delete через нативный `onClick` (RAC Button форвардит на DOM в v1.16; `onPress` не в типах ButtonProps). MVP edit = delete + re-add (PATCH задействован для isActive-toggle) — полноценный inline-edit не делал (не нужен для acceptance). color `tertiary-destructive` валиден.
- **Закрыто:** `scr-edit-rules` → **done**. Phase 2: все 6 фич (ent-recipes, ent-nutrition-rules, scr-search-recipes, scr-normalize-recipe, scr-validate-recipes, scr-edit-rules) done.
- **Осталось по Phase 2:** единственный незакрытый acceptance-критерий — e2e-тест «правило → рецепт → нормализация → валидация через API». Делаю следующей итерацией, затем переношу Phase 2 в «История фаз».
- **Проверки:** frontend build (tsc -b + vite, 2571 modules) ✅, eslint + typecheck frontend ✅. Backend tag-rules CRUD API уже был smoke-verified curl'ом (итерация scr-edit-rules backend: POST/GET/PATCH/DELETE + 400 на невалидный superRefine). Визуал в браузере не авто-проверялся (build/types/lint зелёные, API-контракт smoke-verified) — `npm run dev --workspace frontend` → `/rules`.
- **Файлы:** `frontend/src/api/tag-rules.ts`, `frontend/src/pages/rules/{tag-rule-schema.ts,tag-rules-section.tsx,rules-page.tsx}`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-28 — Phase 2 / scr-edit-rules UI (шаг 1/2): data-слой + форма КБЖУ

- **Сделано:** первая рабочая web-страница `/rules` на Untitled UI + фронтовый data-слой. Это шаг 1 из 2 для `scr-edit-rules` (форма целей КБЖУ; CRUD tag-rules — шаг 2).
  - **Backend:** `GET /api/users` (core `listUsers()` → id/email/createdAt) — для резолва userId без хардкода (auth отложена).
  - **Frontend data-слой:** `src/api/client.ts` (fetch-обёртка + ApiError, 204/404), `src/api/{users,nutrition-targets}.ts` (typed endpoints; GET target 404→null), `src/lib/query-client.ts` (QueryClient), `src/lib/use-current-user.ts` (useQuery(users) → первый userId, single-user dev).
  - **Форма:** `src/pages/rules/` — `form-schema.ts` (Zod, зеркало backend; NaN=пусто для React Aria NumberField, union с NaN для optional), `nutrition-target-form.tsx` (RHF + Controller + Untitled UI `InputNumber` + `Button`, useQuery prefill + useMutation PUT), `rules-page.tsx` (useCurrentUser → loading/empty/форма). `main.tsx` обёрнут в QueryClientProvider + роут `/rules`.
  - **Deps (frontend):** @tanstack/react-query, react-hook-form, @hookform/resolvers, zod.
- **Решения:** userId — **без хардкода** (требование пользователя): `GET /api/users` + первый юзер (single-user dev), заменяется при появлении auth. Своя Zod-схема на фронте (нельзя импортить core — тянет Prisma в браузер). RHF `Controller` для React Aria `InputNumber` (value:number/onChange:number). Плоский `<form>` (не AriaForm) — чтобы native-валидация не конфликтовала с RHF.
- **Столкнулся:** (1) `as typeof body` в fetch-обёртке схлопнул тип в `never` → явный type alias. (2) NumberField пустое поле = NaN; required Zod `.finite()` отвергает NaN (нужная ошибка), optional — `union([...,z.nan()])`, submit фильтрует `Number.isFinite`. (3) zsh: `UID` — зарезервированная переменная (как `status`), сломала smoke-скрипт → переименовал.
- **Статус:** `scr-edit-rules` остаётся **in_progress** (шаг 2 — CRUD tag-rules — закроет фичу + Phase 2). 16/37 без изменений.
- **Проверки:** frontend build (tsc -b + vite, 2553 modules) ✅, eslint+typecheck frontend ✅; core 68/68, tsc core/backend OK; next build (route `/api/users` зарегистрирован). **Smoke HTTP** (docker pg + next start + curl): GET /api/users → 3 юзера; flow useCurrentUser: первый userId → GET target 404 → PUT (kcal 2300, 1.6 г/кг) → GET persisted. ✅
- **НЕ проверено:** визуальный рендер формы в браузере (build/types/lint зелёные, API-контракт смоук-verified). `npm run dev --workspace frontend` → `/rules`.
- **Файлы:** `core/src/users/{service,index}.ts`, `backend/app/api/users/route.ts`, `frontend/src/api/{client,users,nutrition-targets}.ts`, `frontend/src/lib/{query-client,use-current-user}.ts`, `frontend/src/pages/rules/{form-schema,nutrition-target-form,rules-page}.tsx`, `frontend/src/main.tsx`, `core/src/index.ts`, `frontend/package.json`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-28 — Frontend: миграция на Untitled UI React (Tailwind v4) [инфра]

- **Сделано:** по явному запросу пользователя мигрировал frontend со SCSS modules на **Untitled UI React** (Tailwind CSS v4 + React Aria) как компонент-кит для всего приложения. Это инфра-итерация (НЕ закрывает фичу; готовит почву под UI `/rules`).
  - **MCP:** `claude mcp add --transport http untitledui https://www.untitledui.com/react/api/mcp --scope project` → `.mcp.json` (доступен со след. сессии; tools search/get_component, page templates, icons).
  - **Vendored kit:** скопировал из официального `untitledui-vite-starter-kit` в `frontend/src/`: `components/base` (69) + `components/foundations` (104) + `utils/` + `hooks/` + `providers/` = 173 файла. Heavy `application/` (charts/carousel/date-picker/qr) НЕ копировал — добавлю точечно через MCP/CLI по мере нужды.
  - **Deps (frontend):** tailwindcss@4 + @tailwindcss/vite + @tailwindcss/typography + tailwindcss-animate + tailwindcss-react-aria-components + @untitledui/icons + react-aria + react-aria-components + react-stately + tailwind-merge + input-otp + @react-aria/utils + @react-stately/utils. Удалён `sass`.
  - **Config:** vite.config (+@tailwindcss/vite plugin, +alias `@`→./src, сохранён /api proxy + порт 5173); tsconfig.app.json (jsx `preserve`, lib `ESNext`, +`@/*` paths, убраны `noUncheckedIndexedAccess`+`noImplicitOverride` — vendored код их не проходит, `strict` сохранён); main.tsx импортит `globals.css`; eslint игнорит vendored dirs; `typecheck` script → `tsc -b` (был no-op из-за files:[]). App.tsx переписан на Untitled UI Button + @untitledui/icons (проверка кита).
- **Столкнулся:** (1) CLI `npx untitledui init` падает на нашем monorepo-layout ("Unsupported project framework") → пошёл через clone starter-kit + ручной перенос. (2) build падал: `import React` unused (нужен jsx `preserve`), `.toArray()` на SetIterator (нужен lib `ESNext`), отсутствуют `@react-aria/utils`/`@react-stately/utils` (vendored код импортит напрямую, их не было в дереве — доустановил 3.34.1/3.12.1).
- **Решение / ARCHITECTURE:** §5 полностью переписан под Tailwind+Untitled UI; §2.2 таблица стека; §13 changelog с обоснованием (явная нужда = запрос пользователя). Это разрешённое изменение контракта (есть явная нужда + запись).
- **Проверки:** `npm run build --workspace frontend` (tsc -b + vite build, 2481 modules, CSS 152KB/21KB gz) ✅, eslint frontend ✅, typecheck frontend ✅. Регресс не задет: core 68/68, tsc core/backend/worker/llm-service OK.
- **НЕ проверено визуально:** рендер в браузере (dev-сервер) — пользователь может глянуть `npm run dev --workspace frontend`. Сборка зелёная, типы и Tailwind компилируются.
- **Файлы:** `frontend/src/components/**` (173 vendored), `frontend/src/{utils,hooks,providers}/**`, `frontend/src/styles/{globals,theme,typography}.css`, `frontend/src/{App,main}.tsx`, `frontend/{package.json,vite.config.ts,tsconfig.app.json,eslint.config.mjs}`, `.mcp.json` (новый), `docs/ARCHITECTURE.md` (§2.2/§5/§13).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-28 — Phase 2 / шаг 6: scr-edit-rules (backend CRUD nutrition rules)

- **Сделано:** backend-часть `scr-edit-rules` — CRUD service + REST для управления правилами питания (`tag_rules` + `nutrition_targets`). UI `/rules` — следующая итерация (backend-first, §5.3). Новый домен `core/src/rules/`:
  - `schemas.ts` — Zod: `nutritionTargetUpsertSchema`, `tagRuleCreateSchema` (с `superRefine`: quantity обязателен для MIN/MAX_PER_WEEK, mealTag для *_IN_MEAL), `tagRuleUpdateSchema` (partial, nullable-поля для очистки, отвергает пустой patch), `userIdQuerySchema`. `z.nativeEnum(RuleKind)` — синхрон с Prisma enum.
  - `nutrition-target-service.ts` — `getNutritionTarget(userId)`, `upsertNutritionTarget(input)` (1:1 upsert; Decimal принимает number).
  - `tag-rule-service.ts` — `listTagRules / createTagRule / updateTagRule / deleteTagRule`. update/delete → null/false если не найдено (route отдаёт 404 без Prisma-кодов).
  - Backend routes: `GET/PUT /api/nutrition-targets`, `GET/POST /api/tag-rules`, `PATCH/DELETE /api/tag-rules/[id]`.
- **Решение:** домен назван `rules/` (управление ДАННЫМИ правил), отдельно от `validation/` (движок ПРОВЕРКИ рецептов). Зафиксировал различие в barrel-комментариях. nutrition_targets через upsert (1:1), tag_rules через полный REST. Тонкие routes — вся логика в core (переиспользует Telegram-агент).
- **Столкнулся:** (1) eslint: `const {x: _omit, ...rest}` — `_omit` считается unused даже с подчёркиванием; переписал тест без destructure-omit. (2) Next.js 15: `params` в dynamic route `[id]` — это Promise, надо `await ctx.params`.
- **Статус:** `scr-edit-rules` → **in_progress** (backend готов; UI-форма `/rules` закроет фичу). Фичи done: 16/37 без изменений (in_progress ≠ done).
- **Проверки:** vitest core 68/68 (+12 rules schemas), tsc core/backend/worker clean, eslint core/backend clean, next build (3 новых route: /api/nutrition-targets, /api/tag-rules, /api/tag-rules/[id]). **Smoke end-to-end HTTP** (docker pg + next start + curl): PUT target (create→200, update kcal 2200→2400 upsert), GET 2400, POST BAN_TAG (201), POST MIN_PER_WEEK без quantity → **400** (superRefine через route), list total:1, PATCH isActive=false (200, Next15 async params), DELETE 204, повторный DELETE 404, list total:0. Всё ✓.
- **Файлы:** `core/src/rules/{schemas,nutrition-target-service,tag-rule-service,index,schemas.test}.ts` (5 новых), `backend/app/api/nutrition-targets/route.ts`, `backend/app/api/tag-rules/route.ts`, `backend/app/api/tag-rules/[id]/route.ts` (3 новых), `core/src/index.ts` (re-export), `core/package.json` (exports map).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-28 — Phase 2 / шаг 5: scr-search-recipes (генерация через llm-service + persist)

- **Сделано:** реализовал `scr-search-recipes` — генерация N рецептов под профиль через llm-service + сохранение с `is_relevant=true`. Новый домен `core/src/recipes/`:
  - `schemas.ts` — Zod: `searchRecipesInputSchema` (count 1..20 default 5, mealTags?, notes?) — то, что уходит в llm-service; `searchRecipesRequestSchema` (+ userId uuid) — вход service-функции; `llmRecipeSchema` + `searchRecipesOutputSchema` — то, что core ждёт обратно. Намеренное дублирование схем llm-service: каждая сторона валидирует независимо на границе HTTP (core НЕ импортирует из llm-service).
  - `llm-client.ts` — generic `runLlmJob<S>(...)`: `POST /jobs` → `POST /jobs/:id/wait` → Zod-валидация output. Env `LLM_SERVICE_URL` (default `http://localhost:3001`). Переиспользуем для будущих scr-calc-week-plan / scr-telegram-agent.
  - `mapper.ts` — pure `buildRecipeCreateInput(userId, llmRecipe)` → `Prisma.RecipeCreateInput` (source=LLM, isRelevant=true, rawIngredients = ingredients[] в форме RawIngredient, recipe_tags из mealTags с дедупом). Ингредиенты НЕ маппятся на каталог здесь — это контракт с scr-normalize-recipe.
  - `search-service.ts` — `searchRecipes(req)`: validate → user FK check → llm job → `prisma.$transaction` создаёт все рецепты атомарно → summary.
  - `backend/app/api/recipes/search/route.ts` — POST endpoint (400 invalid_body / 502 search_failed).
- **Столкнулся (баг в llm-service):** smoke упал на `HTTP 404 job_not_found` из `POST /jobs/:id/wait`. Причина: запись в `llm_jobs` (audit, ключ pgBossJobId) создаётся **лениво** в `handleJob` при pickup'е воркером, а wait-эндпоинт отвечал 404 на ПЕРВОЕ отсутствие записи — то есть в окне между enqueue и pickup. Я первый реальный потребитель `/wait`, поэтому гонка всплыла сейчас.
- **Решение:** wait-loop теперь трактует `audit == null` как нормальное pending-состояние (продолжает poll до deadline), а не 404. Bogus job-id → TIMEOUT 408 (приемлемо для long-poll). Минимальный фикс, без перестройки lazy-audit lifecycle.
- **Stub-first (как парсеры):** пайплайн работает end-to-end на StubAdapter. Реальная Claude-генерация (AnthropicAdapter + prompts/search-recipes.ts с инъекцией профиля/правил в system prompt) — backlog, нужен ANTHROPIC_API_KEY. Статус `done` потому что фича «генерация → persist с is_relevant=true → интеграция с БД» реализована (аналогия с scr-parse-5ka).
- **Закрыто как done:** `scr-search-recipes`. 16/37 фичей.
- **Проверки:** vitest core 56/56 (+15: 7 mapper + 8 schemas), tsc core/backend/worker/llm-service clean, eslint core/backend/llm-service clean, next build (route `/api/recipes/search` зарегистрирован). **Smoke end-to-end:** docker postgres + migrate deploy + llm-service(stub, pg-boss) + `searchRecipes({count:2})` → 2 рецепта persisted: source=LLM, is_relevant=true, is_normalized=false, rawIngredients (3 и 1 ингр. в форме RawIngredient), recipe_tags (lunch/high_protein, breakfast). `SMOKE_OK`.
- **Файлы:** `core/src/recipes/{schemas,llm-client,mapper,search-service,index,mapper.test,schemas.test}.ts` (7 новых), `backend/app/api/recipes/search/route.ts` (новый), `core/src/index.ts` (re-export), `core/package.json` (exports map), `llm-service/src/server.ts` (фикс /wait гонки).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-25 — Ralph Loop подготовка (документы + промпт)

- **Сделано:** подготовил 4 документа для запуска Ralph Loop:
  - `AGENTS.md` — паттерны/gotchas проекта (knowledge base для AI). Включает архитектуру в 1 строке, 4 источника правды, жёсткие правила, технический стек, workspace мапу, tag-based концепцию, LLM policy, mechanical verification команды, 10 gotchas из опыта.
  - `docs/PROGRESS.md` — append-only journal (Ralph пишет здесь учения между итерациями).
  - `docs/RALPH_PROMPT.md` — главный промпт цикла. Включает алгоритм одной итерации (12 шагов), критерии завершения (status="done" у всех 37 features → вывод `<promise>RALPH_DONE</promise>`), жёсткие запреты, протокол вопросов, стратегия выбора next task.
  - `docs/RALPH_GUIDE.md` — инструкции пользователю: 2 способа запуска (Anthropic plugin `/ralph-loop` + внешний bash скрипт), pre-flight чек-лист, остановка, troubleshooting, FAQ.
- **Исследование:** изучил 5 источников Ralph Loop — Anthropic plugin ralph-wiggum, snarktank/ralph, agenticloops-ai/ralph-loop scaffold, knightli.com explainer, blog.logrocket.com. Применил best practices: mechanical verification обязательна, AGENTS.md обновляется по ходу, items должны помещаться в один context, max-iterations для safety.
- **Адаптация под наш проект:** ROADMAP.json уже служит PRD (features со status≠"done" = stories to pass). HISTORY.md уже есть. Добавил отсутствующие компоненты: PROGRESS.md (Ralph journal), AGENTS.md (project patterns), RALPH_PROMPT.md (цикл-промпт), RALPH_GUIDE.md (инструкция).
- **Что НЕ делал:** не устанавливал плагин (это команда `/plugin install ralph-wiggum` от пользователя в Claude Code сессии). Не запускал цикл — это решает пользователь.
- **Файлы:** `AGENTS.md` (новый), `docs/PROGRESS.md` (новый), `docs/RALPH_PROMPT.md` (новый), `docs/RALPH_GUIDE.md` (новый), `docs/HISTORY.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-25 — Phase 2 шаг 4: llm-service skeleton + llm_jobs migration

- **Сделано:** реализовал llm-service workspace по контракту ARCHITECTURE §10:
  - **llm-service/** новый npm workspace: package.json (hono, @hono/node-server, pg-boss, zod, pino, tsx + core workspace dep), tsconfig.json (NodeNext ESM), eslint.config.mjs.
  - **src/adapters/adapter.ts**: interface LLMAdapter + Cost + GenerateArgs/Result типы.
  - **src/adapters/stub.ts**: StubAdapter — читает фикстуру `src/fixtures/<kind>.json` по convention `kind:<name>` в user prompt, валидирует Zod схемой, cost = 0.
  - **src/jobs/types.ts**: 3 kinds (search-recipes / calc-plan / agent-reply), Zod schemas per kind (input + output), `JOB_KINDS` const, `KIND_SCHEMAS` map.
  - **src/jobs/queue.ts**: pg-boss bootstrap + start/stop helpers. Auto-creates schema `pgboss` в Postgres.
  - **src/jobs/handler.ts**: generic handler — выбирает adapter по `LLM_MODE`, валидирует input, вызывает adapter.generateStructured, пишет audit в `llm_jobs`.
  - **src/server.ts**: Hono routes: GET /healthz, POST /jobs (enqueue), GET /jobs/:id (audit lookup), POST /jobs/:id/wait?timeout=N (long-polling), GET /kinds.
  - **src/index.ts**: bootstrap — boss.start() → createQueue+work per kind → Hono serve() → graceful SIGTERM/SIGINT.
  - **src/fixtures/search-recipes.json**: 2 stub-рецепта (куриная грудка с гречкой, творог с ягодами).
  - **Dockerfile**: multi-stage с tsx runtime (как worker).
  - **.dockerignore**, **.env.example**.
- **Prisma:** +`LlmJob` model + `LlmJobStatus` enum (PENDING/RUNNING/COMPLETED/FAILED). Audit-таблица для cost-tracking. Поля: pg_boss_job_id (unique), job_kind, user_id?, provider, model, status, input/output jsonb, tokens, cache_read/write, cost_usd Decimal, duration_ms, error?, timestamps. Миграция `llm_jobs` (20260524220950).
- **docker-compose.yml:** +service `llm-service` (depends_on postgres healthy, env DATABASE_URL/LLM_MODE/LLM_PROVIDER/ANTHROPIC_API_KEY/OPENAI_API_KEY, exposed 3001).
- **Dockerfile-ы (backend/frontend/worker):** +COPY llm-service/package.json в deps stage — нужно для npm ci workspaces.
- **root package.json:** +llm-service в workspaces, +npm scripts (llm:dev, llm:start, llm:typecheck).
- **Столкнулся:** (1) pg-boss 10 требует явный `boss.createQueue(name)` ДО `send/work` — раньше queue создавалась автоматически на work. Исправил в index.ts. (2) TypeScript не может narrow `KIND_SCHEMAS[kind]` discriminated union — cast `as ZodTypeAny` в handler (TODO: переделать как discriminated map). (3) `getBoss` imported но не использован (используется внутри send) — добавил `void getBoss` чтобы tsc принял.
- **End-to-end smoke (работает):**
  - docker compose up postgres + migrate deploy (llm_jobs created)
  - `tsx llm-service/src/index.ts` → 3 queue+worker registered → http listening на 3001
  - `curl /healthz` → `{status:ok, service:llm-service}` ✓
  - `POST /jobs {kind:search-recipes, input:{count:2}}` → `{jobId: uuid}` ✓
  - pg-boss подхватил, handler выполнил, StubAdapter вернул fixture, audit COMPLETED
  - `GET /jobs/:id` → COMPLETED + output (2 рецепта из фикстуры) + cost:0 ✓
- **Решение:** реализована только stub-имплементация. AnthropicAdapter и ClaudeCliAdapter — следующие итерации.
- **Проверки:** prisma migrate, tsc llm-service/core/backend, vitest core 41/41, eslint llm-service clean, smoke end-to-end.
- **Файлы:** llm-service/* (12 новых), core/prisma/schema.prisma (+LlmJob, +LlmJobStatus), core/prisma/migrations/20260524220950_llm_jobs/migration.sql, package.json (root), docker-compose.yml, backend/Dockerfile, frontend/Dockerfile, worker/Dockerfile (+COPY llm-service/package.json).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-25 — ARCHITECTURE: LLM микросервис + очередь pg-boss

- **Сделано:** обновил ARCHITECTURE.md под новые архитектурные решения до начала scr-search-recipes:
  - §9.4 (раньше LLM-policy в §9) → перенесено в новую большую **§10 LLM-сервис** (10 подсекций: обоснование, стек, структура, HTTP-контракт, job lifecycle, adapter contract, dev режимы, промпты, prompt caching, schema validation, error handling, cost tracking, безопасность).
  - §9 остался только Telegram-агента.
  - §11 (deploy, бывшая §10) — обновлена под 5 контейнеров (+llm-service). pg-boss tables создаются автоматически в Postgres schema `pgboss`.
  - §12 (repo structure) — +llm-service/.
  - §13 (changelog) — запись с обоснованием.
- **Решения (через AskUserQuestion с расширенным объяснением методов):**
  - LLM как **отдельный микросервис** сейчас (не позже)
  - **pg-boss** для очереди (postgres-native, без Redis) — пользователь явно сказал «простая очередь» + 2+ пользователей в перспективе + нет SLA от Anthropic
  - **Hono** HTTP framework (modern, type-safe, fast)
  - **Adapter pattern** (AnthropicAdapter first, OpenAI/Gemini ready)
  - **3 dev режима:** stub (фикстуры), cli (spawns `claude`), api (Anthropic SDK)
  - **Async job lifecycle** с long-polling endpoint (backend POST /jobs → wait → result)
- **Аргументация перед пользователем:**
  - Объяснил отличия Claude CLI vs API (CLI = только local dev, в prod не работает)
  - Расписал 6 методов fuzzy-match (pg_trgm vs JS string-similarity vs embeddings vs hybrid) — в прошлой итерации
  - Расписал 4 варианта LLM расположения (core/ vs микросервис vs HTTP-wrapper vs Python)
  - Аргументировал почему очередь нужна (decoupling, persistence, нет SLA)
- **Реализация (код, контейнеры, миграция llm_jobs)** — следующие итерации. ARCHITECTURE-first подход.
- **Файлы:** `docs/ARCHITECTURE.md` (major restructure §9-§13), `docs/HISTORY.md`, `docs/PLAN.md` (нужно поправить если упоминается старая §10).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-25 — Phase 2 / шаг 3: scr-normalize-recipe (pg_trgm + unit conversions)

- **Сделано:** реализовал normalizer рецептов — маппинг raw-имён (от LLM) на каталог через pg_trgm fuzzy match + конвертация единиц через таблицу unit_conversions + расчёт суммарных КБЖУ.
  - **Миграция `pg_trgm_and_units`**: `CREATE EXTENSION pg_trgm`, GIN trigram index на `ingredients.name`, новая таблица `unit_conversions` (id, unit, grams_per_unit, ingredient_tag?, is_system), seed 16 universal/tag-specific conversions (г, кг, мл, л, столовая/чайная ложка, шт for egg-tag, etc), `+Recipe.rawIngredients Json?` для хранения LLM-output до normalization.
  - `core/src/normalization/types.ts` — RawIngredient, MatchedIngredient, NormalizationResult, MatchConfig (default threshold 0.3).
  - `core/src/normalization/unit-conversion.ts` — pure-функция `convertToGramsWith(conversions, qty, unit, tags)` + DB-wrapper `convertToGrams` с in-memory cache.
  - `core/src/normalization/fuzzy-match.ts` — `findBestIngredientMatch(rawName, config)` через `prisma.$queryRaw` с `similarity()`.
  - `core/src/normalization/normalizer.ts` — DB-wrapper `normalizeRecipe(recipeId)`: читает raw_ingredients → fuzzy + convert per item → totals inline → transaction (deleteMany + createMany + update recipe). Warning при weak match (sim < 0.5) или failed conversion.
- **Решения через AskUserQuestion (с расширенным объяснением методов):** pg_trgm для MVP (бесплатно, быстро, стандарт Postgres). Unit conversion table (не hardcode — расширяемо). Threshold 0.3 + warning (не fail). Эволюционный план: LLM-валидатор поверх pg_trgm в Phase 3+ при первых промахах; pgvector + embeddings — если каталог разрастётся.
- **Тесты (8 для unit-conversion):** базовые grams, кг→1000, ложка→15, case-insensitive+trim, шт+egg тэг, шт без тэга → null+reason, неизвестный unit, приоритет tag-specific над universal.
- **Smoke:** seed:5ka заполнил ingredients → pg_trgm SQL запрос `similarity(name, 'молоко')` вернул «Молоко лактозо-свободное 1.5%» (sim=0.24); query `similarity('куриная грудка')` нашёл «Куриное филе охлаждённое» (sim=0.15). Pg_trgm работает, GIN-индекс используется.
- **Закрыто как done:** `scr-normalize-recipe`. 15/37 фичей.
- **Проверки:** prisma format/validate/generate, migrate deploy (+pg_trgm extension, +GIN index, +unit_conversions с 16 seed rows), vitest 41/41 (8 новых + 33 предыдущих), tsc core+backend+worker clean.
- **Файлы:** `core/prisma/schema.prisma` (+UnitConversion model, +Recipe.rawIngredients), `core/prisma/migrations/20260524213604_pg_trgm_and_units/migration.sql` (с manual CREATE EXTENSION + GIN + 16 seed inserts), `core/src/normalization/{types,unit-conversion,fuzzy-match,normalizer,index,unit-conversion.test}.ts`, `core/src/index.ts`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-25 — Phase 2 / шаг 2: scr-validate-recipes (tag-based rule engine)

- **Сделано:** реализовал валидатор рецептов по контракту из ARCHITECTURE §7.3.
  - `core/src/validation/types.ts` — ValidationInput/Result, RuleSnapshot, IngredientView. Не зависит от Prisma model'ей — это контракт ядра.
  - `core/src/validation/evaluate-rules.ts` — **pure function** evaluateRules({ingredients, recipeMealTags, rules}). Switch по ruleKind: BAN_TAG / BAN_TAG_IN_MEAL / REQUIRE_TAG_IN_MEAL. MIN/MAX_PER_WEEK игнорируются на recipe-level (week-only). Exception_tag bypass работает. Собирает rejection_reasons с прикреплённым ингредиентом и `rule.reason`.
  - `core/src/validation/recipe-validator.ts` — DB-wrapper validateRecipe(recipeId): fetch recipe+ingredients+tags+user's TagRule[] → evaluateRules → UPDATE recipe (is_approved, is_normalized=true, rejection_reasons[]). Лог через pino с recipeId+rulesEvaluated+rejectionCount.
  - `core/src/validation/index.ts` — barrel. core/src/index.ts — re-export.
- **Тесты (10):** пустой+0 rules / BAN_TAG hit / BAN_TAG miss / BAN_TAG_IN_MEAL match / BAN_TAG_IN_MEAL miss / REQUIRE met / REQUIRE missing / exception_tag bypass / MIN/MAX_PER_WEEK ignored / multi-violation accumulation. Pure-функция → без mock Prisma, всё детерминированно.
- **Решение:** Pure-function core + thin DB-wrapper. Это даёт (1) лёгкие тесты, (2) переиспользование evaluateRules для week-plan calc-у (в Phase 3 можно проверить рецепты пачкой без N round-trip-ов в БД).
- **Закрыто как done:** `scr-validate-recipes`. 14/37 фичей.
- **Проверки:** vitest 33/33 (10 новых + 23 предыдущих), tsc clean в core/backend/worker, eslint clean.
- **Файлы:** `core/src/validation/{types,evaluate-rules,recipe-validator,index,evaluate-rules.test}.ts` (5 новых), `core/src/index.ts` (re-export).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-25 — Архитектурный апдейт: 6 drift-фиксов + 4 новые концепции

- **Сделано:** ARCHITECTURE.md приведён в соответствие с кодом + явно зафиксированы концепции, которые накопились в коде но не были в контракте.
- **Drift fixes:**
  - §4.1: убрана старая `backend/lib/` структура, ссылка на `core/`
  - §4.2: добавлено про service-функции в `core/src/<domain>/`, единая Zod-схема для REST + agent tools, Next.js webpack interop
  - §6: tsx-runtime worker явно зафиксирован
  - §8.4: stub-first / API-second стратегия парсеров с идемпотентностью на уровне DB unique
  - §10.1: фактическая docker compose конфигурация с root build context + core/prisma
- **Новые концепции:**
  - **§5.3 UI strategy:** backend-first, UI в конце Phase (явное решение пользователя)
  - **§7.2 Tag-based:** центральный концепт Phase 2 с полной таблицей маппинга правил → tag_rules строк
  - **§7.3 Validator engine:** контракт `validateRecipe()`, SQL-only подход, recipe-level vs week-level правила
  - **§9.4 LLM policy:** код в core/src/llm/, промпты как файлы, Zod-валидация ответа, retry policy, cost logging
- **Решение:** все 10 правок одним коммитом (вариант 1 из AskUserQuestion). UI-стратегия = backend-first.
- **Файлы:** `docs/ARCHITECTURE.md` (major), `docs/HISTORY.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-25 — Phase 2 / шаг 1: tag-based схема (recipes + nutrition_rules)

- **Сделано:** расширил `core/prisma/schema.prisma` 7 новыми моделями + 1 расширение существующей:
  - `Tag` (table `tag_dictionary`) + `TagCategory` enum [NUTRIENT, ALLERGEN, CATEGORY, BEHAVIOR, MEAL_TAG, OTHER]
  - `Ingredient.tags String[]` + manual GIN индекс `ingredients_tags_gin` (Prisma не умеет inline GIN, добавил CREATE INDEX в migration.sql вручную)
  - `NutritionTarget` (1:1 user) — целевые КБЖУ + бюджет
  - `TagRule` + `RuleKind` enum [BAN_TAG, BAN_TAG_IN_MEAL, REQUIRE_TAG_IN_MEAL, MIN_PER_WEEK, MAX_PER_WEEK] — все правила питания через теги
  - `Recipe` (per-user FK) + `RecipeSource` enum [LLM, MANUAL, IMPORTED] — статус-флаги is_relevant/is_normalized/is_approved, total_kcal/protein/fat/carbs Decimal
  - `RecipeIngredient` junction (qty_g, fresh_addon, note)
  - `RecipeTag` junction (для scope правил MEAL_TAG)
  - Связи на User: + nutritionTarget, tagRules[], recipes[]
- **AskUserQuestion (по архитектуре Phase 2):**
  - **Tag-based vs нормализованная 5-табличная схема:** пользователь предложил tag-based архитектуру (теги на ингредиентах → правила = SQL по тегам). Принято. Распиал, как иначе бы выглядела 5-табличная (nutrition_targets/banned_ingredients/dietary_restrictions/dish_frequency_rules/custom_rules), но tag-based проще и гибче.
  - **Recipes:** per-user (LLM генерит под индивидуальный профиль).
  - **Recipe totals:** stored как Decimal (для быстрых выборок в plan-алгоритме).
  - **Tag dictionary:** отдельная таблица tag_dictionary с категорией (не FK, loose coupling — UI берёт автокомплит).
- **Миграция:** `prisma migrate dev --create-only --name recipes_and_rules`, manual append GIN index, `migrate deploy`. Postgres: 14 таблиц (+6 новых: nutrition_targets, recipe_ingredients, recipe_tags, recipes, tag_dictionary, tag_rules). `\d ingredients` показал `tags text[]` + `ingredients_tags_gin gin (tags)`.
- **Smoke:** insert 3 tags в tag_dictionary, UPDATE ingredients SET tags = '...', SELECT WHERE 'lactose' = ANY(tags) — вернул 2 строки (молоко). Tag-based queries работают.
- **Закрыто как done:** `ent-nutrition-rules`, `ent-recipes`. 13/37 фичей.
- **Проверки:** prisma format/validate/generate, migrate deploy (14 таблиц), tsc в core/backend/worker, vitest 23/23 — все зелёные.
- **Файлы:** `core/prisma/schema.prisma` (расширение), `core/prisma/migrations/20260524210257_recipes_and_rules/migration.sql` (+manual GIN index), `docs/ROADMAP.json`, `docs/HISTORY.md`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — ✅ Phase 1 закрыта: 3 P2-парсера + полный pipeline 4 источников

- **Сделано:** cookie-cutter копии five-ka каталога в `core/src/parsers/{tseh,ll,vv}/` (8 файлов в каждом). Python-скрипт с sed-replace: имена классов, IngredientSource enum (FIVEKA→TSEH/LL/VV), prisma model refs (source5ka→sourceTseh/sourceLl/sourceVv), env vars, fixture metadata. Дополнил `core/src/index.ts` экспортами `importTseh, importLl, importVv`. Создал в worker 3 jobs (`parse-tseh.ts`, `parse-ll.ts`, `parse-vv.ts`) и 3 CLI seed-* через шаблон. Зарегистрировал 3 cron-задачи (15/30/45 субботы — каждая 15 мин после 5K). Добавил scripts в worker/package.json.
- **End-to-end smoke (полный pipeline):**
  - docker compose up postgres → migrate deploy → ✓
  - 4 seed-* запуска подряд → каждый говорит `ingredientsUpserted: 5` ✓
  - psql query → ingredients = 20 (5×4), source_*  = 1 snapshot each ✓
  - Повторный прогон 4 seed-* → ingredients остаётся 20 (UPSERT idempotency ✓), source_5ka snapshot=4 (4 запуска суммарно), tseh/ll/vv=2 (2 запуска). Append-only sources работает ✓
- **Решение:** Cookie-cutter копирование 5К-парсера в 3 другие папки. Refactor в общий generic-парсер отложен — реальные API endpoints магазинов будут различаться, и абстракция получится преждевременной. После того как 2+ реальных парсера заработают, можно выделить общее.
- **Закрыто как done:** `scr-parse-tseh`, `scr-parse-ll`, `scr-parse-vv`. 
- **Phase 1 ✅ DONE.** 11/37 фичей готово. Перенесена в «История фаз» в PLAN.md с полным summary.
- **Проверки:** vitest (23/23: 4×4 mapper + 7 schemas) ✅, tsc core+worker ✅, smoke 4 sources × 2 прогона ✅.
- **Файлы:** 24 новых файла в core/src/parsers/{tseh,ll,vv}, 6 файлов в worker/src/{jobs,cli}, обновления в core/src/index.ts, worker/src/index.ts, worker/package.json, docs/ROADMAP.json, docs/PLAN.md.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 1 / шаг 4: Worker cron + seed CLI; scr-parse-5ka DONE

- **Сделано:**
  - `worker/package.json`: добавил `"core": "*"` как dep, перенёс tsx в `dependencies` (нужна в runtime), упростил scripts (`start: tsx src/index.ts`, `seed:5ka: tsx src/cli/seed-5ka.ts`). Убрал tsc-build из worker (worker запускается через tsx и в prod — KISS, без bundling-шага).
  - `worker/src/jobs/parse-5ka.ts`: cron-задача дёргает `importFiveKa` из 'core'.
  - `worker/src/cli/seed-5ka.ts`: one-shot CLI для smoke-тестов (`npm run seed:5ka --workspace worker`).
  - `worker/src/index.ts`: зарегистрирован cron `0 3 * * 6` (Сб 03:00) для parse-5ka.
  - `worker/tsconfig.json`: noEmit=true (tsc только для typecheck).
  - `worker/Dockerfile`: добавил `prep` stage с `prisma generate` (для core), runner копирует core/+worker/ и запускает `npx tsx worker/src/index.ts`.
- **End-to-end smoke (полный pipeline):**
  - docker compose up postgres → миграции уже применены.
  - `npm run seed:5ka --workspace worker` → 5 products parsed → 5 ingredients UPSERTed → source_5ka snapshot создан. Лог: `productsTotal:5, ingredientsUpserted:5, elapsedMs:40`.
  - `next start` + `curl /api/ingredients?limit=10` → 200 с массивом 5 items (КБЖУ + price_per_100g + packSize + unit — всё корректно).
  - **Idempotency**: повторный seed-5ka → новый sourceId (source_5ka append-only ✓), но `/api/ingredients` всё ещё `total=5` (UPSERT по unique key (name, source, pack_size) не дублирует ✓).
- **Решение:** Worker использует `tsx` и в production (вместо `tsc → dist/`). Причина: core экспортирует TS-исходники (`main: ./src/index.ts`), Node не запустит `.ts` напрямую; bundling-шаг = overkill при текущем масштабе. tsx добавляет ~5MB в runtime образ — приемлемо.
- **Закрыто как done:** `scr-parse-5ka` (stub-pipeline работает; реальный API через DevTools-endpoints — отдельная improvement-задача, статус `done` потому что фича «парсинг + idempotent импорт + интеграция с БД» реализована).
- **Проверки:** `npm install`, `tsc --noEmit` в worker и core, `prisma migrate deploy`, `seed:5ka` (×2 идемпотентно), `next start` + `curl /api/ingredients`, `docker compose down` — всё зелёное.
- **Файлы:** `worker/package.json`, `worker/tsconfig.json`, `worker/Dockerfile`, `worker/src/index.ts`, `worker/src/jobs/parse-5ka.ts` (new), `worker/src/cli/seed-5ka.ts` (new), `docs/ROADMAP.json` (scr-parse-5ka → done), `docs/HISTORY.md`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Рефакторинг: shared workspace `core/`

- **Сделано:** создал 4-й npm workspace `core/` со своим package.json (deps: @prisma/client, pino, zod; dev: prisma, vitest, typescript, eslint, typescript-eslint), tsconfig (NodeNext ESM strict), eslint config, vitest config. Перенёс через `git mv` (rename detection сохранён): `backend/prisma/` → `core/prisma/`, `backend/lib/db.ts` → `core/src/db.ts`, `backend/lib/parsers/` → `core/src/parsers/`, `backend/lib/ingredients/` → `core/src/ingredients/`. Создал `core/src/index.ts` (barrel-экспорты). Добавил `core` в `package.json` workspaces. Backend depends on core через `"core": "*"`. backend route `/api/ingredients` теперь импортирует `import { listIngredientsQuerySchema, listIngredients } from 'core'`.
- **Решение (через AskUserQuestion):** вариант 1 — общая библиотека `core/`. Закрыт TBD из ARCHITECTURE.md §6. Phase 2-6 будут активно складывать сюда shared services (recipes, validation, plan calc, agent-tools).
- **Столкнулся:** (1) NodeNext-ESM требует явные `.js`-расширения в relative imports. Прогнал sed-замену по всем файлам core/src. (2) Webpack Next.js не понимает `.js→.ts` ремаппинг. Решение: `transpilePackages: ['core']` + `webpack.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] }` в next.config.ts. (3) Backend остался без тестов (все ушли в core). Решение: `vitest run --passWithNoTests`.
- **Dockerfiles:** обновил backend/frontend/worker — добавил `COPY core/package.json` в deps stage и `COPY core ./core` в builder stage. Backend builder делает `prisma generate` уже из `core/` (где лежит schema).
- **ARCHITECTURE.md §6:** TBD убран, описана структура core/. §12: добавлен `core/` в дерево репозитория. Changelog (§13) дополнен.
- **Проверки:** `npm install` OK, `prisma generate` (из core), `tsc --noEmit` в core ✅ и backend ✅, `vitest run` в core (11/11) ✅, в backend (no tests, exit 0) ✅, `eslint` в core/backend ✅, `next build` ✅.
- **Файлы:** новые `core/{package.json,tsconfig.json,eslint.config.mjs,vitest.config.ts}`, `core/src/index.ts`. Переименованы (git mv): 12 файлов из `backend/{prisma,lib}` в `core/{prisma,src}`. Изменены: `package.json` (root, workspaces+scripts), `backend/{package.json,next.config.ts,Dockerfile,app/api/ingredients/route.ts}`, `frontend/Dockerfile`, `worker/Dockerfile`, `docs/ARCHITECTURE.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 1 / шаг 3: GET /api/ingredients с пагинацией

- **Сделано:** layered endpoint:
  - `backend/lib/ingredients/schemas.ts` — Zod-схема query params (limit 1..200 default 50, offset ≥0 default 0, source enum, q text search). Coerce строковых query → числа.
  - `backend/lib/ingredients/service.ts` — `listIngredients({limit, offset, source, q})` через `prisma.ingredient.findMany` + `count`, фильтр по source и `name contains` (mode: insensitive), сортировка name ASC, возвращает {items, total, limit, offset}.
  - `backend/app/api/ingredients/route.ts` — thin GET handler: парсит query → Zod → service → JSON. 400 при невалидных params с `details: ZodError.flatten()`.
- **Тесты:** 7 юнит-тестов на Zod-схему (дефолты, coerce, валидные/невалидные source, границы limit/offset, trim+min-length q). Suite passing 11/11 (4 mapper + 7 schemas).
- **Smoke против live Postgres:** docker compose up postgres, next start, curl `/api/ingredients?limit=10` → 200 `{items:[], total:0, limit:10, offset:0}`. curl `?source=OZON` → 400 с Zod-details (`Invalid enum value... received 'OZON'`). docker compose down — clean.
- **Решение:** Layered подход (schema + service + route) — те же service-функции переиспользуются в Telegram-агенте через tool-use (см. ARCHITECTURE.md §9.2: «Tool definitions для агента — генерируются из тех же Zod-схем»).
- **Проверки:** vitest (11/11), tsc, next build, eslint, smoke curl — все зелёные.
- **Файлы:** `backend/lib/ingredients/{schemas,service,schemas.test}.ts`, `backend/app/api/ingredients/route.ts`, `docs/HISTORY.md`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 1 / шаг 2: парсер 5К каркас + Vitest

- **Сделано:** написал каркас парсера 5К в `backend/lib/parsers/five-ka/`: `types.ts` (FiveKaProduct shape per `data/ingredients_spb.json` из main), `parser.ts` (interface + env-фабрика stub/api), `stub-parser.ts` (читает фикстуру), `api-parser.ts` (skeleton с JSDoc-инструкцией, как пользователь должен достать endpoints/cookies из DevTools), `mapper.ts` (FiveKaProduct → `Prisma.IngredientCreateInput`, считает price_per_100g, Decimal), `importer.ts` (INSERT в source_5ka + idempotent UPSERT в ingredients по unique key (name, source, pack_size)). Поднял Vitest в backend, 4 юнит-теста маппера зелёные.
- **Решение:** Сегодня — только каркас. Реальный API подключим в следующей итерации после того, как пользователь предоставит endpoints из DevTools (5ka.ru блокирует WebFetch 403). До этого парсер работает на фикстуре (`FIVEKA_PARSER_MODE=stub` default). Сценарий: можно сейчас запустить весь pipeline на 5 mock-позициях, проверить идемпотентность UPSERT, и не блокировать downstream Phase 2-4.
- **Маппер-правила:** source=FIVEKA, externalCode=String(plu), КБЖУ напрямую (5К отдаёт на 100г), price_per_100g = regular*100/weightG если оба есть, packSize=weight.label.
- **Status:** `scr-parse-5ka` → in_progress (done после успешного импорта реального снимка 5К).
- **Проверки:** `npm install` (vitest), `npm run test` (4/4 passed), `tsc --noEmit` clean, `next build` OK, `eslint` clean.
- **Файлы:** `backend/lib/parsers/five-ka/{types,parser,stub-parser,api-parser,mapper,importer,mapper.test}.ts`, `backend/lib/parsers/five-ka/__fixtures__/sample.json`, `backend/vitest.config.ts`, `backend/package.json` (+vitest, +test scripts), `docs/ROADMAP.json`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 1 / шаг 1: схема каталога (5 entities закрыто)

- **Сделано:** расширил `backend/prisma/schema.prisma` 5 моделями: `Source5ka`, `SourceTseh`, `SourceLl`, `SourceVv` (4 append-only журнала парсеров) и `Ingredient` (общий каталог) + enum `IngredientSource` (FIVEKA/TSEH/LL/VV/CUSTOM). Сгенерировал миграцию `20260524200347_catalog` через `prisma migrate dev --create-only`, применил через `migrate deploy`. `\dt` показывает 8 таблиц.
- **Решение (через AskUserQuestion):** (1) Scope — **global catalog** (без user_id FK). Каталог 5К одинаков для всех; кастомные ингредиенты добавим отдельным механизмом позже. (2) Source-таблицы — **append-only** с `parsed_at DESC` индексом. Каждый запуск парсера = новая запись; история нужна для сравнения парсов и отлова регрессов; свежий снимок = `ORDER BY parsed_at DESC LIMIT 1`.
- **Дизайн:** sources — единая shape (`id, parsed_at, raw jsonb, summary jsonb, timestamps`). Ingredient — поля per ROADMAP (`name, source, external_code, kcal/protein/fat/carbs_100g Decimal, price_per_100g Decimal, weight_g, pack_size, unit`). Unique (name, source, pack_size). Decimal для точных расчётов КБЖУ/цен.
- **Закрыто как done:** `ent-source-5ka`, `ent-source-tseh`, `ent-source-ll`, `ent-source-vv`, `ent-ingredients`. Итого 7/37 фичей done.
- **Проверки:** `prisma format/validate/generate`, `migrate deploy` (8 таблиц в БД), `tsc --noEmit`, `next build`, `eslint`, `docker compose down` — все зелёные.
- **Файлы:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260524200347_catalog/migration.sql`, `docs/ROADMAP.json`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — ✅ Phase 0 закрыта: Docker compose + migrate deploy

- **Сделано:** написал 3 multi-stage Dockerfile (backend node:22-alpine, frontend node→nginx:1.27-alpine, worker node→alpine с tini), `nginx.conf` с SPA fallback + `/api/` proxy на backend:3000, корневой `docker-compose.yml` с 4 сервисами (postgres:16-alpine, backend, worker, frontend) + healthcheck на postgres + depends_on с service_healthy + volume `postgres_data`. `.dockerignore` в каждом workspace. Корневой `.env.example` + локальный `.env`.
- **Проверка end-to-end:** Поднял Colima (был не запущен), установил docker-compose plugin v5.1.4 через brew, прописал `cliPluginsExtraDirs` в `~/.docker/config.json`. `docker compose up -d postgres` → healthy. `npx prisma migrate deploy` с DATABASE_URL=localhost:5432 → миграция `20260524192718_init` применилась. `\dt` показал `users`, `profiles`, `_prisma_migrations`. `\d users` → PK, unique email, FK references из profiles. `docker compose up -d` (вся четвёрка) → все Up. `curl localhost:3000/api/health` → 200 `{status:ok}`. `curl localhost:8080/api/health` (через frontend nginx-proxy) → 200 — **full-stack integration works**. Worker логи: `worker started`. `docker compose down` — clean.
- **Столкнулся:** (1) Docker daemon (Colima) был остановлен — пользователь запустил Colima самостоятельно по AskUserQuestion-ответу. (2) `docker compose` plugin отсутствовал — поставил через `brew install docker-compose` + добавил `cliPluginsExtraDirs`. (3) Первая попытка build падала на `COPY --from=deps /repo/backend/node_modules` — npm workspaces hoist'ит все deps в корневой `node_modules/`, workspace-папок node_modules вообще не существует. Убрал лишние COPY. (4) Frontend build падал на `error TS2307: Cannot find module './App.module.scss'` — не было `src/vite-env.d.ts` (стандартный файл из create-vite с `/// <reference types="vite/client" />`). Добавил.
- **Решение:** Базовые образы — alpine (минимальный размер). В worker — `tini` как PID 1 для корректного SIGTERM (без него Node не получает сигнал). Frontend production = nginx serving static + reverse-proxy на backend. Postgres expose:5432 на хост для удобства миграций/psql с хоста.
- **Закрыто как done:** `ent-users`, `ent-profile` (миграция применена, таблицы существуют, FK работает).
- **Проверки:** docker compose config, build × 3 image, up -d, healthcheck postgres, prisma migrate deploy, psql \dt + \d users, curl × 3 endpoints (backend, frontend, proxy), worker logs, docker compose down — все зелёные.
- **Файлы:** `backend/Dockerfile`, `backend/.dockerignore`, `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/nginx.conf`, `frontend/src/vite-env.d.ts`, `worker/Dockerfile`, `worker/.dockerignore`, `docker-compose.yml`, `.env.example`, `docs/ROADMAP.json` (ent-users + ent-profile → done).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 0 / шаг 4: Prisma + первая миграция (ent-users + ent-profile)

- **Сделано:** подключил Prisma 6 в backend (`prisma` dev + `@prisma/client` dep + 4 npm-скрипта prisma:*). Создал `backend/prisma/schema.prisma` с моделями `User` (id uuid, email unique, timestamps) и `Profile` (1:1 с User через `user_id` unique FK + onDelete: Cascade; поля: firstName, lastName, locale='ru', timestamps). Snake_case колонки через `@map`, snake_case таблицы через `@@map("users"/"profiles")`. Сгенерировал миграцию `20260524192718_init/migration.sql` через `prisma migrate diff --from-empty` — не требует живого Postgres. `backend/lib/db.ts` — singleton PrismaClient (защита от множественных коннектов в dev hot-reload).
- **Решение:** UUID v4 как PK (Prisma default uuid). Антропометрия (рост/вес/возраст) НЕ в Profile — пойдёт в `health_records` (Phase 3). Auth-поля (password/sessions) тоже не сейчас — добавим с Auth.js. Prisma живёт в backend; worker подключится к этому же schema позже (Phase 1+) — точная схема импорта решится при первом cron-парсере.
- **Столкнулся:** `prisma validate` ругался на отсутствие `DATABASE_URL` env. Workaround: inline-передал env var для validate. Для format/generate переменная не нужна.
- **Проверки:** `prisma format`, `prisma validate` (с env), `prisma generate` → client в `node_modules/@prisma/client` (v6.19.3), `tsc --noEmit`, `next build`, `eslint` — все зелёные.
- **Файлы:** `backend/package.json`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260524192718_init/migration.sql`, `backend/prisma/migrations/migration_lock.toml`, `backend/lib/db.ts`, `docs/ROADMAP.json` (ent-users, ent-profile → in_progress).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`
- **Заметка:** Status `done` для ent-users/ent-profile поставим после применения миграции к живому Postgres в следующей итерации (docker-compose).

---

## 2026-05-24 — Phase 0 / шаг 3: Worker (node-cron) скелет

- **Сделано:** создал `worker/` workspace: чистый Node.js + TypeScript (NodeNext ESM) + node-cron + pino. `src/index.ts` стартует процесс, логирует pid+node version, регистрирует minute-heartbeat cron (debug-уровень), обрабатывает SIGTERM/SIGINT с graceful shutdown (stop cron → 500ms grace → exit 0). Билд: tsc → `dist/index.js`. Dev-режим: `tsx watch`.
- **Решение:** worker = отдельный workspace без Next.js / React / Prisma пока. Prisma подключим вместе с первой миграцией (следующая итерация). Логи — pino JSON в stdout (Docker сам подхватит в `journalctl`).
- **Проверки:** `npm install` OK, `npx tsc --noEmit` clean, `npx tsc` (build) → `dist/index.js`, `node dist/index.js` запустился и при SIGTERM показал лог-цепочку `worker started → shutdown requested → worker stopped`. ESLint clean.
- **Файлы:** `worker/package.json`, `worker/tsconfig.json`, `worker/src/index.ts`, `worker/eslint.config.mjs`, `worker/.prettierrc.json`, `worker/.env.example`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 0 / шаг 2: Frontend (Vite + React) скелет

- **Сделано:** создал `frontend/` workspace: Vite 6 + React 19 + TypeScript strict + SCSS modules + React Router v7. Структура: `package.json`, project-references `tsconfig.json` (`.app.json` для src, `.node.json` для vite.config), `vite.config.ts` с dev-proxy `/api → :3000`, `index.html`, `src/main.tsx` (createBrowserRouter + RouterProvider), `src/App.tsx` со ссылкой на `App.module.scss`, design tokens в `src/styles/variables.scss` (цвета, отступы, типографика, breakpoints), `reset.scss` (минимальный modern reset), `global.scss` (применение токенов к body). ESLint 9 flat config с react-hooks + react-refresh плагинами.
- **Решение:** Vite 6 (не 5) — текущий stable. Project references в tsconfig (`-b` build) — стандартный паттерн create-vite. Минимум зависимостей: только react / react-dom / react-router. TanStack Query, Zustand, RHF — добавятся, когда понадобится первый API-вызов / state / форма (Phase 2+).
- **Проверки:** `npm install` (319 пакетов в frontend, lockfile обновлён), `npx tsc --noEmit` (clean), `npx vite build` (39 modules, 541ms, dist/index.html + CSS + JS bundle), `npx eslint .` (clean).
- **Файлы:** `frontend/package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.module.scss`, `src/styles/{variables,reset,global}.scss`, `eslint.config.mjs`, `.prettierrc.json`, `.env.example`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 0 / шаг 1: Backend (Next.js) скелет

- **Сделано:** создал monorepo-структуру (npm workspaces в корне `package.json`, `.nvmrc=22`) и `backend/` с Next.js 15 App Router. Backend содержит: `package.json` (next@15, react@19, pino, zod), `tsconfig.json` (strict + noUncheckedIndexedAccess + noImplicitOverride), `next.config.ts`, ESLint 9 flat config (`eslint.config.mjs` с typescript-eslint), Prettier, `.env.example` со всеми будущими секретами (DATABASE_URL, ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, APPLE_ID, и т.д.), минимальный `app/layout.tsx` (требование App Router), `app/api/health/route.ts` (GET → {status, time, version}).
- **Решение:** **npm + npm workspaces** вместо pnpm — на машине пользователя нет pnpm/corepack, npm 11 уже установлен, для текущего масштаба workspace-функциональности npm хватает. Можно мигрировать на pnpm позже без боли. Node `.nvmrc=22` (LTS, целевой Docker base image), хотя локально у пользователя 26.
- **Столкнулся:** (1) Next.js при первом build авто-дописал `allowJs: true` в tsconfig.json — оставил как есть (intentional). (2) ESLint ругался на `next-env.d.ts` (auto-generated) — добавил в ignores eslint config.
- **Проверки:** `npm install` (321 пакет, OK), `npx tsc --noEmit` (no errors), `npx next build` (Compiled successfully, /api/health зарегистрирован как dynamic route), `npx eslint .` (clean).
- **Файлы:** `package.json`, `package-lock.json`, `.nvmrc`, `backend/package.json`, `backend/tsconfig.json`, `backend/next.config.ts`, `backend/eslint.config.mjs`, `backend/.prettierrc.json`, `backend/.env.example`, `backend/app/layout.tsx`, `backend/app/api/health/route.ts`, `backend/next-env.d.ts`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Назначены фазы 0–6 и приоритеты всех 37 фичей

- **Сделано:** заполнил `docs/PLAN.md` конкретными фазами 0–6 со списками `feature_id`, целями, acceptance-criteria и открытыми вопросами. Проставил `phase`/`priority`/`needed_now` для всех 37 фичей в `docs/ROADMAP.json`. Распределение: Phase 0=2, 1=9, 2=6, 3=7, 4=4, 5=6, 6=3. По приоритету: P0=20, P1=7, P2=10. `needed_now=true` — только у Phase 0 (старт). Добавил `.gitignore` правила для node/env/iteration-scratch.
- **Решение:** group-by по 4 уточнённым вопросам (AskUserQuestion): `ent-health-records` → Phase 3; парсеры — только 5К как P0, остальные P2 в той же Phase 1; UI-редакторы (`scr-edit-rules`, `scr-edit-schedule`) — рядом со своей сущностью (вертикальный slicing); `scr-correct-plan` → Phase 5.
- **Файлы:** `docs/ROADMAP.json`, `docs/PLAN.md`, `docs/HISTORY.md`, `.gitignore`
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Инициализация документации проекта

- **Сделано:** создана 4-файловая система документации в `App/docs/`:
  - `ROADMAP.json` (уже был, обновлён стек)
  - `ARCHITECTURE.md` (создан, полный контракт системы)
  - `PLAN.md` (создан, скелет фаз)
  - `HISTORY.md` (создан, эта запись)
- **Решение:** разделил backend (Next.js — только API + worker) и frontend (Vite/React SPA). Styling — SCSS modules вместо Tailwind/shadcn (явное решение пользователя на простой стек). ORM — Prisma (выбор между Prisma и Drizzle).
- **Также:** обновлён `App/CLAUDE.md` с обязательными правилами для AI-агента — всегда читать 4 документа и обновлять `HISTORY.md` после каждой итерации.
- **Файлы:** `App/CLAUDE.md`, `App/docs/ARCHITECTURE.md`, `App/docs/PLAN.md`, `App/docs/HISTORY.md`, `App/docs/ROADMAP.json` (stack section update).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — ROADMAP заполнен фичами (16 entities + 18 scripts)

- **Сделано:** разобрал рукописные заметки пользователя, обсудил критически концепцию, добавил недостающее (Каталог ингредиентов, План недели, История заказов, Пользователи), разделил «Состояние человека» на `profile` + `health_records`, объединил релевантные+одобренные рецепты в одну таблицу со status-флагами.
- **Решение:** структура — плоский список фичей с полем `phase` (TBD), полная детализация, поля `kind` (entity/script) и `module` (Поиск/Валидация/Расчёт/Сопровождение).
- **Файлы:** `App/docs/ROADMAP.json`
- **Коммит:** `7a3b2b4`
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — TBD стека закрыты, добавлен агентный слой (+3 фичи)

- **Сделано:** зафиксированы все TBD-решения по стеку. Добавил 2 entity (`ent-telegram-account`, `ent-agent-conversations`) и 1 script (`scr-telegram-agent` — LLM-агент с tool-use доступом ко всем 16 CRUD-скриптам). Переименовал `scr-notifications` → «Push Apple Reminders (CalDAV)». Зафиксировал политику clean slate (без импорта старых данных) и еженедельный парсинг.
- **Решение:** нотификации идут через **Apple Reminders + CalDAV** (см. `arc.md` секция A). Telegram = **двусторонний LLM-агент** через grammY + Claude API (не нотификационный канал). Деплой — Self-host VPS + Docker. API — REST.
- **Файлы:** `App/docs/ROADMAP.json`
- **Коммит:** `4e8abaf`
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — ROADMAP создан (пустой шаблон)

- **Сделано:** создал `docs/ROADMAP.json` с пустым массивом `features: []`, описанием словарей (status/priority/complexity) и шаблоном `feature_schema`.
- **Решение:** структура — flat features[], полная детализация на фичу, формат `roadmap_v1`.
- **Файлы:** `App/docs/ROADMAP.json`
- **Коммит:** `01a055e`
- **Ветка:** `rework/nextjs-postgres` (создана от main)

---

## 2026-05-24 — Git инициализирован, baseline-коммит

- **Сделано:** инициализировал git в `App/`, переименовал ветку в `main`, добавил `output/.gitkeep`, сделал первый коммит со всем существующим Python-приложением (42 файла, 6821 строка).
- **Решение:** git scope — внутри `App/` (не корня проекта), main ветка считается «продакшеновой и заблокированной» от изменений в rework.
- **Файлы:** все файлы `App/` baseline
- **Коммит:** `0407adf`
- **Ветка:** `main` (только что создана)
