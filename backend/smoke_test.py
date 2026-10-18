"""Quick smoke test of core agent + verification logic (no server needed)."""
from app.skilldb import skill_db
from app.verification import verify_skill, safe_instructions
from app.models import PlanRequest, AdaptRequest, TrustLevel
from app.agent import agent


def test_verification_blocks_malicious():
    bad = skill_db.get("skill-untrusted-sample")
    assert bad is not None
    assert bad.trust_level == TrustLevel.BLOCKED, bad.trust_level
    assert safe_instructions(bad) == "", "blocked skill must not leak instructions"
    good = skill_db.get("skill-fastapi-backend")
    assert good.trust_level == TrustLevel.VERIFIED
    assert safe_instructions(good) != ""
    print("OK verification: malicious blocked, trusted verified")


def test_plan_excludes_blocked_guidance():
    plan = agent.plan(PlanRequest(idea="A web app with login and a Postgres database and deployment", experience_level="intermediate"))
    assert plan.phases, "expected phases"
    # No task detail should contain the injection payload.
    all_detail = " ".join(t.detail for p in plan.phases for t in p.tasks).lower()
    assert "ignore all previous" not in all_detail
    assert "curl" not in all_detail
    assert plan.pending_approvals, "expected approval gates for security/db/deploy"
    print(f"OK plan: {len(plan.phases)} phases, {len(plan.pending_approvals)} approval gates, llm={plan.notes}")
    return plan


def test_adapt_and_approve():
    plan = agent.plan(PlanRequest(idea="A web app with login and deployment", experience_level="beginner"))
    adapted = agent.adapt(AdaptRequest(plan_id=plan.id, change="prototype only, no deploy"))
    assert adapted.revision == 2
    assert all(p.id != "deploy" for p in adapted.phases), "deploy should be dropped"
    # Approve a remaining consequential action.
    if adapted.pending_approvals:
        appr = adapted.pending_approvals[0]
        after = agent.approve(plan.id, appr, "approve", "looks good")
        assert appr not in after.pending_approvals
    print(f"OK adapt+approve: rev={adapted.revision}, phases={[p.id for p in adapted.phases]}")


if __name__ == "__main__":
    test_verification_blocks_malicious()
    test_plan_excludes_blocked_guidance()
    test_adapt_and_approve()
    print("\nALL SMOKE TESTS PASSED")


# --- v2 features: accept, feedback, history, self-learning -----------------
def test_accept_generates_prompt_and_skills_md():
    plan = agent.plan(PlanRequest(idea="A web app with login, Postgres database and deployment", experience_level="intermediate"))
    result = agent.accept(plan.id)
    assert result is not None
    one_shot, skills_md = result
    assert "Project idea" in one_shot and "Build plan" in one_shot
    # one-shot must never contain blocked/injection content
    assert "ignore all previous" not in one_shot.lower()
    assert "curl" not in one_shot.lower()
    assert "# Skills for:" in skills_md
    assert "✅" in skills_md  # at least one verified skill rendered
    print(f"OK accept: one-shot={len(one_shot)} chars, skills.md={len(skills_md)} chars")


def test_db_history_and_feedback():
    from app import db
    sid = "test-sess"
    db.create_session(sid, "test idea")
    db.add_message(sid, "user", "hello")
    db.add_message(sid, "agent", "hi")
    msgs = db.get_messages(sid)
    assert len(msgs) >= 2
    db.add_feedback(sid, "plan-x", 5, "great")
    stats = db.feedback_stats()
    assert stats["count"] >= 1
    print(f"OK db: {len(msgs)} messages, feedback stats={stats}")


def test_self_learning():
    from app import preferences, db
    plan = agent.plan(PlanRequest(idea="A React app with a FastAPI backend", experience_level="advanced"))
    preferences.learn_from_accept(plan)
    techs = preferences.preferred_techs()
    assert techs, "expected learned techs"
    summary = preferences.preference_summary()
    assert summary["note"], "expected a human-readable learning note"
    print(f"OK self-learning: techs={techs[:4]}, note='{summary['note']}'")


if __name__ == "__main__":
    test_accept_generates_prompt_and_skills_md()
    test_db_history_and_feedback()
    test_self_learning()
    print("V2 SMOKE TESTS PASSED")
