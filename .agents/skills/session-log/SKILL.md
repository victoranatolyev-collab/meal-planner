---
name: session-log
description: "Append a short structured markdown record of the current working session into ./Conversation history/ relative to the directory where the skill is invoked."
trigger: /session-log
---

# session-log

Use this skill when the user wants to checkpoint or summarize a working session.

## Output Location

Write exactly one markdown file under:

```text
<cwd>/Conversation history/
```

Create the folder if it does not exist.

File name format:

```text
YYYY-MM-DD-<kebab-topic>.md
```

If the file already exists, append `-2`, `-3`, and so on. Do not overwrite an existing session log.

## Record Format

Keep the entry short and structured:

```markdown
---
date: YYYY-MM-DD
topic: <short topic>
dir: <repo-relative cwd>
---

# <Topic> — <date>

## Запрос
<1-2 lines: what the session was about.>

## Найдено
- <key facts, files, commands, links, or decisions discovered.>

## Решения / одобрено
- <what was changed, approved, committed, pushed, or explicitly rejected.>

## Next
- <open follow-ups. If none, use "—".>
```

## Rules

- Do not paste secrets, tokens, passwords, cookies, or raw `.env` values.
- Prefer repo-relative paths inside the log body.
- One continuous working session should normally produce one file.
- Do not write long transcripts; this is a compact handoff record.
- After writing, read the created file back and report its path to the user.

