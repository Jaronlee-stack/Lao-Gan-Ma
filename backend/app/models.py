"""Pydantic data models shared across the Lao Gan Ma agent."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from pydantic import BaseModel, Field


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Skills & verification
# ---------------------------------------------------------------------------
class TrustLevel(str, Enum):
    """Trust status for a skill retrieved from SkillDB.

    unverified -> instructions treated as inert data only (never followed)
    verified   -> instructions may influence planning output
    blocked    -> skill failed verification; excluded entirely
    """

    UNVERIFIED = "unverified"
    VERIFIED = "verified"
    BLOCKED = "blocked"


class VerificationFinding(BaseModel):
    code: str
    severity: str  # "info" | "warning" | "critical"
    message: str


class VerificationReport(BaseModel):
    skill_id: str
    trust_level: TrustLevel
    signature_ok: bool
    findings: List[VerificationFinding] = Field(default_factory=list)
    checked_at: str = Field(default_factory=_now)


class Skill(BaseModel):
    id: str
    name: str
    category: str
    summary: str
    technologies: List[str] = Field(default_factory=list)
    # Natural-language guidance the skill wants to inject into planning.
    instructions: str = ""
    source: str = "skilldb"
    signature: Optional[str] = None
    experience_levels: List[str] = Field(default_factory=lambda: ["beginner", "intermediate", "advanced"])
    trust_level: TrustLevel = TrustLevel.UNVERIFIED
    verification: Optional[VerificationReport] = None
    # Raw, UNMODIFIED content exactly as returned by SkillDB (verbatim).
    # Only populated for externally-sourced skills; copied, never summarised.
    verbatim: str = ""
    # Attribution for externally-sourced skills (e.g. the SkillDB id/url).
    source_ref: str = ""
    upgrade_note: str = ""


# ---------------------------------------------------------------------------
# Planning
# ---------------------------------------------------------------------------
class PlanRequest(BaseModel):
    idea: str = Field(..., min_length=3, description="Natural-language project idea")
    experience_level: str = Field("intermediate", description="beginner | intermediate | advanced")
    preferences: List[str] = Field(default_factory=list, description="Preferred technologies/tools")
    constraints: List[str] = Field(default_factory=list, description="Deadlines, budget, platform limits")
    session_id: Optional[str] = Field(None, description="Existing chat session to append to")


class PhaseTask(BaseModel):
    title: str
    detail: str
    approval_required: bool = False


class PhaseChatTurn(BaseModel):
    role: str  # "user" | "agent"
    content: str
    created_at: str = Field(default_factory=_now)


class Phase(BaseModel):
    id: str
    name: str
    goal: str
    tasks: List[PhaseTask] = Field(default_factory=list)
    recommended_skills: List[str] = Field(default_factory=list)  # skill ids
    recommended_tech: List[str] = Field(default_factory=list)
    # proposed | approved | changed | accepted | rejected
    status: str = "proposed"
    # Per-phase decision the user makes (independent of approval gating).
    decision: str = "pending"  # pending | accepted | rejected
    # Threaded discussion about this specific proposal.
    chat: List[PhaseChatTurn] = Field(default_factory=list)


class Plan(BaseModel):
    id: str
    idea: str
    experience_level: str
    summary: str
    phases: List[Phase] = Field(default_factory=list)
    skills_used: List[Skill] = Field(default_factory=list)
    # Consequential actions awaiting human sign-off.
    pending_approvals: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=_now)
    revision: int = 1
    notes: List[str] = Field(default_factory=list)


class AdaptRequest(BaseModel):
    plan_id: str
    change: str = Field(..., description="What changed (new constraint, scope shift, etc.)")


class ApprovalRequest(BaseModel):
    plan_id: str
    approval_id: str
    decision: str = Field("approve", description="approve | reject")
    note: str = ""


# ---------------------------------------------------------------------------
# Per-proposal (phase) decisions + discussion
# ---------------------------------------------------------------------------
class PhaseDecisionRequest(BaseModel):
    plan_id: str
    phase_id: str
    decision: str = Field(..., description="accepted | rejected | pending")


class PhaseChatRequest(BaseModel):
    plan_id: str
    phase_id: str
    message: str = Field(..., min_length=1)
    session_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Accept / one-shot prompt / skills export
# ---------------------------------------------------------------------------
class AcceptRequest(BaseModel):
    plan_id: str
    session_id: Optional[str] = None


class AcceptResult(BaseModel):
    plan_id: str
    one_shot_prompt: str
    skills_markdown: str
    learned: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Chat history
# ---------------------------------------------------------------------------
class ChatMessage(BaseModel):
    role: str
    content: str
    meta: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None


class SessionSummary(BaseModel):
    id: str
    title: str
    created_at: str
    message_count: int


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------
class FeedbackRequest(BaseModel):
    plan_id: Optional[str] = None
    session_id: Optional[str] = None
    rating: int = Field(..., ge=1, le=5)
    remarks: str = ""


# ---------------------------------------------------------------------------
# Global personalisation context
# ---------------------------------------------------------------------------
class UserContext(BaseModel):
    """User-authored context applied to every plan, in every session.

    Distinct from learned `preferences`: this is explicit truth the user
    states about themselves, not something the agent inferred.
    """

    display_name: str = Field("", description="What the agent should call you")
    role: str = Field("", description="e.g. solo founder, backend engineer, student")
    experience_level: str = Field("", description="beginner | intermediate | advanced")
    preferred_stack: List[str] = Field(default_factory=list, description="Languages/frameworks you reach for")
    avoid: List[str] = Field(default_factory=list, description="Tech to steer away from")
    constraints: List[str] = Field(default_factory=list, description="Standing constraints (budget, platform, team size)")
    goals: str = Field("", description="What you're generally optimising for")
    notes: str = Field("", description="Anything else the agent should always know")
    security_mode: bool = Field(False, description="Show the verification scan before skills load")

    def as_prompt_block(self) -> str:
        """Render the context as guidance for the planner. Only non-empty fields."""
        lines: List[str] = []
        if self.display_name:
            lines.append(f"- The user's name is {self.display_name}.")
        if self.role:
            lines.append(f"- They work as: {self.role}.")
        if self.experience_level:
            lines.append(f"- Experience level: {self.experience_level}.")
        if self.preferred_stack:
            lines.append(f"- Prefers these technologies: {', '.join(self.preferred_stack)}.")
        if self.avoid:
            lines.append(f"- Avoid recommending: {', '.join(self.avoid)}.")
        if self.constraints:
            lines.append(f"- Standing constraints: {'; '.join(self.constraints)}.")
        if self.goals:
            lines.append(f"- Optimising for: {self.goals}.")
        if self.notes:
            lines.append(f"- Additional context: {self.notes}")
        return "\n".join(lines)

    def is_empty(self) -> bool:
        return not self.as_prompt_block().strip()


# ---------------------------------------------------------------------------
# Security mode: the visible verification scan
# ---------------------------------------------------------------------------
class ScanCheck(BaseModel):
    """One individual check run against one skill."""

    name: str              # e.g. "Signature / trusted source"
    code: str              # e.g. "SIGNATURE"
    passed: bool
    detail: str = ""


class ScanStep(BaseModel):
    """The full verification trace for a single skill."""

    skill_id: str
    skill_name: str
    source: str
    checks: List[ScanCheck] = Field(default_factory=list)
    trust_level: TrustLevel
    verdict: str           # "loaded" | "withheld" | "blocked"
    reason: str = ""


class SecurityScanRequest(BaseModel):
    idea: str = Field(..., min_length=3)
    experience_level: str = "intermediate"


class SecurityScanResult(BaseModel):
    idea: str
    scanned: int
    loaded: int
    withheld: int
    blocked: int
    steps: List[ScanStep] = Field(default_factory=list)
    summary: str = ""
