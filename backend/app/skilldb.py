"""SkillDB: a seeded store of development skills with keyword discovery.

In a production system this would be a vector/keyword search over a real
database. For the hackathon it is a seeded JSON store with a lightweight
relevance scorer, which keeps the demo deterministic and offline-friendly.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import List, Dict

from .models import Skill
from .verification import apply_verification

_DATA_FILE = Path(__file__).parent / "data" / "skills.json"

# Keywords that map an idea to skill categories, used for discovery.
_CATEGORY_HINTS: Dict[str, List[str]] = {
    "frontend": ["ui", "web", "app", "frontend", "react", "page", "dashboard", "spa"],
    "backend": ["api", "backend", "server", "service", "endpoint"],
    "security": ["auth", "login", "secure", "security", "token", "password", "account"],
    "database": ["data", "database", "store", "sql", "persist", "record"],
    "design": ["design", "ux", "ui", "wireframe", "prototype"],
    "testing": ["test", "quality", "qa", "reliable"],
    "planning": ["plan", "requirement", "scope", "idea", "feature"],
    "infrastructure": ["deploy", "ci", "cd", "host", "docker", "cloud", "pipeline"],
    "machine-learning": ["ml", "ai", "recommend", "predict", "model", "learning"],
}


class SkillDB:
    def __init__(self, data_file: Path = _DATA_FILE):
        self._data_file = data_file
        self._skills: List[Skill] = []
        self.load()

    def load(self) -> None:
        raw = json.loads(self._data_file.read_text())
        # Every skill is verified at load time so trust metadata is always present.
        self._skills = [apply_verification(Skill(**item)) for item in raw]

    def all(self) -> List[Skill]:
        return list(self._skills)

    def get(self, skill_id: str) -> Skill | None:
        return next((s for s in self._skills if s.id == skill_id), None)

    def _score(self, skill: Skill, idea: str, experience: str) -> float:
        idea_lc = idea.lower()
        tokens = set(re.findall(r"[a-z0-9]+", idea_lc))
        score = 0.0

        # Category relevance from idea keywords.
        for cat, hints in _CATEGORY_HINTS.items():
            if skill.category == cat and tokens.intersection(hints):
                score += 3.0

        # Direct technology / name mentions.
        for tech in skill.technologies:
            if tech.lower() in idea_lc:
                score += 2.0
        if any(tok in skill.name.lower() for tok in tokens):
            score += 1.0

        # Planning/requirements & design are generally useful baselines.
        if skill.category in ("planning", "design"):
            score += 0.5

        # Experience fit.
        if experience in skill.experience_levels:
            score += 0.5

        return score

    def discover(self, idea: str, experience: str = "intermediate", limit: int = 8) -> List[Skill]:
        """Return the most relevant skills for an idea, best first."""
        scored = [(self._score(s, idea, experience), s) for s in self._skills]
        scored = [(sc, s) for sc, s in scored if sc > 0]
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [s for _, s in scored[:limit]]


# Module-level singleton for the app to share.
skill_db = SkillDB()
