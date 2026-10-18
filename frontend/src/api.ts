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
}

export interface PhaseTask {
  title: string;
  detail: string;
  approval_required: boolean;
}

export interface Phase {
  id: string;
  name: string;
  goal: string;
  tasks: PhaseTask[];
  recommended_skills: string[];
  recommended_tech: string[];
  status: "proposed" | "approved" | "changed";
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

export const api = {
  listSkills: () => fetch("/api/skills").then((r) => json<Skill[]>(r)),

  createPlan: (body: {
    idea: string;
    experience_level: string;
    preferences: string[];
    constraints: string[];
  }) =>
    fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<Plan>(r)),

  adaptPlan: (plan_id: string, change: string) =>
    fetch("/api/plan/adapt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id, change }),
    }).then((r) => json<Plan>(r)),

  approve: (plan_id: string, approval_id: string, decision: "approve" | "reject", note = "") =>
    fetch("/api/plan/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id, approval_id, decision, note }),
    }).then((r) => json<Plan>(r)),
};
