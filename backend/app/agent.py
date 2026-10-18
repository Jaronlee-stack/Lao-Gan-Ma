"""The Lao Gan Ma planning agent.

Responsibilities:
  * plan()    - turn an idea into phased, skill-backed plan
  * adapt()   - re-plan when a constraint or scope changes
  * approve() - record a human decision on a consequential action

Trust boundary: the agent reads skill guidance ONLY through
verification.safe_instructions(), so unverified/blocked skills can never
influence the generated plan.
"""
from __future__ import annotations

import uuid
from typing import Dict, List

from .models import (
    Plan,
    Phase,
    PhaseTask,
    PlanRequest,
    AdaptRequest,
    Skill,
    TrustLevel,
)
from .skilldb import skill_db
from .verification import safe_instructions
from .llm import get_llm

# Canonical lifecycle phases. Each maps to the skill categories it draws from.
_PHASE_BLUEPRINT = [
    ("requirements", "Requirements Gathering", "Clarify scope, users and success criteria.", ["planning"]),
    ("design", "UI/UX Design", "Design user flows and a component system.", ["design"]),
    ("frontend", "Frontend Development", "Build the user-facing application.", ["frontend"]),
    ("backend", "Backend Development", "Build the API and business logic.", ["backend"]),
    ("database", "Database Integration", "Model and persist the application data.", ["database"]),
    ("security", "Security", "Protect accounts, data and access.", ["security"]),
    ("ml", "Intelligence / ML", "Add data-driven or ML features if needed.", ["machine-learning"]),
    ("testing", "Testing & QA", "Verify correctness with automated tests.", ["testing"]),
    ("deploy", "Deployment", "Ship the product with a repeatable pipeline.", ["infrastructure"]),
]

# Phases whose decisions are consequential and require human sign-off.
_APPROVAL_PHASES = {"security", "deploy", "database"}


class PlanningAgent:
    def __init__(self):
        self._store: Dict[str, Plan] = {}
        self._llm = get_llm()

    # -- discovery -------------------------------------------------------
    def _skills_for(self, categories: List[str], discovered: List[Skill]) -> List[Skill]:
        return [s for s in discovered if s.category in categories]

    def _build_phases(self, discovered: List[Skill], experience: str) -> List[Phase]:
        phases: List[Phase] = []
        for key, name, goal, cats in _PHASE_BLUEPRINT:
            matched = self._skills_for(cats, discovered)
            # Only include ML phase if a relevant skill was actually discovered.
            if key == "ml" and not matched:
                continue

            tech: List[str] = []
            for s in matched:
                tech.extend(s.technologies)

            tasks = self._tasks_for_phase(key, name, matched)
            phases.append(
                Phase(
                    id=key,
                    name=name,
                    goal=goal,
                    tasks=tasks,
                    recommended_skills=[s.id for s in matched],
                    recommended_tech=sorted(set(tech)),
                    status="proposed",
                )
            )
        return phases

    def _tasks_for_phase(self, key: str, name: str, matched: List[Skill]) -> List[PhaseTask]:
        tasks: List[PhaseTask] = []
        needs_approval = key in _APPROVAL_PHASES

        for s in matched:
            # Enforcement: verified skills contribute their guidance; others
            # contribute only their (data-only) name so the user still sees them.
            guidance = safe_instructions(s)
            if guidance:
                detail = guidance
            elif s.trust_level == TrustLevel.BLOCKED:
                detail = f"[blocked skill '{s.name}' excluded from guidance]"
            else:
                detail = f"[skill '{s.name}' pending verification — guidance withheld]"
            tasks.append(
                PhaseTask(
                    title=f"Apply: {s.name}",
                    detail=detail,
                    approval_required=needs_approval,
                )
            )

        if not tasks:
            tasks.append(
                PhaseTask(
                    title=f"Plan {name}",
                    detail=f"Define the concrete steps for the {name.lower()} phase.",
                    approval_required=needs_approval,
                )
            )
        return tasks

    # -- public API ------------------------------------------------------
    def plan(self, req: PlanRequest) -> Plan:
        discovered = skill_db.discover(req.idea, req.experience_level, limit=12)
        phases = self._build_phases(discovered, req.experience_level)

        pending = [
            f"{p.id}:{p.name}" for p in phases if any(t.approval_required for t in p.tasks)
        ]

        summary = self._llm.complete(
            system="You are Lao Gan Ma, a trustworthy AI project-planning agent.",
            prompt=f"{req.idea}\nExperience: {req.experience_level}\nPreferences: {', '.join(req.preferences)}",
        )

        plan = Plan(
            id=str(uuid.uuid4())[:8],
            idea=req.idea,
            experience_level=req.experience_level,
            summary=summary,
            phases=phases,
            skills_used=discovered,
            pending_approvals=pending,
            notes=[f"Planner LLM: {self._llm.name}"],
        )

        blocked = [s.name for s in discovered if s.trust_level == TrustLevel.BLOCKED]
        if blocked:
            plan.notes.append(
                f"Verification blocked {len(blocked)} untrusted skill(s): {', '.join(blocked)}."
            )

        self._store[plan.id] = plan
        return plan

    def get(self, plan_id: str) -> Plan | None:
        return self._store.get(plan_id)

    def adapt(self, req: AdaptRequest) -> Plan | None:
        plan = self._store.get(req.plan_id)
        if plan is None:
            return None

        change_lc = req.change.lower()
        plan.revision += 1
        plan.notes.append(f"Rev {plan.revision}: adapted for change -> '{req.change}'")

        # Re-discover skills with the change folded into the idea context.
        enriched_idea = f"{plan.idea}. Change: {req.change}"
        discovered = skill_db.discover(enriched_idea, plan.experience_level, limit=12)
        new_phases = self._build_phases(discovered, plan.experience_level)

        # Mark phases whose skill set changed so the user sees what moved.
        old_by_id = {p.id: p for p in plan.phases}
        for np in new_phases:
            old = old_by_id.get(np.id)
            if old is None or set(old.recommended_skills) != set(np.recommended_skills):
                np.status = "changed"

        plan.phases = new_phases
        plan.skills_used = discovered
        plan.pending_approvals = [
            f"{p.id}:{p.name}" for p in new_phases if any(t.approval_required for t in p.tasks)
        ]

        # Scope-reduction hint: drop deployment if user says "prototype only".
        if any(k in change_lc for k in ("prototype only", "no deploy", "mvp only")):
            plan.phases = [p for p in plan.phases if p.id != "deploy"]
            plan.pending_approvals = [a for a in plan.pending_approvals if not a.startswith("deploy:")]
            plan.notes.append("Dropped deployment phase per scope reduction.")

        return plan

    def approve(self, plan_id: str, approval_id: str, decision: str, note: str = "") -> Plan | None:
        plan = self._store.get(plan_id)
        if plan is None:
            return None
        if approval_id not in plan.pending_approvals:
            return plan

        phase_id = approval_id.split(":", 1)[0]
        for p in plan.phases:
            if p.id == phase_id:
                p.status = "approved" if decision == "approve" else "changed"
        plan.pending_approvals = [a for a in plan.pending_approvals if a != approval_id]
        plan.notes.append(
            f"Human {decision} on '{approval_id}'" + (f" — {note}" if note else "")
        )
        return plan


agent = PlanningAgent()
