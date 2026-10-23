/**
 * Past plans. A list to work through: the sessions on the left, the transcript
 * of the selected one on the right. Rows carry a 1px rule and no card; the
 * selected row is a neutral fill, not a tinted one.
 */
import { useEffect, useState } from "react";
import { api, SessionSummary, ChatMessage } from "../api";

export function HistoryTab() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listSessions().then(setSessions).catch(() => {});
  }, []);

  async function open(id: string) {
    setActive(id);
    setLoading(true);
    try {
      setMessages(await api.sessionMessages(id));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-body text-muted">
          Every planning conversation, kept so you can pick one up again.
        </p>
        <p className="num text-small text-muted">
          {sessions.length} {sessions.length === 1 ? "conversation" : "conversations"}
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="mt-4 rounded-card border border-edge px-4 py-10 text-center">
          <p className="text-body text-muted">No conversations yet.</p>
          <p className="mt-1 text-small text-faint">
            Plan a project and it will be saved here.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          {/* the sessions */}
          <ul className="divide-y divide-rule border-y border-rule">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => open(s.id)}
                  aria-current={active === s.id ? "true" : undefined}
                  data-ring
                  className={`w-full px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    active === s.id ? "bg-active" : "hover:bg-raised"
                  }`}
                >
                  <span className="block truncate text-body text-ink">{s.title}</span>
                  <span className="num mt-0.5 block text-small text-muted">
                    {s.message_count} messages, {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* the transcript */}
          <div className="min-h-48 rounded-card border border-edge px-4 py-4">
            {!active && <p className="text-body text-muted">Select a conversation to read it.</p>}
            {loading && <p className="text-body text-muted">Loading</p>}
            {!loading && active && messages.length === 0 && (
              <p className="text-body text-muted">This conversation is empty.</p>
            )}
            {!loading && active && (
              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <p
                      className={`max-w-[85%] whitespace-pre-wrap rounded-card px-3 py-2 text-body ${
                        m.role === "user" ? "bg-primary text-primary-ink" : "bg-raised text-ink"
                      }`}
                    >
                      {m.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
