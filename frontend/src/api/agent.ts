import { apiGet, apiPost } from './client';

export interface AgentToolResult {
  tool: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface AgentResponse {
  reply: string;
  intent: string | null;
  toolResults: AgentToolResult[];
}

/** POST /api/agent/message — отправить сообщение LLM-агенту, получить ответ + результаты tool-calls. */
export const postAgentMessage = (userId: string, message: string) =>
  apiPost<AgentResponse>('/agent/message', { userId, message });

export interface AgentHistoryMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  message: string;
  intent: string | null;
  actionTaken: string | null;
  createdAt: string;
}

/** GET /api/agent/history — последние реплики диалога (для восстановления чата при загрузке). */
export const fetchAgentHistory = (userId: string) =>
  apiGet<{ items: AgentHistoryMessage[] }>(`/agent/history?userId=${encodeURIComponent(userId)}`);

