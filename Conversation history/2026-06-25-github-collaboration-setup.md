---
date: 2026-06-25
topic: github collaboration setup
dir: .
---

# GitHub Collaboration Setup — 2026-06-25

## Запрос
Подготовить `app` к совместной разработке: привести ветки к одной, опубликовать репозиторий на GitHub, описать `.env` и добавить сессионный лог.

## Найдено
- Основной проект находится в `app/`; внешний каталог `Питание/` не является git-репозиторием.
- В `app` была актуальная ветка `rework/nextjs-postgres`; `main` был полным предком и не содержал уникальных коммитов.
- `.env` игнорируется git-ом; в нем есть локальные секреты, включая Telegram bot token.
- Remote создан как private GitHub repo: `git@github.com:victoranatolyev-collab/meal-planner.git`.

## Решения / одобрено
- Локальная `main` удалена, оставлена одна рабочая ветка `rework/nextjs-postgres`.
- Добавлен `TELEGRAM_BOT_USERNAME` в `.env.example`, а локальный `.claude/launch.json` добавлен в `.gitignore`.
- Состояние проекта закоммичено и запушено в `origin/rework/nextjs-postgres`.
- Добавлен локальный `session-log` skill в `.claude/skills/session-log/SKILL.md`.

## Next
- Передать соразработчикам `.env` отдельно через безопасный канал или настроить GitHub Secrets.
- При необходимости перевыпустить Telegram bot token, если он когда-либо передавался в открытом виде.
