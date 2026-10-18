"""Lao Gan Ma — FastAPI application entry point."""
from __future__ import annotations

import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from .models import (
    PlanRequest,
    AdaptRequest,
    ApprovalRequest,
    AcceptRequest,
    AcceptResult,
    FeedbackRequest,
    SessionSummary,
    ChatMessage,
    Plan,
    Skill,
)
from .agent import agent
from .skilldb import skill_db
from .verification import verify_skill
from . import db
from . import preferences

app = FastAPI(
    title="Lao Gan Ma — AI Project Agent",
    description="An autonomous AI agent that plans software projects, adapts to change, "
    "and seeks human approval before consequential actions. Skills are verified "
    "before they may influence planning. Chat history, feedback, and learned "
    "preferences are persisted in SQLite.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "lao-gan-ma"}


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------
@app.get("/api/skills", response_model=list[Skill])
def list_skills() -> list[Skill]:
    return skill_db.all()


@app.get("/api/skills/source")
def skills_source() -> dict:
    """Where skills come from, for UI attribution."""
    return {
        "provider": "SkillDB",
        "url": "https://skilldb.dev",
        "live_status": skill_db.live_status,
        "note": "Skills are discovered from the SkillDB service and verified "
        "before they can influence a plan. Falls back to a local seed store "
        "when offline.",
    }


@app.get("/api/skills/discover", response_model=list[Skill])
def discover_skills(idea: str, experience: str = "intermediate") -> list[Skill]:
    return skill_db.discover(idea, experience)


@app.post("/api/skills/{skill_id}/verify", response_model=Skill)
def verify(skill_id: str) -> Skill:
    skill = skill_db.get(skill_id)
    if skill is None:
        raise HTTPException(404, "skill not found")
    report = verify_skill(skill)
    skill.trust_level = report.trust_level
    skill.verification = report
    return skill


# ---------------------------------------------------------------------------
# Planning
# ---------------------------------------------------------------------------
@app.post("/api/plan", response_model=Plan)
def create_plan(req: PlanRequest) -> Plan:
    plan = agent.plan(req)
    # Persist to chat history under a session (create one if not provided).
    session_id = getattr(req, "session_id", None) or str(uuid.uuid4())[:8]
    db.create_session(session_id, title=req.idea[:60])
    db.add_message(session_id, "user", req.idea, meta={"experience": req.experience_level})
    db.add_message(session_id, "agent", plan.summary, meta={"plan_id": plan.id})
    plan.notes.append(f"session:{session_id}")
    return plan


@app.get("/api/plan/{plan_id}", response_model=Plan)
def get_plan(plan_id: str) -> Plan:
    plan = agent.get(plan_id)
    if plan is None:
        raise HTTPException(404, "plan not found")
    return plan


@app.post("/api/plan/adapt", response_model=Plan)
def adapt_plan(req: AdaptRequest) -> Plan:
    plan = agent.adapt(req)
    if plan is None:
        raise HTTPException(404, "plan not found")
    return plan


@app.post("/api/plan/approve", response_model=Plan)
def approve_action(req: ApprovalRequest) -> Plan:
    plan = agent.approve(req.plan_id, req.approval_id, req.decision, req.note)
    if plan is None:
        raise HTTPException(404, "plan not found")
    return plan


# ---------------------------------------------------------------------------
# Accept plan -> one-shot prompt + skills.md
# ---------------------------------------------------------------------------
@app.post("/api/plan/accept", response_model=AcceptResult)
def accept_plan(req: AcceptRequest) -> AcceptResult:
    result = agent.accept(req.plan_id)
    if result is None:
        raise HTTPException(404, "plan not found")
    one_shot, skills_md = result
    if req.session_id:
        db.add_message(req.session_id, "agent", "Plan accepted — generated one-shot prompt.",
                       meta={"plan_id": req.plan_id, "event": "accept"})
    return AcceptResult(
        plan_id=req.plan_id,
        one_shot_prompt=one_shot,
        skills_markdown=skills_md,
        learned=preferences.preference_summary(),
    )


@app.get("/api/plan/{plan_id}/skills.md", response_class=PlainTextResponse)
def download_skills_md(plan_id: str) -> str:
    plan = agent.get(plan_id)
    if plan is None:
        raise HTTPException(404, "plan not found")
    return agent._build_skills_markdown(plan)


# ---------------------------------------------------------------------------
# Chat history
# ---------------------------------------------------------------------------
@app.get("/api/sessions", response_model=list[SessionSummary])
def list_sessions() -> list[SessionSummary]:
    return [SessionSummary(**s) for s in db.list_sessions()]


@app.get("/api/sessions/{session_id}/messages", response_model=list[ChatMessage])
def session_messages(session_id: str) -> list[ChatMessage]:
    return [ChatMessage(**m) for m in db.get_messages(session_id)]


# ---------------------------------------------------------------------------
# Feedback + preferences (self-learning)
# ---------------------------------------------------------------------------
@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest) -> dict:
    db.add_feedback(req.session_id, req.plan_id, req.rating, req.remarks)
    plan = agent.get(req.plan_id) if req.plan_id else None
    preferences.learn_from_feedback(plan, req.rating)
    return {"ok": True, "stats": db.feedback_stats(), "learned": preferences.preference_summary()}


@app.get("/api/feedback")
def get_feedback() -> dict:
    return {"items": db.list_feedback(), "stats": db.feedback_stats()}


@app.get("/api/preferences")
def get_prefs() -> dict:
    return preferences.preference_summary()
