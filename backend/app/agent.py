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
    PhaseChatTurn,
    PhaseChatTurn,
    PlanRequest,
    AdaptRequest,
    Skill,
    TrustLevel,
)
from .skilldb import skill_db
from .verification import safe_instructions, scan_and_release, GUARDRAIL_PREAMBLE
from .llm import get_llm
from . import preferences
from . import context as user_context

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
        """Re-order discovered skills by what the user prefers.

        Two signals, both transparent and both pure re-ranking (never adds
        skills or changes trust):
          * explicit global context  -> strong weight (the user said so)
          * learned preferences      -> weaker weight (the agent inferred it)
        Technologies the user asked to avoid are pushed down.
        """
        ctx = user_context.load()
        explicit = {t.lower() for t in ctx.preferred_stack}
        avoided = {t.lower() for t in ctx.avoid}
        learned = {t.lower() for t in preferences.preferred_techs()}
        if not (explicit or avoided or learned):
            return discovered

        def score(skill: Skill) -> int:
            techs = [t.lower() for t in skill.technologies]
            s = 0
            s += 3 * sum(1 for t in techs if t in explicit)
            s += 1 * sum(1 for t in techs if t in learned)
            s -= 4 * sum(1 for t in techs if t in avoided)
            return s

        # Stable sort by score descending keeps original relevance as tiebreak.
        return sorted(discovered, key=score, reverse=True)

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
            # Scan-on-call: every skill is unverified in storage. The moment we
            # call upon it here, we scan it live. Clean -> released (VERIFIED)
            # with fenced guidance; dirty -> BLOCKED and its text never shown.
            released, fenced = scan_and_release(s)
            # Mutate the skill in place so the plan's skills_used list reflects
            # the call-time verdict (used by one-shot prompt + skills.md).
            s.trust_level = released.trust_level
            s.verification = released.verification

            if released.trust_level == TrustLevel.BLOCKED:
                detail = f"[blocked skill '{s.name}' excluded from guidance]"
            elif fenced:
                detail = fenced
            else:
                detail = f"[skill '{s.name}' released but carried no guidance]"
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

        # Global personalisation context is authoritative user-stated truth and
        # is handed to the planner alongside the idea itself.
        ctx = user_context.load()
        ctx_block = ctx.as_prompt_block()
        prompt = f"{req.idea}\nExperience: {req.experience_level}\nPreferences: {', '.join(req.preferences)}"
        if ctx_block:
            prompt += f"\n\nAbout this user (applies to every plan):\n{ctx_block}"

        summary = self._llm.complete(
            system=GUARDRAIL_PREAMBLE
            + "\nYou are Lao Gan Ma, a trustworthy AI project-planning agent.",
            prompt=prompt,
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

        if ctx_block:
            applied: List[str] = []
            if ctx.display_name:
                applied.append(f"planning for {ctx.display_name}")
            if ctx.preferred_stack:
                applied.append("favouring " + ", ".join(ctx.preferred_stack[:4]))
            if ctx.avoid:
                applied.append("avoiding " + ", ".join(ctx.avoid[:3]))
            if ctx.constraints:
                applied.append(f"{len(ctx.constraints)} standing constraint(s) honoured")
            if applied:
                plan.notes.append("Your context: " + "; ".join(applied) + ".")

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

    # -- per-proposal decisions + discussion ----------------------------
    def decide_phase(self, plan_id: str, phase_id: str, decision: str) -> Plan | None:
        """Accept / reject / reset an individual proposal (phase)."""
        plan = self._store.get(plan_id)
        if plan is None:
            return None
        if decision not in ("accepted", "rejected", "pending"):
            return plan
        for ph in plan.phases:
            if ph.id == phase_id:
                ph.decision = decision
                # Reflect the decision in the display status too.
                if decision == "accepted":
                    ph.status = "accepted"
                elif decision == "rejected":
                    ph.status = "rejected"
                else:
                    ph.status = "proposed"
                plan.notes.append(f"Proposal '{ph.name}' {decision} by user.")
                break
        return plan

    def chat_about_phase(self, plan_id: str, phase_id: str, message: str) -> Plan | None:
        """Answer a user question about a specific proposal (phase).

        The answer is grounded in that phase's goal, tasks, recommended
        technologies, and the VERIFIED guidance of its skills (trust boundary:
        unverified/blocked skill text is never fed to the LLM).
        """
        plan = self._store.get(plan_id)
        if plan is None:
            return None
        phase = next((p for p in plan.phases if p.id == phase_id), None)
        if phase is None:
            return plan

        # Build grounded context from verified skills only.
        skill_by_id = {s.id: s for s in plan.skills_used}
        guidance_lines = []
        for sid in phase.recommended_skills:
            s = skill_by_id.get(sid)
            if not s:
                continue
            g = safe_instructions(s)
            if g:
                guidance_lines.append(f"- {s.name}: {g}")
        guidance = "\n".join(guidance_lines) or "(no verified skill guidance for this phase)"

        tasks = "\n".join(f"- {t.title}: {t.detail}" for t in phase.tasks)
        system = (
            "You are Lao Gan Ma, a trustworthy AI project-planning agent. Answer "
            "the user's question about ONE specific phase of their project plan. "
            "Explain reasoning, trade-offs and specifics. Base your answer only on "
            "the phase context and verified guidance provided; if something is "
            "outside that context, say so briefly. Be concise and practical."
        )
        prompt = (
            f"Project idea: {plan.idea}\n"
            f"Experience level: {plan.experience_level}\n\n"
            f"Phase under discussion: {phase.name}\n"
            f"Goal: {phase.goal}\n"
            f"Recommended technologies: {', '.join(phase.recommended_tech) or 'n/a'}\n"
            f"Tasks:\n{tasks}\n\n"
            f"Verified skill guidance:\n{guidance}\n\n"
            f"User question: {message}"
        )
        # With a real LLM, use its grounded answer. With the offline mock,
        # the generic planning blurb isn't useful here, so use a grounded,
        # phase-specific fallback instead.
        if getattr(self._llm, "name", "") == "mock":
            answer = self._grounded_phase_answer(phase, message, guidance_lines)
        else:
            answer = self._llm.complete(system=system, prompt=prompt)
            if not answer or not answer.strip():
                answer = self._grounded_phase_answer(phase, message, guidance_lines)

        phase.chat.append(PhaseChatTurn(role="user", content=message))
        phase.chat.append(PhaseChatTurn(role="agent", content=answer))
        return plan

    def _grounded_phase_answer(self, phase: Phase, message: str, guidance_lines: List[str]) -> str:
        """Deterministic, phase-specific answer used when no live LLM is set.

        Grounded entirely in the phase's own context so it's useful offline and
        never leaks unverified skill text (guidance_lines are verified-only).
        """
        techs = ", ".join(phase.recommended_tech) or "the recommended tools"
        parts = [
            f"**{phase.name}** — {phase.goal}",
            f"Why it's here: this phase addresses the \"{phase.name.lower()}\" part of your "
            f"project and is planned around {techs}.",
        ]
        if phase.tasks:
            parts.append("Key steps:\n" + "\n".join(f"• {t.title}" for t in phase.tasks[:5]))
        if guidance_lines:
            parts.append("Verified guidance applied here:\n" + "\n".join(guidance_lines[:4]))
        parts.append(
            "You can Accept this proposal to keep it, or Reject it to drop it from the "
            "final plan and generated prompt."
        )
        parts.append(
            "_(Grounded offline answer. Set a Groq API key for richer, free-form reasoning.)_"
        )
        return "\n\n".join(parts)

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

        # Global personalisation context — user-stated truth that should shape
        # every decision the downstream coding agent makes.
        ctx_block = user_context.load().as_prompt_block()
        if ctx_block:
            lines.append(
                "\n# About the developer (honour these throughout)\n" + ctx_block
            )

        # Recommended stack (verified skills only).
        techs = sorted({t for s in self._verified_skills(plan) for t in s.technologies})
        if techs:
            lines.append("\n# Recommended technology stack\n- " + "\n- ".join(techs))

        # Phases — rejected proposals are excluded from the build prompt.
        included = [ph for ph in plan.phases if ph.decision != "rejected"]
        excluded = [ph for ph in plan.phases if ph.decision == "rejected"]
        lines.append("\n# Build plan (phases)")
        for i, ph in enumerate(included, 1):
            flag = " [accepted]" if ph.decision == "accepted" else ""
            lines.append(f"\n## {i}. {ph.name}{flag}\n{ph.goal}")
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

        # Best-practice guidance block from skills released by the call-time
        # scan. Each is re-scanned and fenced here so the downstream coding
        # agent also receives it as clearly-marked untrusted reference data.
        guidance = []
        for s in self._verified_skills(plan):
            _, fenced = scan_and_release(s)
            if fenced:
                guidance.append(f"- **{s.name}** ({', '.join(s.technologies)}):\n{fenced}")
        if guidance:
            lines.insert(0, GUARDRAIL_PREAMBLE)
            lines.append("\n# Best-practice guidance (released by verification)\n" + "\n".join(guidance))

        lines.append(
            "\n# Deliverables\nProduce a working, well-structured codebase that "
            "implements every phase above, with clear setup instructions and "
            "automated tests where practical."
        )
        if excluded:
            lines.append(
                "\n# Explicitly excluded (rejected by the user)\nDo NOT implement: "
                + ", ".join(ph.name for ph in excluded)
            )
        lines.append(
            "\n> Note: guidance above comes from skills that passed Lao Gan Ma's "
            "verification (trust boundary). Untrusted/unverified skills were "
            "excluded."
        )
        return "\n".join(lines)

    def _skillmd_slug(self, name: str) -> str:
        """Anthropic SKILL.md name rule: lowercase, digits, hyphens only;
        no leading/trailing hyphen; max 64 chars."""
        import re as _re
        slug = _re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        return slug[:64].strip("-") or "skill"

    def _render_skilldb_verbatim(self, s: Skill) -> str:
        """Render a SkillDB-sourced skill using its content VERBATIM.

        The skill text is quoted exactly as SkillDB returned it — no
        summarising or paraphrasing — with clear attribution.
        """
        badge = {"verified": "✅", "unverified": "⚠️", "blocked": "🛑"}.get(
            s.trust_level.value, "?"
        )
        out = [
            f"## {badge} {s.name}",
            f"- **Source:** SkillDB (verbatim) — `{s.source_ref or s.id}`",
            f"- **Category:** {s.category}",
            f"- **Trust:** {s.trust_level.value}",
            f"- **Technologies:** {', '.join(s.technologies) or '—'}",
            "",
            "> _Content below is reproduced verbatim from SkillDB; not summarised._",
            "",
        ]
        if s.trust_level == TrustLevel.BLOCKED:
            out.append("_Guidance withheld — this skill failed verification and is excluded._")
        else:
            # Verbatim block, fenced to preserve it exactly.
            content = (s.verbatim or s.instructions or s.summary).rstrip()
            out.append("```text")
            out.append(content)
            out.append("```")
            if s.upgrade_note:
                out.append(f"\n_{s.upgrade_note}_")
        return "\n".join(out) + "\n"

    def _render_agent_skillmd(self, s: Skill) -> str:
        """Render an agent-authored skill in Anthropic's SKILL.md format.

        Spec: YAML frontmatter with required `name` + `description`, then a
        Markdown body. See
        https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
        and the open spec at https://agentskills.io/specification.
        """
        name = self._skillmd_slug(s.name)
        # description: what it does + when to use it (1-3 sentences).
        desc = s.summary.strip().rstrip(".")
        when = f"Use when working on {s.category} tasks"
        if s.technologies:
            when += f" involving {', '.join(s.technologies)}"
        description = f"{desc}. {when}."

        body_guidance = s.instructions.strip() if s.trust_level == TrustLevel.VERIFIED else ""
        lines = [
            f"### 📄 `{name}/SKILL.md`  _(authored by Lao Gan Ma · Anthropic SKILL.md format)_",
            "",
            "```markdown",
            "---",
            f"name: {name}",
            f"description: {description}",
            "---",
            "",
            f"# {s.name}",
            "",
            "## Overview",
            s.summary.strip(),
            "",
            "## When to use",
            when + ".",
            "",
            "## Instructions",
        ]
        if body_guidance:
            lines.append(body_guidance)
        elif s.trust_level == TrustLevel.BLOCKED:
            lines.append("_Withheld — this skill failed verification._")
        else:
            lines.append("_Withheld — pending verification._")
        if s.technologies:
            lines += ["", "## Technologies", ", ".join(s.technologies)]
        lines += ["```", ""]
        return "\n".join(lines)

    def _build_skills_markdown(self, plan: Plan) -> str:
        """Render all skills used in this plan as a skills.md document.

        - Skills sourced from SkillDB are reproduced **verbatim** (not
          summarised), with attribution.
        - Skills authored by this agent are emitted as proper **SKILL.md**
          files following Anthropic's Agent Skills format.
        Rejected proposals' skills are omitted.
        """
        rejected_ids = {
            sid for ph in plan.phases if ph.decision == "rejected" for sid in ph.recommended_skills
        }
        skills = [s for s in plan.skills_used if s.id not in rejected_ids]

        md: List[str] = []
        md.append(f"# Skills for: {plan.idea}\n")
        md.append(
            "_Generated by Lao Gan Ma. SkillDB skills are reproduced verbatim; "
            "agent-authored skills follow Anthropic's SKILL.md format. Only "
            "**verified** skills contribute guidance to the plan._\n"
        )

        from_skilldb = [s for s in skills if s.source == "skilldb.dev"]
        authored = [s for s in skills if s.source != "skilldb.dev"]

        if from_skilldb:
            md.append("# Skills from SkillDB (verbatim)\n")
            md.extend(self._render_skilldb_verbatim(s) for s in from_skilldb)
        if authored:
            md.append("# Agent-authored skills (Anthropic SKILL.md format)\n")
            md.extend(self._render_agent_skillmd(s) for s in authored)
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
