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
from . import preferences

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

    def _apply_learned_bias(self, discovered: List[Skill]) -> List[Skill]:
        """Re-order discovered skills so learned-favourite technologies surface
        first. Pure re-ranking — never adds unverified skills or changes trust.
        """
        favs = {t.lower() for t in preferences.preferred_techs()}
        if not favs:
            return discovered

        def boost(skill: Skill) -> int:
            return sum(1 for t in skill.technologies if t.lower() in favs)

        # Stable sort by boost descending keeps original relevance as tiebreak.
        return sorted(discovered, key=boost, reverse=True)

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
        discovered = self._apply_learned_bias(discovered)
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

        # Surface what the agent has learned (transparent self-learning).
        pref_note = preferences.preference_summary().get("note")
        if pref_note:
            plan.notes.append(f"Personalisation: {pref_note}")

        self._store[plan.id] = plan
        return plan

    # -- accept: generate one-shot prompt + skills.md --------------------
    def accept(self, plan_id: str) -> tuple[str, str] | None:
        """Finalise a plan: returns (one_shot_prompt, skills_markdown) and
        reinforces learned preferences. Returns None if the plan is unknown."""
        plan = self._store.get(plan_id)
        if plan is None:
            return None

        # Learn from this acceptance.
        preferences.learn_from_accept(plan)

        one_shot = self._build_one_shot_prompt(plan)
        skills_md = self._build_skills_markdown(plan)
        plan.notes.append("Plan accepted — one-shot prompt and skills.md generated.")
        return one_shot, skills_md

    def _verified_skills(self, plan: Plan) -> List[Skill]:
        return [s for s in plan.skills_used if s.trust_level == TrustLevel.VERIFIED]

    def _build_one_shot_prompt(self, plan: Plan) -> str:
        """Compose a single, copy-paste-ready prompt for a coding agent."""
        lines: List[str] = []
        lines.append(
            "You are an expert full-stack engineer. Build the following project "
            "end to end, following the phased plan and verified best-practice "
            "guidance below. Ask for clarification only if a requirement is "
            "ambiguous; otherwise implement it completely."
        )
        lines.append("")
        lines.append(f"# Project idea\n{plan.idea}")
        lines.append(f"\n# Target experience level\n{plan.experience_level}")

        # Recommended stack (verified skills only).
        techs = sorted({t for s in self._verified_skills(plan) for t in s.technologies})
        if techs:
            lines.append("\n# Recommended technology stack\n- " + "\n- ".join(techs))

        # Phases.
        lines.append("\n# Build plan (phases)")
        for i, ph in enumerate(plan.phases, 1):
            status = f" [{ph.status}]" if ph.status != "proposed" else ""
            lines.append(f"\n## {i}. {ph.name}{status}\n{ph.goal}")
            if ph.recommended_tech:
                lines.append("Technologies: " + ", ".join(ph.recommended_tech))
            for t in ph.tasks:
                # Only verified guidance (safe_instructions already enforced at
                # build time) reaches the prompt. Skip placeholder/withheld.
                detail = t.detail
                if detail.startswith("[") and detail.endswith("]"):
                    lines.append(f"- {t.title}")
                else:
                    lines.append(f"- {t.title}: {detail}")

        # Best-practice guidance block from verified skills.
        guidance = [
            f"- **{s.name}** ({', '.join(s.technologies)}): {safe_instructions(s)}"
            for s in self._verified_skills(plan)
            if safe_instructions(s)
        ]
        if guidance:
            lines.append("\n# Verified best-practice guidance\n" + "\n".join(guidance))

        lines.append(
            "\n# Deliverables\nProduce a working, well-structured codebase that "
            "implements every phase above, with clear setup instructions and "
            "automated tests where practical."
        )
        lines.append(
            "\n> Note: guidance above comes from skills that passed Lao Gan Ma's "
            "verification (trust boundary). Untrusted/unverified skills were "
            "excluded."
        )
        return "\n".join(lines)

    def _build_skills_markdown(self, plan: Plan) -> str:
        """Render all skills used in this plan as a skills.md document."""
        md: List[str] = []
        md.append(f"# Skills for: {plan.idea}\n")
        md.append(
            "_Generated by Lao Gan Ma. Each skill below shows its verification "
            "status. Only **verified** skills contribute guidance to the plan._\n"
        )
        verified = [s for s in plan.skills_used if s.trust_level == TrustLevel.VERIFIED]
        others = [s for s in plan.skills_used if s.trust_level != TrustLevel.VERIFIED]

        def render(s: Skill) -> str:
            badge = {"verified": "✅", "unverified": "⚠️", "blocked": "🛑"}.get(
                s.trust_level.value, "?"
            )
            block = [
                f"## {badge} {s.name}  \n",
                f"- **Category:** {s.category}",
                f"- **Trust:** {s.trust_level.value}",
                f"- **Technologies:** {', '.join(s.technologies) or '—'}",
                f"- **Summary:** {s.summary}",
            ]
            if s.trust_level == TrustLevel.VERIFIED and s.instructions:
                block.append(f"- **Guidance:** {s.instructions}")
            elif s.trust_level == TrustLevel.BLOCKED:
                block.append("- **Guidance:** _withheld — skill failed verification_")
            else:
                block.append("- **Guidance:** _withheld — pending verification_")
            return "\n".join(block) + "\n"

        if verified:
            md.append("# Verified skills\n")
            md.extend(render(s) for s in verified)
        if others:
            md.append("# Excluded / unverified skills\n")
            md.extend(render(s) for s in others)
        return "\n".join(md)

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
