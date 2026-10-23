"""Lao Gan Ma — FastAPI application entry point."""
from __future__ import annotations

import uuid

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from .models import (
    PlanRequest,
    AdaptRequest,
    ApprovalRequest,
    PhaseDecisionRequest,
    PhaseChatRequest,
    AcceptRequest,
    AcceptResult,
    FeedbackRequest,
    SessionSummary,
    ChatMessage,
    Plan,
    Skill,
    UserContext,
    SecurityScanRequest,
    SecurityScanResult,
)
from .agent import agent
from .skilldb import skill_db
from .verification import verify_skill, scan_skill
from . import db
from . import preferences
from . import context as user_context

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
    """Where skills come from, for UI attribution.

    Runs a live reachability probe (unless already determined) so the UI shows
    an accurate live/offline status immediately, not a stale 'idle'.
    """
    status = skill_db.live_status
    if status in ("idle", "offline"):
        status = skill_db.health_check()
    return {
        "provider": "SkillDB",
        "url": "https://skilldb.dev",
        "live_status": status,
        "note": "Skills are discovered from the SkillDB service and verified "
        "before they can influence a plan. Falls back to a local seed store "
        "when offline.",
    }


@app.get("/api/skills/discover", response_model=list[Skill])
def discover_skills(idea: str, experience: str = "intermediate") -> list[Skill]:
    return skill_db.discover(idea, experience)


@app.get("/api/skills/browse")
def browse_skills(offset: int = 0, limit: int = 50, search: str = "", domain: str = "") -> dict:
    """Browse the full SkillDB catalogue (paginated, verified).

    When live, pages through skilldb.dev's ~6,000+ skills. When offline or
    disabled, returns the local seed store.
    """
    return skill_db.browse(offset=offset, limit=limit, search=search, domain=domain)


@app.get("/api/skills/domains")
def skill_domains() -> dict:
    return {"domains": skill_db.domains()}


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


@app.post("/api/plan/phase/decision", response_model=Plan)
def decide_phase(req: PhaseDecisionRequest) -> Plan:
    """Accept / reject / reset an individual proposal (phase)."""
    plan = agent.decide_phase(req.plan_id, req.phase_id, req.decision)
    if plan is None:
        raise HTTPException(404, "plan not found")
    return plan


@app.post("/api/plan/phase/chat", response_model=Plan)
def chat_phase(req: PhaseChatRequest) -> Plan:
    """Discuss a specific proposal with the agent (reasoning, specifics)."""
    plan = agent.chat_about_phase(req.plan_id, req.phase_id, req.message)
    if plan is None:
        raise HTTPException(404, "plan not found")
    if req.session_id:
        db.add_message(req.session_id, "user", req.message,
                       meta={"plan_id": req.plan_id, "phase_id": req.phase_id})
        phase = next((p for p in plan.phases if p.id == req.phase_id), None)
        if phase and phase.chat:
            db.add_message(req.session_id, "agent", phase.chat[-1].content,
                           meta={"plan_id": req.plan_id, "phase_id": req.phase_id})
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


# ---------------------------------------------------------------------------
# Global personalisation context
# ---------------------------------------------------------------------------
@app.get("/api/context", response_model=UserContext)
def get_context() -> UserContext:
    """The user-authored context applied to every plan in every session."""
    return user_context.load()


@app.put("/api/context", response_model=UserContext)
def put_context(ctx: UserContext) -> UserContext:
    return user_context.save(ctx)


@app.delete("/api/context", response_model=UserContext)
def delete_context() -> UserContext:
    return user_context.clear()


# ---------------------------------------------------------------------------
# Security mode: the visible verification scan
# ---------------------------------------------------------------------------
@app.post("/api/security/scan", response_model=SecurityScanResult)
def security_scan(req: SecurityScanRequest) -> SecurityScanResult:
    """Run the trust boundary over the skills an idea would load, and report
    every individual check so the user can watch it happen.

    This is the same engine that gates real planning — not a simulation.
    """
    # The wider candidate pool, so anything the trust boundary rejects is
    # visible rather than crowded out by higher-scoring clean results.
    candidates = skill_db.candidates(req.idea, req.experience_level, limit=16)
    steps = [scan_skill(s) for s in candidates]

    loaded = sum(1 for s in steps if s.verdict == "loaded")
    withheld = sum(1 for s in steps if s.verdict == "withheld")
    blocked = sum(1 for s in steps if s.verdict == "blocked")

    bits = [f"{loaded} skill(s) cleared to influence the plan"]
    if withheld:
        bits.append(f"{withheld} held as inert data")
    if blocked:
        bits.append(f"{blocked} blocked outright")

    return SecurityScanResult(
        idea=req.idea,
        scanned=len(steps),
        loaded=loaded,
        withheld=withheld,
        blocked=blocked,
        steps=steps,
        summary="Scanned " + str(len(steps)) + " skills: " + ", ".join(bits) + ".",
    )


# ---------------------------------------------------------------------------
# Serve the built React frontend (production / single-service deploy)
# ---------------------------------------------------------------------------
# In a deployed Render web service we run ONE process on ONE port: FastAPI
# serves both the /api routes above and the compiled React app. The frontend
# calls the API with same-origin relative paths (/api/...), so no CORS or base
# URL config is needed. Mounted last so every /api route is matched first.
#
# Locally (dev) the Vite dev server proxies /api to this backend instead, and
# frontend/dist may not exist — so this block is a no-op when the build is
# absent, keeping the dev workflow unchanged.
_FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if _FRONTEND_DIST.is_dir():
    _ASSETS = _FRONTEND_DIST / "assets"
    if _ASSETS.is_dir():
        app.mount("/assets", StaticFiles(directory=_ASSETS), name="assets")

    @app.get("/")
    def _serve_index() -> FileResponse:
        return FileResponse(_FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    def _spa_fallback(full_path: str) -> FileResponse:
        """SPA fallback: serve a real static file if it exists, else index.html.

        API routes are registered above and take precedence; anything else is
        handed to the single-page app so client-side routing works on reload.
        """
        candidate = (_FRONTEND_DIST / full_path).resolve()
        # Keep the resolved path inside dist (defend against path traversal).
        if (
            candidate.is_file()
            and _FRONTEND_DIST in candidate.parents
        ):
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")
