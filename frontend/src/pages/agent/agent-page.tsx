import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/lib/use-current-user';
import { Button } from '@/components/base/buttons/button';
import { TextArea } from '@/components/base/textarea/textarea';
import { fetchAgentHistory, postAgentMessage, type AgentToolResult } from '@/api/agent';

// Страница /agent — чат с LLM-агентом (тот же handleAgentMessage, что и Telegram-бот).

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  tools?: AgentToolResult[];
  intent?: string | null;
}

const SUGGESTIONS = ['Что у меня с остатками?', 'Покажи план недели', 'Посчитай мои нормы КБЖУ'];

export default function AgentPage() {
  const { userId, hasUser, isLoading } = useCurrentUser();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Восстанавливаем последние реплики диалога при загрузке.
  const historyQuery = useQuery({
    queryKey: ['agent-history', userId],
    queryFn: () => fetchAgentHistory(userId as string),
    enabled: Boolean(userId),
  });
  useEffect(() => {
    if (historyLoaded || !historyQuery.data) return;
    setMessages(
      historyQuery.data.items.map((m) => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        text: m.message,
        intent: m.intent,
      })),
    );
    setHistoryLoaded(true);
  }, [historyQuery.data, historyLoaded]);

  async function send(raw?: string) {
    const msg = (raw ?? text).trim();
    if (!msg || !userId || pending) return;
    setError(null);
    setMessages((m) => [...m, { role: 'user', text: msg }]);
    setText('');
    setPending(true);
    // LLM-агент через CLI отвечает ~10с (дольше под нагрузкой). Таймаут, чтобы не висеть вечно.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    try {
      const res = await postAgentMessage(userId, msg, controller.signal);
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: res.reply, tools: res.toolResults, intent: res.intent },
      ]);
    } catch (e) {
      const aborted = controller.signal.aborted || (e instanceof DOMException && e.name === 'AbortError');
      setError(
        aborted
          ? 'Агент слишком долго отвечает (возможно, занят генерацией плана/рецептов). Сообщение сохранено — попробуйте ещё раз.'
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      clearTimeout(timer);
      setPending(false);
    }
  }

  // Счётчик секунд ожидания ответа — чтобы ~10с не выглядели как «зависло».
  const [waitSec, setWaitSec] = useState(0);
  useEffect(() => {
    if (!pending) {
      setWaitSec(0);
      return;
    }
    const id = setInterval(() => setWaitSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [pending]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-xs font-semibold text-primary">Чат с агентом</h1>
        <p className="text-sm text-tertiary">
          Спроси про план, остатки, нормы или дневник на естественном языке. Агент сам выберет нужный
          инструмент.
        </p>
      </header>

      {isLoading && <p className="text-sm text-tertiary">Загрузка…</p>}
      {!isLoading && !hasUser && <p className="text-sm text-tertiary">Нет пользователя в БД.</p>}

      {hasUser && (
        <>
          <div className="flex min-h-[240px] flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-tertiary">Начни с примера:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-full border border-secondary bg-primary px-3 py-1.5 text-sm text-secondary transition hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'self-end' : 'self-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-lg rounded-xl bg-brand-solid px-4 py-2.5 text-sm text-white'
                      : 'max-w-lg rounded-xl border border-secondary bg-primary px-4 py-2.5 text-sm text-primary'
                  }
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.tools && m.tools.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.tools.map((t, j) => (
                        <span
                          key={j}
                          className="rounded bg-secondary px-1.5 py-0.5 text-xs text-tertiary"
                          title={t.error ?? ''}
                        >
                          🔧 {t.tool} {t.ok ? '✓' : '✗'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {pending && (
              <p className="self-start text-sm text-tertiary">
                Агент думает… {waitSec > 0 ? `${waitSec}с` : ''}
                {waitSec >= 15 ? ' (CLI-ответ под нагрузкой может занять до минуты)' : ''}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-error-primary">Ошибка: {error}</p>}

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <TextArea
                value={text}
                onChange={setText}
                placeholder="Напиши сообщение…"
                rows={2}
                isDisabled={pending}
              />
            </div>
            <Button
              size="lg"
              color="primary"
              isLoading={pending}
              isDisabled={!text.trim()}
              onClick={() => void send()}
            >
              Отправить
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
