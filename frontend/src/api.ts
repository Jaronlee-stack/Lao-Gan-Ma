// API types mirror the backend Pydantic models.
export type TrustLevel = "unverified" | "verified" | "blocked";

export interface VerificationFinding {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface VerificationReport {
  skill_id: string;
  trust_level: TrustLevel;
  signature_ok: boolean;
  findings: VerificationFinding[];
  checked_at: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  summary: string;
  technologies: string[];
  instructions: string;
  source: string;
  signature: string | null;
  experience_levels: string[];
  trust_level: TrustLevel;
  verification: VerificationReport | null;
  verbatim?: string;
  source_ref?: string;
  upgrade_note?: string;
}

export interface PhaseTask {
  title: string;
  detail: string;
  approval_required: boolean;
}

export interface PhaseChatTurn {
  role: string;
  content: string;
  created_at: string;
}

export interface Phase {
  id: string;
  name: string;
  goal: string;
  tasks: PhaseTask[];
  recommended_skills: string[];
  recommended_tech: string[];
  status: "proposed" | "approved" | "changed" | "accepted" | "rejected";
  decision: "pending" | "accepted" | "rejected";
  chat: PhaseChatTurn[];
}

export interface Plan {
  id: string;
  idea: string;
  experience_level: string;
  summary: string;
  phases: Phase[];
  skills_used: Skill[];
  pending_approvals: string[];
  created_at: string;
  revision: number;
  notes: string[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface LearnedPrefs {
  preferred_techs: string[];
  preferred_experience: string | null;
  note: string;
  raw: { key: string; value: string; weight: number; updated_at: string }[];
}

export interface AcceptResult {
  plan_id: string;
  one_shot_prompt: string;
  skills_markdown: string;
  learned: LearnedPrefs;
}

export interface SessionSummary {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
}

/** User-authored context applied to every plan, in every session. */
export interface UserContext {
  display_name: string;
  role: string;
  experience_level: string;
  preferred_stack: string[];
  avoid: string[];
  constraints: string[];
  goals: string;
  notes: string;
  security_mode: boolean;
}

export const emptyContext: UserContext = {
  display_name: "",
  role: "",
  experience_level: "",
  preferred_stack: [],
  avoid: [],
  constraints: [],
  goals: "",
  notes: "",
  security_mode: false,
};

/** Security mode: the visible verification trace. */
export interface ScanCheck {
  name: string;
  code: string;
  passed: boolean;
  detail: string;
}

export interface ScanStep {
  skill_id: string;
  skill_name: string;
  source: string;
  checks: ScanCheck[];
  trust_level: TrustLevel;
  verdict: "loaded" | "withheld" | "blocked";
  reason: string;
}

export interface SecurityScanResult {
  idea: string;
  scanned: number;
  loaded: number;
  withheld: number;
  blocked: number;
  steps: ScanStep[];
  summary: string;
}

export interface ChatMessage {
  role: string;
  content: string;
  meta: Record<string, unknown> | null;
  created_at: string | null;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const api = {
  listSkills: () => fetch("/api/skills").then((r) => json<Skill[]>(r)),

  createPlan: (body: {
    idea: string;
    experience_level: string;
    preferences: string[];
    constraints: string[];
    session_id?: string;
  }) =>
    fetch("/api/plan", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }).then((r) => json<Plan>(r)),

  adaptPlan: (plan_id: string, change: string) =>
    fetch("/api/plan/adapt", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ plan_id, change }),
    }).then((r) => json<Plan>(r)),

  approve: (plan_id: string, approval_id: string, decision: "approve" | "reject", note = "") =>
    fetch("/api/plan/approve", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ plan_id, approval_id, decision, note }),
    }).then((r) => json<Plan>(r)),

  decidePhase: (plan_id: string, phase_id: string, decision: "accepted" | "rejected" | "pending") =>
    fetch("/api/plan/phase/decision", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ plan_id, phase_id, decision }),
    }).then((r) => json<Plan>(r)),

  chatPhase: (plan_id: string, phase_id: string, message: string, session_id?: string) =>
    fetch("/api/plan/phase/chat", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ plan_id, phase_id, message, session_id }),
    }).then((r) => json<Plan>(r)),

  acceptPlan: (plan_id: string, session_id?: string) =>
    fetch("/api/plan/accept", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ plan_id, session_id }),
    }).then((r) => json<AcceptResult>(r)),

  sendFeedback: (body: {
    plan_id?: string;
    session_id?: string;
    rating: number;
    remarks: string;
  }) =>
    fetch("/api/feedback", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }).then((r) => json<{ ok: boolean; learned: LearnedPrefs }>(r)),

  listSessions: () => fetch("/api/sessions").then((r) => json<SessionSummary[]>(r)),

  sessionMessages: (id: string) =>
    fetch(`/api/sessions/${id}/messages`).then((r) => json<ChatMessage[]>(r)),

  preferences: () => fetch("/api/preferences").then((r) => json<LearnedPrefs>(r)),

  skillsSource: () =>
    fetch("/api/skills/source").then((r) =>
      json<{ provider: string; url: string; live_status: string; note: string }>(r)
    ),

  browseSkills: (params: { offset?: number; limit?: number; search?: string; domain?: string }) => {
    const q = new URLSearchParams();
    if (params.offset != null) q.set("offset", String(params.offset));
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.search) q.set("search", params.search);
    if (params.domain) q.set("domain", params.domain);
    return fetch(`/api/skills/browse?${q.toString()}`).then((r) =>
      json<{
        skills: Skill[];
        total: number;
        offset: number;
        limit: number;
        has_more: boolean;
        source: string;
      }>(r)
    );
  },

  skillDomains: () =>
    fetch("/api/skills/domains").then((r) => json<{ domains: string[] }>(r)),

  skillsMarkdownUrl: (plan_id: string) => `/api/plan/${plan_id}/skills.md`,

  // -- global personalisation context --------------------------------------
  getContext: () => fetch("/api/context").then((r) => json<UserContext>(r)),

  saveContext: (ctx: UserContext) =>
    fetch("/api/context", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(ctx),
    }).then((r) => json<UserContext>(r)),

  clearContext: () =>
    fetch("/api/context", { method: "DELETE" }).then((r) => json<UserContext>(r)),

  // -- security mode: verification scan -----------------------------------
  securityScan: (idea: string, experience_level = "intermediate") =>
    fetch("/api/security/scan", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ idea, experience_level }),
    }).then((r) => json<SecurityScanResult>(r)),
};
