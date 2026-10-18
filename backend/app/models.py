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


# ---------------------------------------------------------------------------
# Planning
# ---------------------------------------------------------------------------
class PlanRequest(BaseModel):
    idea: str = Field(..., min_length=3, description="Natural-language project idea")
    experience_level: str = Field("intermediate", description="beginner | intermediate | advanced")
    preferences: List[str] = Field(default_factory=list, description="Preferred technologies/tools")
    constraints: List[str] = Field(default_factory=list, description="Deadlines, budget, platform limits")


class PhaseTask(BaseModel):
    title: str
    detail: str
    approval_required: bool = False


class Phase(BaseModel):
    id: str
    name: str
    goal: str
    tasks: List[PhaseTask] = Field(default_factory=list)
    recommended_skills: List[str] = Field(default_factory=list)  # skill ids
    recommended_tech: List[str] = Field(default_factory=list)
    status: str = "proposed"  # proposed | approved | changed


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
