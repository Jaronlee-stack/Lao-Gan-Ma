"""SkillDB access layer with live discovery + offline fallback.

Primary source is the real SkillDB service (https://skilldb.dev) via
`skilldb_client`. Because SkillDB is an *external* source, every skill it
returns is run through the verification engine before its guidance can
influence a plan (the trust boundary).

A seeded local JSON store is always merged in as a fallback so the app works
offline and so the trust demo (a deliberately malicious skill) is always
present. Set LGM_SKILLDB_LIVE=0 to disable the live API entirely.
"""
from __future__ import annotations

import os
import json
import re
from pathlib import Path
from typing import List, Dict

from .models import Skill
from .verification import apply_verification
from . import skilldb_client

_DATA_FILE = Path(__file__).parent / "data" / "skills.json"
_LIVE_ENABLED = os.getenv("LGM_SKILLDB_LIVE", "1") != "0"

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
        # Cache of skills fetched live from skilldb.dev this session.
        self._live_cache: Dict[str, Skill] = {}
        self.live_status: str = "idle"  # idle | ok | offline | disabled

    def all(self) -> List[Skill]:
        # Local seed first, then any live skills discovered this session.
        return list(self._skills) + list(self._live_cache.values())

    def get(self, skill_id: str) -> Skill | None:
        hit = next((s for s in self._skills if s.id == skill_id), None)
        return hit or self._live_cache.get(skill_id)

    def _fetch_live(self, idea: str, limit: int) -> List[Skill]:
        """Query the real SkillDB API, verify results, cache them.

        Returns [] on any failure (offline, timeout, bad response) so the
        caller transparently falls back to local skills.
        """
        if not _LIVE_ENABLED:
            self.live_status = "disabled"
            return []
        try:
            raw = skilldb_client.search(idea, limit=limit)
        except Exception:
            self.live_status = "offline"
            return []
        verified: List[Skill] = []
        for s in raw:
            vs = apply_verification(s)  # external source -> must pass screening
            self._live_cache[vs.id] = vs
            verified.append(vs)
        self.live_status = "ok"
        return verified

    def health_check(self) -> str:
        """Probe SkillDB and update live_status. Cheap enough to call on the
        status endpoint so the UI reflects reachability before any plan runs.
        """
        if not _LIVE_ENABLED:
            self.live_status = "disabled"
        elif skilldb_client.ping():
            self.live_status = "ok"
        else:
            self.live_status = "offline"
        return self.live_status

    def browse(self, offset: int = 0, limit: int = 50, search: str = "", domain: str = "") -> Dict:
        """Browse the SkillDB catalogue with pagination + verification.

        Live: pages through skilldb.dev. Offline/disabled: returns the local
        seed store (filtered by the search term client-side).
        """
        if _LIVE_ENABLED:
            try:
                page = skilldb_client.browse(offset=offset, limit=limit, search=search, domain=domain)
                self.live_status = "ok"
                verified = []
                for s in page["skills"]:
                    vs = apply_verification(s)
                    self._live_cache[vs.id] = vs
                    verified.append(vs)
                page["skills"] = verified
                page["source"] = "skilldb.dev"
                return page
            except Exception:
                self.live_status = "offline"
        else:
            self.live_status = "disabled"

        # Local fallback.
        local = self._skills
        if search:
            q = search.lower()
            local = [
                s for s in local
                if q in (s.name + " " + s.summary + " " + " ".join(s.technologies)).lower()
            ]
        window = local[offset: offset + limit]
        return {
            "skills": window,
            "total": len(local),
            "offset": offset,
            "limit": limit,
            "has_more": offset + limit < len(local),
            "source": "local",
        }

    def domains(self) -> List[str]:
        if _LIVE_ENABLED:
            d = skilldb_client.domains()
            if d:
                return d
        # Local categories as fallback.
        return sorted({s.category for s in self._skills})

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
        """Return the most relevant skills for an idea, best first.

        Combines live SkillDB (skilldb.dev) results with the local seed store.
        Live results are fetched + verified first; if the API is unreachable we
        silently fall back to local-only discovery.
        """
        live = self._fetch_live(idea, limit=limit)

        # Pool = local seed + live, de-duplicated by id.
        pool: Dict[str, Skill] = {s.id: s for s in self._skills}
        for s in live:
            pool[s.id] = s

        scored = [(self._score(s, idea, experience), s) for s in pool.values()]
        # Give a small boost to live skilldb.dev results so the real catalogue
        # surfaces, but keep locally-seeded lifecycle skills in the mix.
        scored = [
            (sc + (0.75 if s.source == "skilldb.dev" else 0.0), s) for sc, s in scored
        ]
        scored = [(sc, s) for sc, s in scored if sc > 0]
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [s for _, s in scored[: max(limit, 12)]]


# Module-level singleton for the app to share.
skill_db = SkillDB()
