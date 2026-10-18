"""Self-learning preference engine.

The agent learns what the user tends to favour by observing the signals it
already collects:

  * When a plan is ACCEPTED -> reinforce the technologies and experience
    level in that plan (strong signal).
  * When FEEDBACK is positive (>= 4 stars) -> extra reinforcement; negative
    feedback (<= 2) gently discounts.

Learned preferences are then folded back into future planning: discovered
skills whose technologies match learned favourites are boosted, and the
experience level defaults to the user's most common choice.

This is deliberately transparent and rule-based (no opaque model), which suits
a "trustworthy agent" — the user can inspect exactly what was learned via the
/api/preferences endpoint.
"""
from __future__ import annotations

from typing import List, Dict

from . import db
from .models import Plan


def learn_from_accept(plan: Plan) -> None:
    """Reinforce preferences from an accepted plan."""
    db.reinforce_preference("experience", plan.experience_level, amount=1.0)
    for skill in plan.skills_used:
        # Only learn from skills that were actually trustworthy.
        if skill.trust_level.value != "verified":
            continue
        for tech in skill.technologies:
            db.reinforce_preference("tech", tech, amount=1.0)
        db.reinforce_preference("category", skill.category, amount=0.5)


def learn_from_feedback(plan: Plan | None, rating: int) -> None:
    """Adjust reinforcement based on explicit feedback."""
    if plan is None:
        return
    if rating >= 4:
        amount = 0.5
    elif rating <= 2:
        amount = -0.5  # discount what led to a poor experience
    else:
        return
    for skill in plan.skills_used:
        if skill.trust_level.value != "verified":
            continue
        for tech in skill.technologies:
            db.reinforce_preference("tech", tech, amount=amount)


def preferred_techs(limit: int = 6) -> List[str]:
    return db.top_preferences("tech", limit=limit)


def preferred_experience() -> str | None:
    vals = db.top_preferences("experience", limit=1, min_weight=0.5)
    return vals[0] if vals else None


def preference_summary() -> Dict[str, object]:
    """Human-readable snapshot of what the agent has learned."""
    techs = preferred_techs()
    exp = preferred_experience()
    parts = []
    if techs:
        parts.append("tend to prefer " + ", ".join(techs[:4]))
    if exp:
        parts.append(f"usually work at a{'n' if exp[:1] in 'aeiou' else ''} {exp} level")
    note = ("I've noticed you " + ", and ".join(parts) + ".") if parts else ""
    return {
        "preferred_techs": techs,
        "preferred_experience": exp,
        "note": note,
        "raw": db.get_preferences(),
    }
