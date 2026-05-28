import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { agentMessageRequestSchema, handleAgentMessage } from 'core';

/**
 * POST /api/agent/message  body { userId, message }
 *
 * scr-telegram-agent (transport-agnostic мозг): сообщение → llm-service agent-reply →
 * диспатч tool-calls по реестру scr-* сервисов → append-only снимок диалога.
 * Та же логика используется Telegram-webhook'ом.
 *
 * Ответ: 200 { reply, intent, toolResults:[{tool, ok, result?, error?}] }.
 * Ошибки: 400 invalid_json/invalid_body; 502 agent_failed (llm-service недоступен/упал).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let input;
  try {
    input = agentMessageRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  try {
    const result = await handleAgentMessage(input);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'agent_failed', message }, { status: 502 });
  }
}
