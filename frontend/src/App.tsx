import { useEffect, useState } from "react";
import { api, Plan, Skill, TrustLevel } from "./api";

const trustStyles: Record<TrustLevel, string> = {
  verified: "bg-emerald-100 text-emerald-700 border-emerald-200",
  unverified: "bg-amber-100 text-amber-700 border-amber-200",
  blocked: "bg-red-100 text-red-700 border-red-200",
};

const phaseStatusStyles: Record<string, string> = {
  proposed: "bg-slate-100 text-slate-600",
  approved: "bg-emerald-100 text-emerald-700",
  changed: "bg-blue-100 text-blue-700",
};

function TrustBadge({ level }: { level: TrustLevel }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${trustStyles[level]}`}>
      {level}
    </span>
  );
}

export default function App() {
  const [idea, setIdea] = useState(
    "A SaaS web app with user login, a Postgres database, and deployment"
  );
  const [experience, setExperience] = useState("intermediate");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState("");

  useEffect(() => {
    api.listSkills().then(setSkills).catch(() => {});
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
      });
      setPlan(p);
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
    const p = await api.approve(plan.id, approvalId, decision);
    setPlan(p);
  }

  const blockedSkills = skills.filter((s) => s.trust_level === "blocked");

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-chili-700 to-chili-500 text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌶️</span>
            <div>
              <h1 className="text-2xl font-bold">Lao Gan Ma</h1>
              <p className="text-chili-100 text-sm">
                Autonomous AI project agent · plans, adapts, and asks before consequential actions
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: input + plan */}
        <div className="lg:col-span-2 space-y-6">
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
              </div>
              <p className="text-sm text-slate-700 mt-2">{plan.summary}</p>

              {plan.notes.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {plan.notes.map((n, i) => (
                    <li key={i} className="text-xs text-slate-500">
                      • {n}
                    </li>
                  ))}
                </ul>
              )}

              {/* Approval gates */}
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

              {/* Phases */}
              <div className="mt-5 space-y-4">
                {plan.phases.map((ph, idx) => (
                  <div key={ph.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800">
                        {idx + 1}. {ph.name}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          phaseStatusStyles[ph.status] ?? "bg-slate-100"
                        }`}
                      >
                        {ph.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{ph.goal}</p>
                    {ph.recommended_tech.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ph.recommended_tech.map((t) => (
                          <span
                            key={t}
                            className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <ul className="mt-3 space-y-1.5">
                      {ph.tasks.map((t, i) => (
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
                  </div>
                ))}
              </div>

              {/* Adapt */}
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
        </div>

        {/* Right: SkillDB panel */}
        <aside className="space-y-4">
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="font-bold text-slate-800">SkillDB</h2>
            <p className="text-xs text-slate-500 mb-3">
              Skills are verified before they can influence any plan.
            </p>
            <div className="space-y-2 max-h-[520px] overflow-auto">
              {skills.map((s) => (
                <div key={s.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{s.name}</span>
                    <TrustBadge level={s.trust_level} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{s.summary}</p>
                  {s.verification && s.verification.findings.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {s.verification.findings.map((f, i) => (
                        <li
                          key={i}
                          className={`text-xs ${
                            f.severity === "critical" ? "text-red-600" : "text-amber-600"
                          }`}
                        >
                          [{f.severity}] {f.code}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          {blockedSkills.length > 0 && (
            <section className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-red-700">
                🛡 {blockedSkills.length} skill(s) blocked by verification
              </h3>
              <p className="text-xs text-red-600 mt-1">
                Untrusted instructions (e.g. prompt injection) are quarantined and never reach the
                planner.
              </p>
            </section>
          )}
        </aside>
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">
        Lao Gan Ma · ai-gnition sim hackathon · "1 less thing"
      </footer>
    </div>
  );
}
