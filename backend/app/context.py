"""Global personalisation context.

The user states this explicitly (name, role, stack, constraints, goals) and it
applies to EVERY plan in EVERY session — unlike `preferences.py`, which infers
tendencies from behaviour. Both feed the planner; this one is authoritative
because the user wrote it.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List

from . import db
from .models import UserContext

_LIST_FIELDS = {"preferred_stack", "avoid", "constraints"}
_BOOL_FIELDS = {"security_mode"}


def load() -> UserContext:
    """Read the stored context into a typed model."""
    raw = db.get_user_context()
    data: Dict[str, Any] = {}
    for field, value in raw.items():
        if field in _LIST_FIELDS:
            try:
                parsed = json.loads(value)
                data[field] = parsed if isinstance(parsed, list) else []
            except json.JSONDecodeError:
                # Tolerate a comma-separated string written by hand.
                data[field] = [p.strip() for p in value.split(",") if p.strip()]
        elif field in _BOOL_FIELDS:
            data[field] = value in ("1", "true", "True")
        else:
            data[field] = value
    return UserContext(**data)


def save(ctx: UserContext) -> UserContext:
    """Persist the full context, then return what was stored."""
    payload: Dict[str, Any] = {}
    for field, value in ctx.model_dump().items():
        if field in _LIST_FIELDS:
            payload[field] = json.dumps([v for v in value if str(v).strip()])
        elif field in _BOOL_FIELDS:
            payload[field] = "1" if value else ""
        else:
            payload[field] = value
    db.set_user_context(payload)
    return load()


def clear() -> UserContext:
    db.clear_user_context()
    return load()


def preferred_techs() -> List[str]:
    """Stack the user explicitly prefers (used to bias skill ranking)."""
    return load().preferred_stack


def avoided_techs() -> List[str]:
    return load().avoid


def security_mode() -> bool:
    return load().security_mode
