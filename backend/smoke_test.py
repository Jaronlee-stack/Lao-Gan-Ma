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
