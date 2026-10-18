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
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h2 className="font-bold text-slate-800 mb-1">Chat history</h2>
      <p className="text-xs text-slate-500 mb-4">
        Every planning conversation is persisted in SQLite.
      </p>

      {sessions.length === 0 && (
        <p className="text-sm text-slate-400 py-6 text-center">
          No history yet — generate a plan to start a conversation.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Session list */}
        <div className="md:col-span-1 space-y-2 max-h-[520px] overflow-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => open(s.id)}
              className={`w-full text-left border rounded-lg p-3 transition ${
                active === s.id
                  ? "border-chili-400 bg-chili-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <p className="text-sm font-medium text-slate-800 truncate">{s.title}</p>
              <p className="text-xs text-slate-400">
                {s.message_count} messages · {new Date(s.created_at).toLocaleString()}
              </p>
            </button>
          ))}
        </div>

        {/* Transcript */}
        <div className="md:col-span-2 border border-slate-200 rounded-lg p-4 min-h-[200px]">
          {!active && <p className="text-sm text-slate-400">Select a conversation to view it.</p>}
          {loading && <p className="text-sm text-slate-400">Loading…</p>}
          {!loading &&
            active &&
            messages.map((m, i) => (
              <div
                key={i}
                className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-chili-600 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">
                    {m.role}
                  </div>
                  {m.content}
                </div>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
