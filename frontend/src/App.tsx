import { useEffect, useState } from "react";
import { api, Plan, Skill, AcceptResult, LearnedPrefs } from "./api";
import { SkillsTab } from "./components/SkillsTab";
import { HistoryTab } from "./components/HistoryTab";
import { AcceptModal } from "./components/AcceptModal";
import { FeedbackModal } from "./components/FeedbackModal";
import { PhaseCard } from "./components/PhaseCard";

type Tab = "planner" | "skills" | "history";

export default function App() {
  const [tab, setTab] = useState<Tab>("planner");

  const [idea, setIdea] = useState(
    "A SaaS web app with user login, a Postgres database, and deployment"
  );
  const [experience, setExperience] = useState("intermediate");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [learned, setLearned] = useState<LearnedPrefs | null>(null);
  const [acceptResult, setAcceptResult] = useState<AcceptResult | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    api.listSkills().then(setSkills).catch(() => {});
    api.preferences().then(setLearned).catch(() => {});
  }, []);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const p = await api.createPlan({
        idea,
        experience_level: experience,
        preferences: [],
        constraints: [],
        session_id: sessionId ?? undefined,
      });
      setPlan(p);
      const sNote = p.notes.find((n) => n.startsWith("session:"));
      if (sNote) setSessionId(sNote.split(":")[1]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function doAdapt() {
    if (!plan || !change.trim()) return;
    setLoading(true);
    try {
      const p = await api.adaptPlan(plan.id, change);
      setPlan(p);
      setChange("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function decide(approvalId: string, decision: "approve" | "reject") {
    if (!plan) return;
    setPlan(await api.approve(plan.id, approvalId, decision));
  }

  async function decidePhase(phaseId: string, decision: "accepted" | "rejected" | "pending") {
    if (!plan) return;
    setPlan(await api.decidePhase(plan.id, phaseId, decision));
  }

  async function chatPhase(phaseId: string, message: string) {
    if (!plan) return;
    setPlan(await api.chatPhase(plan.id, phaseId, message, sessionId ?? undefined));
  }

  async function acceptPlan() {
    if (!plan) return;
    setLoading(true);
    try {
      const res = await api.acceptPlan(plan.id, sessionId ?? undefined);
      setAcceptResult(res);
      setLearned(res.learned);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback(rating: number, remarks: string) {
    if (!plan) return;
    const res = await api.sendFeedback({
      plan_id: plan.id,
      session_id: sessionId ?? undefined,
      rating,
      remarks,
    });
    setLearned(res.learned);
  }

  function closeAccept() {
    setAcceptResult(null);
    setShowFeedback(true); // feedback prompt after accept
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "planner", label: "Planner" },
    { id: "skills", label: "Skills" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-chili-700 to-chili-500 text-white">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌶️</span>
            <div>
              <h1 className="text-2xl font-bold">Lao Gan Ma</h1>
              <p className="text-chili-100 text-sm">
                Autonomous AI project agent · plans, adapts, learns, and asks before consequential
                actions
              </p>
            </div>
          </div>
          {/* Tabs */}
          <nav className="flex gap-1 mt-5">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
                  tab === t.id
                    ? "bg-slate-50 text-chili-700"
                    : "bg-chili-600/40 text-white hover:bg-chili-600/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {learned?.note && (
          <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-sm text-indigo-800">
            🧠 {learned.note}
          </div>
        )}

        {tab === "planner" && (
          <>
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Describe your project idea
              </label>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-chili-500 focus:outline-none"
              />
              <div className="flex items-center gap-3 mt-3">
                <select
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <button
                  onClick={generate}
                  disabled={loading}
                  className="bg-chili-600 hover:bg-chili-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm"
                >
                  {loading ? "Planning…" : "Generate plan"}
                </button>
              </div>
              {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
            </section>

            {plan && (
              <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-lg">Plan #{plan.id}</h2>
                    <p className="text-sm text-slate-500">Revision {plan.revision}</p>
                  </div>
                  <button
                    onClick={acceptPlan}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm"
                  >
                    ✓ Accept Plan
                  </button>
                </div>
                <p className="text-sm text-slate-700 mt-2">{plan.summary}</p>

                {plan.notes.filter((n) => !n.startsWith("session:")).length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {plan.notes
                      .filter((n) => !n.startsWith("session:"))
                      .map((n, i) => (
                        <li key={i} className="text-xs text-slate-500">
                          • {n}
                        </li>
                      ))}
                  </ul>
                )}

                {plan.pending_approvals.length > 0 && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-800 mb-2">
                      ⚠ Human approval required before these consequential steps
                    </p>
                    <div className="space-y-2">
                      {plan.pending_approvals.map((a) => (
                        <div key={a} className="flex items-center justify-between text-sm">
                          <span className="text-amber-900">{a.split(":")[1]}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => decide(a, "approve")}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => decide(a, "reject")}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded text-xs"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  <p className="text-xs text-slate-500">
                    Review each proposal below — <b>Accept</b> or <b>Reject</b> it individually, or{" "}
                    <b>💬 Discuss</b> its reasoning with the agent. Rejected proposals are excluded
                    from the final prompt.
                  </p>
                  {plan.phases.map((ph, idx) => (
                    <PhaseCard
                      key={ph.id}
                      phase={ph}
                      index={idx}
                      onDecide={decidePhase}
                      onChat={chatPhase}
                    />
                  ))}
                </div>

                <div className="mt-5 border-t border-slate-200 pt-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Something changed? Adapt the plan
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={change}
                      onChange={(e) => setChange(e.target.value)}
                      placeholder="e.g. prototype only, no deployment"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={doAdapt}
                      disabled={loading || !change.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      Adapt
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {tab === "skills" && <SkillsTab skills={skills} />}
        {tab === "history" && <HistoryTab />}
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">
        Lao Gan Ma · ai-gnition sim hackathon · "1 less thing"
      </footer>

      {acceptResult && <AcceptModal result={acceptResult} onClose={closeAccept} />}
      {showFeedback && (
        <FeedbackModal onSubmit={submitFeedback} onClose={() => setShowFeedback(false)} />
      )}
    </div>
  );
}
