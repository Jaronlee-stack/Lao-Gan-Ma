"""Lao Gan Ma — FastAPI application entry point."""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    PlanRequest,
    AdaptRequest,
    ApprovalRequest,
    Plan,
    Skill,
)
from .agent import agent
from .skilldb import skill_db
from .verification import verify_skill

app = FastAPI(
    title="Lao Gan Ma — AI Project Agent",
    description="An autonomous AI agent that plans software projects, adapts to change, "
    "and seeks human approval before consequential actions. Skills are verified "
    "before they may influence planning.",
    version="1.0.0",
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


@app.get("/api/skills", response_model=list[Skill])
def list_skills() -> list[Skill]:
    """All skills in SkillDB with their verification status."""
    return skill_db.all()


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


@app.post("/api/plan", response_model=Plan)
def create_plan(req: PlanRequest) -> Plan:
    return agent.plan(req)


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
