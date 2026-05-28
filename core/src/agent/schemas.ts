import { z } from 'zod';

/**
 * Контракт core на ответ llm-service job `agent-reply` (зеркало llm-service types).
 * core не импортит llm-service — независимая валидация на границе HTTP.
 */
export const agentReplyOutputSchema = z.object({
  reply: z.string(),
  intent: z.string().optional(),
  toolCalls: z
    .array(z.object({ tool: z.string(), input: z.record(z.unknown()).default({}) }))
    .default([]),
});
export type AgentReplyOutput = z.infer<typeof agentReplyOutputSchema>;

/** Запрос к агенту (REST `POST /api/agent/message` / Telegram webhook). */
export const agentMessageRequestSchema = z.object({
  userId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});
export type AgentMessageRequest = z.infer<typeof agentMessageRequestSchema>;
