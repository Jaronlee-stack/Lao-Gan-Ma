/**
 * Lao Gan Ma — the chat screen.
 *
 * Style: framed-sheet (tasteskill app sheet, seed 2075178212). The chrome is
 * one tinted L-frame holding the sidebar and a 48px top bar with no rule
 * between them; the work sits on a white sheet inset 8px from the window's
 * right and bottom edges. Colour stays off the chrome: it goes on the product
 * mark, the 2px active underline, the one primary action and the verification
 * statuses, which is the data on this screen.
 *
 * The screen's question: what is the plan for my idea, and which skills were
 * trusted to build it?
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  Plan,
  Skill,
  AcceptResult,
  LearnedPrefs,
  UserContext,
  SecurityScanResult,
  emptyContext,
} from "./api";
import { friendlyError, FriendlyError } from "./errors";
import { useTheme } from "./useTheme";
import { SkillsTab } from "./components/SkillsTab";
import { HistoryTab } from "./components/HistoryTab";
import { FeedbackModal } from "./components/FeedbackModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { PhaseCard } from "./components/PhaseCard";
import { Button } from "./components/Button";
import { Mascot, MascotMood } from "./components/Mascot";
import { PullDownScreen } from "./components/PullDownScreen";
import { SecurityScan } from "./components/SecurityScan";
import { ContextPanel } from "./components/ContextPanel";
import { Check, Shield, Adapt, Alert, Brain, Moon, Sun, Chat, Sparkle, X } from "./components/icons";

type Tab = "chat" | "pantry" | "orders";

type Msg =
  | { kind: "user"; id: string; text: string }
  | { kind: "mala"; id: string; text: string }
  | { kind: "scan"; id: string; scan: SecurityScanResult }
  | { kind: "plan"; id: string; planId: string };

let seq = 0;
const nextId = () => `m${++seq}`;

const NAV: { id: Tab; label: string; Icon: typeof Chat }[] = [
  { id: "chat", label: "Plan a project", Icon: Chat },
  { id: "pantry", label: "Skills", Icon: Sparkle },
  { id: "orders", label: "Past plans", Icon: Brain },
];

const TITLES: Record<Tab, string> = {
  chat: "Plan a project",
  pantry: "Skills",
  orders: "Past plans",
};

function approvalLabel(token: string): string {
  const parts = token.split(":");
  return (parts.length > 1 ? parts.slice(1).join(":") : token).trim() || "this step";
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [tab, setTab] = useState<Tab>("chat");
  const [navOpen, setNavOpen] = useState(false);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<MascotMood>("idle");
  const [error, setError] = useState<FriendlyError | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [learned, setLearned] = useState<LearnedPrefs | null>(null);
  const [ctx, setCtx] = useState<UserContext>(emptyContext);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxSaving, setCtxSaving] = useState(false);

  const [acceptResult, setAcceptResult] = useState<AcceptResult | null>(null);
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const say = useCallback((text: string) => {
    setMessages((m) => [...m, { kind: "mala", id: nextId(), text }]);
  }, []);

  useEffect(() => {
    api.listSkills().then(setSkills).catch(() => {});
    api.preferences().then(setLearned).catch(() => {});
    api
      .getContext()
      .then((c) => {
        setCtx(c);
        setMessages([
          {
            kind: "mala",
            id: nextId(),
            text: c.display_name
              ? `Hi ${c.display_name}. Describe what you want to build and I'll return a phased plan, a one-shot prompt and a skills file.`
              : "Hi, I'm Mala. Describe what you want to build and I'll return a phased plan, a one-shot prompt and a skills file.",
          },
        ]);
      })
      .catch(() => {
        setMessages([
          {
            kind: "mala",
            id: nextId(),
            text: "Hi, I'm Mala. Describe what you want to build and I'll return a phased plan.",
          },
        ]);
      });
  }, []);

  /* Follow the conversation, but never on the first screen: scrolling to the
     end there pushes the greeting and the examples off the top. */
  useEffect(() => {
    if (messages.length <= 1 && !busy) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { kind: "user", id: nextId(), text }]);
    setDraft("");
    setError(null);
    setBusy(true);
    try {
      if (plan) await adaptExisting(text);
      else await createNew(text);
    } finally {
      setBusy(false);
      setMood("idle");
      inputRef.current?.focus();
    }
  }

  async function createNew(idea: string) {
    if (ctx.security_mode) {
      setMood("scanning");
      say("Security mode is on, so I'll verify every skill before I use any of it.");
      try {
        const scan = await api.securityScan(idea, ctx.experience_level || "intermediate");
        setMessages((m) => [...m, { kind: "scan", id: nextId(), scan }]);
        await wait(Math.min(400 + scan.steps.length * 380, 6000));
        say(
          scan.blocked > 0
            ? `I blocked ${scan.blocked} skill${scan.blocked === 1 ? "" : "s"} that failed verification. Only the ${scan.loaded} cleared ones will shape your plan.`
            : `All clear. ${scan.loaded} verified skills ready to use.`
        );
      } catch (e) {
        setError(friendlyError(e));
        setMood("concerned");
        return;
      }
    }

    setMood("thinking");
    try {
      const [p] = await Promise.all([
        api.createPlan({
          idea,
          experience_level: ctx.experience_level || "intermediate",
          preferences: ctx.preferred_stack,
          constraints: ctx.constraints,
          session_id: sessionId ?? undefined,
        }),
        wait(700),
      ]);
      const sNote = p.notes.find((n) => n.startsWith("session:"));
      if (sNote) setSessionId(sNote.split(":")[1]);
      setPlan(p);
      setMood("happy");
      setMessages((m) => [...m, { kind: "plan", id: nextId(), planId: p.id }]);
    } catch (e) {
      setError(friendlyError(e));
      setMood("concerned");
    }
  }

  async function adaptExisting(change: string) {
    if (!plan) return;
    setMood("thinking");
    try {
      const [p] = await Promise.all([api.adaptPlan(plan.id, change), wait(600)]);
      setPlan(p);
      setMood("happy");
      setMessages((m) => [
        ...m,
        { kind: "mala", id: nextId(), text: "Updated the plan." },
        { kind: "plan", id: nextId(), planId: p.id },
      ]);
    } catch (e) {
      setError(friendlyError(e));
      setMood("concerned");
    }
  }

  function newPlan() {
    setPlan(null);
    setAcceptResult(null);
    say("Fresh start. What are we building?");
    inputRef.current?.focus();
  }

  async function decide(approvalId: string, decision: "approve" | "reject") {
    if (!plan) return;
    try {
      setPlan(await api.approve(plan.id, approvalId, decision));
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function decidePhase(phaseId: string, decision: "accepted" | "rejected" | "pending") {
    if (!plan) return;
    try {
      setPlan(await api.decidePhase(plan.id, phaseId, decision));
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function chatPhase(phaseId: string, message: string) {
    if (!plan) return;
    try {
      setPlan(await api.chatPhase(plan.id, phaseId, message, sessionId ?? undefined));
    } catch (e) {
      setError(friendlyError(e));
    }
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
    setConfirmAccept(false);
    setBusy(true);
    try {
      const [res] = await Promise.all([
        api.acceptPlan(plan.id, sessionId ?? undefined),
        wait(500),
      ]);
      setAcceptResult(res);
      setLearned(res.learned);
      setMood("happy");
    } catch (e) {
      setError(friendlyError(e));
      setMood("concerned");
    } finally {
      setBusy(false);
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

  async function saveCtx(next: UserContext) {
    setCtxSaving(true);
    try {
      const saved = await api.saveContext(next);
      setCtx(saved);
      setCtxOpen(false);
      const bits: string[] = [];
      if (saved.preferred_stack.length) bits.push(`favour ${saved.preferred_stack.join(", ")}`);
      if (saved.avoid.length) bits.push(`avoid ${saved.avoid.join(", ")}`);
      if (saved.constraints.length) bits.push(`${saved.constraints.length} standing constraints`);
      say(
        bits.length
          ? `Saved. I'll ${bits.join(", ")} in every plan from now on.`
          : "Context saved. I'll apply it to every plan."
      );
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setCtxSaving(false);
    }
  }

  async function clearCtx() {
    try {
      setCtx(await api.clearContext());
      setCtxOpen(false);
      say("Cleared your context.");
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function toggleSecurityMode() {
    const next = { ...ctx, security_mode: !ctx.security_mode };
    // Optimistic flip so the toggle feels instant, then persist.
    setCtx(next);
    try {
      setCtx(await api.saveContext(next));
      say(
        next.security_mode
          ? "Security mode is on. I'll verify every skill in front of you before I use any of it."
          : "Security mode is off. I'll still verify skills behind the scenes, just without the step-by-step scan."
      );
    } catch (e) {
      setCtx(ctx); // revert on failure
      setError(friendlyError(e));
    }
  }

  const ctxCount =
    (ctx.display_name ? 1 : 0) +
    (ctx.role ? 1 : 0) +
    (ctx.experience_level ? 1 : 0) +
    ctx.preferred_stack.length +
    ctx.avoid.length +
    ctx.constraints.length +
    (ctx.goals ? 1 : 0) +
    (ctx.notes ? 1 : 0);

  const approvalsDue = plan?.pending_approvals.length ?? 0;
  /* Nothing has happened yet, so the first screen carries the start panel. */
  const atStart = !plan && !busy && messages.length <= 1;

  /* The screen's one finding, read directly under the title. */
  const finding = plan
    ? approvalsDue > 0
      ? `${plan.phases.length} phases, ${approvalsDue} need your approval before the agent proceeds.`
      : `${plan.phases.length} phases, all clear to build.`
    : ctx.security_mode
    ? "Security mode is on. Every skill is verified before it can shape a plan."
    : "Describe a project and Mala returns a phased plan you can edit, then a prompt.";

  return (
    <div className="relative min-h-svh bg-ground md:grid md:grid-cols-[228px_minmax(0,1fr)]">
      {/* ── Sidebar: part of the tinted L-frame, no rule against the top bar ── */}
      <aside
        id="nav"
        className={`${
          navOpen
            ? "absolute inset-y-0 left-0 z-30 w-64 border-r border-edge md:border-r-0"
            : "hidden"
        } bg-ground px-3 py-4 md:static md:z-auto md:block md:h-svh md:w-auto md:overflow-auto`}
      >
        {/* the product, named and marked */}
        <div className="mb-5 flex items-center gap-2.5 px-2">
          <span className="h-7 w-7 shrink-0">
            <Mascot mood={busy ? mood : "idle"} />
          </span>
          <span className="text-body font-semibold text-ink">Lao Gan Ma</span>
        </div>

        {/* scope */}
        <p className="mb-1 px-2 text-small text-muted">
          {ctx.display_name ? `${ctx.display_name}'s workspace` : "Your workspace"}
        </p>

        <nav aria-label="Sections" className="mt-3 flex flex-col gap-0.5">
          {NAV.map(({ id, label, Icon }) => {
            const on = tab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  setNavOpen(false);
                }}
                aria-current={on ? "page" : undefined}
                data-ring
                className={`flex h-8 items-center gap-2.5 rounded-control px-2 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  on ? "bg-active font-medium text-ink" : "text-muted hover:bg-raised hover:text-ink"
                }`}
              >
                <Icon className="shrink-0 text-base" />
                <span className="flex-1 text-left">{label}</span>
                {id === "chat" && approvalsDue > 0 && (
                  <span className="num rounded bg-pill-warn-bg px-1.5 text-small text-pill-warn-ink">
                    {approvalsDue}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-5 flex flex-col gap-0.5 border-t border-edge pt-4">
          <button
            onClick={() => setCtxOpen(true)}
            data-ring
            className="flex h-8 items-center gap-2.5 rounded-control px-2 text-body text-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Brain className="shrink-0 text-base" />
            <span className="flex-1 text-left">Your context</span>
            {ctxCount > 0 && (
              <span className="num rounded bg-pill-neutral-bg px-1.5 text-small text-pill-neutral-ink">
                {ctxCount}
              </span>
            )}
          </button>
          <button
            onClick={toggleSecurityMode}
            data-ring
            role="switch"
            aria-checked={ctx.security_mode}
            aria-label="Toggle security mode"
            className={`flex h-8 items-center gap-2.5 rounded-control px-2 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              ctx.security_mode
                ? "text-positive hover:bg-raised"
                : "text-muted hover:bg-raised hover:text-ink"
            }`}
          >
            <Shield className="shrink-0 text-base" />
            <span className="flex-1 text-left">Security mode</span>
            <span
              className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                ctx.security_mode ? "bg-positive" : "bg-pill-neutral-bg"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full border border-control bg-surface transition-transform ${
                  ctx.security_mode ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </span>
          </button>
          <button
            onClick={toggleTheme}
            data-ring
            className="flex h-8 items-center gap-2.5 rounded-control px-2 text-body text-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {theme === "dark" ? <Sun className="text-base" /> : <Moon className="text-base" />}
            <span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>
          </button>
        </div>
      </aside>

      {/* ── Main column: 48px top bar on the frame, then the white sheet ────
          Full height at every width so the composer, which is the screen's
          main job, is always reachable without scrolling. */}
      <div className="flex h-svh min-w-0 flex-col">
        <header className="flex h-topbar shrink-0 items-center gap-3 bg-ground px-4">
          <button
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
            aria-controls="nav"
            data-ring
            className="rounded-control p-1.5 text-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
          >
            {navOpen ? <X /> : <Chat />}
            <span className="sr-only">Menu</span>
          </button>
          <p className="truncate text-body text-muted">{TITLES[tab]}</p>
          {plan && tab === "chat" && (
            <Button variant="subtle" size="sm" className="ml-auto" onClick={newPlan}>
              New plan
            </Button>
          )}
        </header>

        {/* the sheet */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden border border-edge bg-surface md:mb-sheet md:mr-sheet md:rounded-sheet">
          {tab === "chat" ? (
            <>
              {/* title row */}
              <div className="shrink-0 border-b border-rule px-5 py-4 md:px-6">
                <h1 className="text-title font-semibold text-ink">Plan a project</h1>
                <p className="mt-1 text-body text-muted">{finding}</p>
              </div>

              {/* the conversation, on the title's left edge. With nothing said
                  yet the start panel centres, so the air reads as placed. */}
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5 md:px-6">
                {atStart && (
                  <StartPanel
                    securityMode={ctx.security_mode}
                    name={ctx.display_name}
                    onPick={(t) => {
                      setDraft(t);
                      inputRef.current?.focus();
                    }}
                  />
                )}
                <div className="flex w-full flex-col gap-4">
                  {!atStart &&
                    messages.map((m) =>
                    m.kind === "user" ? (
                      <UserTurn key={m.id} text={m.text} />
                    ) : m.kind === "mala" ? (
                      <MalaTurn key={m.id} text={m.text} />
                    ) : m.kind === "scan" ? (
                      <WideTurn key={m.id}>
                        <SecurityScan scan={m.scan} />
                      </WideTurn>
                    ) : plan && m.planId === plan.id ? (
                      <WideTurn key={m.id}>
                        <PlanPanel
                          plan={plan}
                          busy={busy}
                          onDecide={decidePhase}
                          onChat={chatPhase}
                          onApprove={decide}
                          onAccept={() => setConfirmAccept(true)}
                        />
                      </WideTurn>
                    ) : (
                      <MalaTurn key={m.id} text="That plan was replaced by a newer revision." muted />
                    )
                  )}

                  {busy && (
                    <div className="flex items-center gap-2.5">
                      <span className="h-7 w-7 shrink-0">
                        <Mascot mood={mood} />
                      </span>
                      <span className="flex gap-1" aria-label="Mala is working">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 animate-dot-step rounded-full bg-control"
                            style={{ animationDelay: `${i * 0.16}s` }}
                          />
                        ))}
                      </span>
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

              {/* composer: the screen's main job, always one click away */}
              <div className="shrink-0 border-t border-rule px-5 py-4 md:px-6">
                <div className="mx-auto max-w-3xl">
                  {plan && (
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-small text-muted">Change the plan:</span>
                      {["prototype only, no deployment", "add CI/CD", "simplify it"].map((q) => (
                        <button
                          key={q}
                          onClick={() => setDraft(q)}
                          data-ring
                          className="rounded-control border border-edge px-2 py-1 text-small text-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <label htmlFor="composer" className="sr-only">
                      {plan ? "Tell Mala what to change" : "Describe your project"}
                    </label>
                    <textarea
                      id="composer"
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      rows={1}
                      disabled={busy}
                      placeholder={plan ? "Tell Mala what to change" : "Describe your project"}
                      className="max-h-40 min-h-9 flex-1 resize-y rounded-control border border-control bg-surface px-3 py-2 text-body text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                    />
                    <Button
                      variant="primary"
                      onClick={send}
                      disabled={!draft.trim() || busy}
                      loading={busy}
                    >
                      {!busy && (plan ? <Adapt /> : <Sparkle />)}
                      {plan ? "Update" : "Send"}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-small text-faint">
                    Enter sends, Shift plus Enter makes a new line.
                    {ctxCount > 0 && " Your context applies to every plan."}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
              <h1 className="mb-4 text-title font-semibold text-ink">{TITLES[tab]}</h1>
              {tab === "pantry" ? <SkillsTab skills={skills} /> : <HistoryTab />}
            </div>
          )}
        </main>
      </div>

      {/* ── overlays ─────────────────────────────────────────────────────── */}
      <ContextPanel
        open={ctxOpen}
        value={ctx}
        saving={ctxSaving}
        learnedNote={learned?.note || undefined}
        onSave={saveCtx}
        onClear={clearCtx}
        onClose={() => setCtxOpen(false)}
      />

      <ConfirmDialog
        open={confirmAccept}
        title="Finalise this plan?"
        body="I'll turn it into a one-shot prompt and a skills.md you can take to any coding agent. You can keep adapting the plan afterwards."
        confirmLabel="Finalise"
        onConfirm={acceptPlan}
        onCancel={() => setConfirmAccept(false)}
      />

      {acceptResult && (
        <PullDownScreen
          result={acceptResult}
          onClose={() => {
            setAcceptResult(null);
            setShowFeedback(true);
          }}
        />
      )}
      {showFeedback && (
        <FeedbackModal onSubmit={submitFeedback} onClose={() => setShowFeedback(false)} />
      )}
    </div>
  );
}

/* ── turns ─────────────────────────────────────────────────────────────── */

/* ── the first screen, before anything has happened ────────────────────── */

const EXAMPLES = [
  "A SaaS web app with user login, a Postgres database and deployment",
  "A React Native habit tracker with offline sync and push reminders",
  "An internal analytics dashboard over our Stripe and Postgres data",
];

function StartPanel({
  securityMode,
  name,
  onPick,
}: {
  securityMode: boolean;
  name: string;
  onPick: (text: string) => void;
}) {
  /* my-auto centres this when there is room and collapses to the top when the
     content is taller than the viewport, so nothing is ever clipped. */
  return (
    <div className="my-auto w-full">
      <div className="flex items-start gap-4">
        <span className="h-20 w-20 shrink-0 md:h-24 md:w-24">
          <Mascot mood="idle" />
        </span>
        <div className="pt-1">
          <h2 className="text-section font-medium text-ink">
            {name ? `Hi ${name}, I'm Mala.` : "Hi, I'm Mala."}
          </h2>
          <p className="mt-1 max-w-prose text-body text-muted">
            Describe a project in your own words. I'll break it into phases you can keep
            or drop, ask before anything consequential, then hand you a prompt you can
            paste straight into a coding agent.
          </p>
        </div>
      </div>

      {/* what comes back: the three real outputs */}
      <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-rule pt-5 sm:grid-cols-3">
        {[
          ["A phased plan", "Requirements through deployment, each phase backed by verified skills."],
          ["A one-shot prompt", "Everything a coding agent needs, in one paste."],
          ["skills.md", "The guidance used, with its trust status, as a file."],
        ].map(([term, desc]) => (
          <div key={term}>
            <dt className="text-body font-medium text-ink">{term}</dt>
            <dd className="mt-0.5 text-small text-muted">{desc}</dd>
          </div>
        ))}
      </dl>

      {/* something to do, one click from the main job */}
      <div className="mt-6 border-t border-rule pt-5">
        <h3 className="text-body font-medium text-ink">Start from an example</h3>
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <button
                onClick={() => onPick(ex)}
                data-ring
                className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Sparkle className="shrink-0 text-base text-muted" />
                <span className="text-body text-ink">{ex}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-small text-muted">
          {securityMode ? (
            <>
              <Shield className="text-positive" />
              Security mode is on, so you'll see each skill verified before it is used.
            </>
          ) : (
            <>
              <Shield className="text-muted" />
              Turn on security mode in the sidebar to watch each skill being verified.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function MalaTurn({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="h-7 w-7 shrink-0">
        <Mascot mood="idle" />
      </span>
      <p
        className={`max-w-[46rem] rounded-card px-3.5 py-2.5 text-body ${
          muted ? "bg-raised text-faint" : "bg-raised text-ink"
        }`}
      >
        {text}
      </p>
    </div>
  );
}

function UserTurn({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[46rem] whitespace-pre-wrap rounded-card bg-primary px-3.5 py-2.5 text-body text-primary-ink">
        {text}
      </p>
    </div>
  );
}

function WideTurn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="h-7 w-7 shrink-0">
        <Mascot mood="idle" />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/* ── the plan, as a panel in the conversation ──────────────────────────── */

function PlanPanel({
  plan,
  busy,
  onDecide,
  onChat,
  onApprove,
  onAccept,
}: {
  plan: Plan;
  busy: boolean;
  onDecide: (phaseId: string, decision: "accepted" | "rejected" | "pending") => Promise<void>;
  onChat: (phaseId: string, message: string) => Promise<void>;
  onApprove: (approvalId: string, decision: "approve" | "reject") => Promise<void>;
  onAccept: () => void;
}) {
  const accepted = plan.phases.filter((p) => p.decision === "accepted").length;
  const rejected = plan.phases.filter((p) => p.decision === "rejected").length;
  const notes = plan.notes.filter((n) => !n.startsWith("session:"));

  return (
    <section className="rounded-card border border-edge bg-surface">
      <header className="border-b border-rule px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-section font-medium text-ink">Your plan</h2>
          <p className="num text-small text-muted">
            {plan.phases.length} phases
            {plan.revision > 1 && `, revision ${plan.revision}`}
            {accepted > 0 && `, ${accepted} kept`}
            {rejected > 0 && `, ${rejected} dropped`}
          </p>
        </div>
        <p className="mt-1.5 text-body text-muted">{plan.summary}</p>
        {notes.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5">
            {notes.map((n, i) => (
              <li key={i} className="text-small text-faint">
                {n}
              </li>
            ))}
          </ul>
        )}
      </header>

      {plan.pending_approvals.length > 0 && (
        <div className="border-b border-rule px-4 py-3.5">
          <p className="mb-2 flex items-center gap-2 text-body font-medium text-ink">
            <Shield className="shrink-0 text-base text-warning" />
            Waiting on you before these steps
          </p>
          <ul className="flex flex-col gap-1.5">
            {plan.pending_approvals.map((a) => (
              <li
                key={a}
                className="flex h-row flex-wrap items-center justify-between gap-2 rounded-control bg-pill-warn-bg px-3"
              >
                <span className="text-body text-pill-warn-ink">{approvalLabel(a)}</span>
                <span className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => onApprove(a, "approve")}>
                    <Check /> Approve
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => onApprove(a, "reject")}>
                    Hold
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2.5 px-4 py-3.5">
        {plan.phases.map((ph, i) => (
          <PhaseCard key={ph.id} phase={ph} index={i} onDecide={onDecide} onChat={onChat} />
        ))}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-4 py-3">
        <p className="text-small text-muted">Finalise to get your prompt and skills file.</p>
        <Button variant="accent" onClick={onAccept} disabled={busy}>
          <Check /> Finalise plan
        </Button>
      </footer>
    </section>
  );
}
