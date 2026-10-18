import { useState } from "react";
import { Phase } from "../api";

const statusStyles: Record<string, string> = {
  proposed: "bg-slate-100 text-slate-600",
  approved: "bg-emerald-100 text-emerald-700",
  changed: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};

export function PhaseCard({
  phase,
  index,
  onDecide,
  onChat,
}: {
  phase: Phase;
  index: number;
  onDecide: (phaseId: string, decision: "accepted" | "rejected" | "pending") => Promise<void>;
  onChat: (phaseId: string, message: string) => Promise<void>;
}) {
  const [showChat, setShowChat] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const rejected = phase.decision === "rejected";
  const accepted = phase.decision === "accepted";

  async function send() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await onChat(phase.id, draft.trim());
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  const quick = [
    "Why is this phase needed?",
    "What are the trade-offs?",
    "Can we simplify this?",
  ];

  return (
    <div
      className={`border rounded-lg p-4 transition ${
        rejected
          ? "border-red-200 bg-red-50/40 opacity-70"
          : accepted
          ? "border-emerald-300 bg-emerald-50/40"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className={`font-semibold text-slate-800 ${rejected ? "line-through" : ""}`}>
          {index + 1}. {phase.name}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyles[phase.status] ?? "bg-slate-100"}`}>
          {phase.decision !== "pending" ? phase.decision : phase.status}
        </span>
      </div>
      <p className="text-sm text-slate-500 mt-1">{phase.goal}</p>

      {phase.recommended_tech.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {phase.recommended_tech.map((t) => (
            <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      )}

      <ul className="mt-3 space-y-1.5">
        {phase.tasks.map((t, i) => (
          <li key={i} className="text-sm text-slate-700 flex gap-2">
            <span className="text-chili-500">▸</span>
            <span>
              <span className="font-medium">{t.title}</span>
              {t.approval_required && (
                <span className="ml-2 text-xs text-amber-600">(needs approval)</span>
              )}
              <br />
              <span className="text-slate-500 text-xs">{t.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* Per-proposal decision + discuss controls */}
      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={() => onDecide(phase.id, accepted ? "pending" : "accepted")}
          className={`text-xs px-3 py-1 rounded ${
            accepted
              ? "bg-emerald-600 text-white"
              : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
          }`}
        >
          {accepted ? "✓ Accepted" : "Accept"}
        </button>
        <button
          onClick={() => onDecide(phase.id, rejected ? "pending" : "rejected")}
          className={`text-xs px-3 py-1 rounded ${
            rejected
              ? "bg-red-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {rejected ? "✕ Rejected" : "Reject"}
        </button>
        <button
          onClick={() => setShowChat((v) => !v)}
          className="text-xs px-3 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 ml-auto"
        >
          💬 Discuss{phase.chat.length > 0 ? ` (${phase.chat.length / 2})` : ""}
        </button>
      </div>

      {/* Discussion panel */}
      {showChat && (
        <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
          <div className="space-y-2 max-h-60 overflow-auto mb-2">
            {phase.chat.length === 0 && (
              <p className="text-xs text-slate-400">
                Ask about the reasoning, trade-offs, or specifics of this proposal.
              </p>
            )}
            {phase.chat.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs whitespace-pre-wrap ${
                    m.role === "user" ? "bg-chili-600 text-white" : "bg-white border border-slate-200 text-slate-700"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          {phase.chat.length === 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {quick.map((q) => (
                <button
                  key={q}
                  onClick={() => onChat(phase.id, q)}
                  className="text-[11px] px-2 py-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={`Ask about ${phase.name}…`}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
            <button
              onClick={send}
              disabled={busy || !draft.trim()}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white"
            >
              {busy ? "…" : "Ask"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
