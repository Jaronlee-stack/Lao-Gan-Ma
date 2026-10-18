"""Client for the real SkillDB service (https://skilldb.dev).

SkillDB is a public AI-agent skills library exposing a key-less REST API:
  * search:  GET /api/v1/skills?search=<topic>&limit=<n>
  * detail:  GET /api/v1/skills/<pack>%2F<skill>.md

On the free tier, search returns rich metadata and the detail endpoint returns
a `content_preview` (full content is gated behind a paid plan, flagged via
`upgrade_note`). We map SkillDB results into our own Skill model and then run
them through our verification engine — SkillDB is an *external* source, so its
guidance is untrusted until it passes verification (the trust boundary).

Attribution: skill data is retrieved from SkillDB (https://skilldb.dev).
"""
from __future__ import annotations

import re
import json
import urllib.parse
import urllib.request
from typing import List, Dict, Any, Optional

from .models import Skill

_BASE = "https://skilldb.dev/api/v1"
_TIMEOUT = 8  # seconds

# Rough map from SkillDB category / pack text to our internal categories.
_CATEGORY_MAP = [
    ("security", "security"),
    ("auth", "security"),
    ("database", "database"),
    ("sql", "database"),
    ("frontend", "frontend"),
    ("react", "frontend"),
    ("ui", "design"),
    ("ux", "design"),
    ("design", "design"),
    ("api", "backend"),
    ("backend", "backend"),
    ("server", "backend"),
    ("test", "testing"),
    ("deploy", "infrastructure"),
    ("devops", "infrastructure"),
    ("infra", "infrastructure"),
    ("ci", "infrastructure"),
    ("machine learning", "machine-learning"),
    ("ml", "machine-learning"),
    ("ai", "machine-learning"),
    ("data", "database"),
    ("requirement", "planning"),
    ("plan", "planning"),
]

# Common technology keywords we try to lift out of a skill's text.
_TECH_KEYWORDS = [
    "React", "Vue", "Angular", "Svelte", "TypeScript", "JavaScript", "Python",
    "FastAPI", "Django", "Flask", "Node", "Express", "PostgreSQL", "MySQL",
    "MongoDB", "Redis", "SQLAlchemy", "Docker", "Kubernetes", "AWS", "GCP",
    "Azure", "GraphQL", "REST", "JWT", "OAuth", "Tailwind", "Next.js", "Vite",
    "Playwright", "Pytest", "Jest", "Vitest", "GitHub Actions", "Terraform",
    "Kafka", "RabbitMQ", "gRPC", "WebSocket", "Flutter", "Swift", "Kotlin",
    "PyTorch", "TensorFlow", "scikit-learn", "pandas",
]


def _get(path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = f"{_BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "lao-gan-ma/1.0"})
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _map_category(text: str) -> str:
    low = text.lower()
    for needle, cat in _CATEGORY_MAP:
        if needle in low:
            return cat
    return "planning"


def _extract_tech(text: str) -> List[str]:
    found = []
    for kw in _TECH_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", text, re.IGNORECASE):
            found.append(kw)
    return sorted(set(found))


def _slug(skill_id: str) -> str:
    return "skilldb-" + re.sub(r"[^a-z0-9]+", "-", skill_id.lower()).strip("-")


def _to_skill(item: Dict[str, Any], instructions: str = "") -> Skill:
    name = item.get("name") or item.get("title") or item.get("id", "Unknown skill")
    desc = item.get("description") or ""
    text = f"{name} {desc} {item.get('pack','')} {item.get('category','')}"
    return Skill(
        id=_slug(item["id"]),
        name=name,
        category=_map_category(text),
        summary=desc[:240] or f"Skill from SkillDB pack '{item.get('packLabel', item.get('pack',''))}'.",
        technologies=_extract_tech(text + " " + instructions),
        instructions=instructions or desc,
        source="skilldb.dev",
        # SkillDB is a known, trusted source; we still screen content for
        # injection/dangerous ops in the verification engine before trusting it.
        signature="SKILLDB-" + item.get("pack", "pack"),
        experience_levels=["beginner", "intermediate", "advanced"],
    )


# SkillDB search works best with short keyword queries rather than full
# sentences. We derive a handful of topic queries from the idea and merge.
_STOPWORDS = {
    "a", "an", "the", "and", "or", "with", "for", "to", "of", "in", "on", "my",
    "that", "this", "is", "are", "be", "app", "application", "project", "build",
    "create", "make", "want", "need", "using", "use", "it", "i", "we", "them",
    "user", "users", "simple", "small", "web", "site", "website", "system",
}


def _topic_queries(idea: str, max_queries: int = 4) -> List[str]:
    """Turn a free-text idea into a few short SkillDB search queries."""
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9+.#-]*", idea.lower())
    # Keep meaningful words, preserving order, de-duplicated.
    seen = set()
    keywords = []
    for w in words:
        if w in _STOPWORDS or len(w) < 3 or w in seen:
            continue
        seen.add(w)
        keywords.append(w)

    queries: List[str] = []
    # Pair adjacent keywords ("user login" -> "login") then single keywords.
    for kw in keywords[:max_queries]:
        queries.append(kw)
    # Always include broadly useful engineering topics so results are rich.
    for base in ("security", "testing"):
        if base not in queries:
            queries.append(base)
    return queries[: max_queries + 2]


def _search_one(query: str, limit: int) -> List[Dict[str, Any]]:
    try:
        data = _get("/skills", {"search": query, "limit": limit})
    except Exception:
        return []
    return data.get("skills", [])


def search(query: str, limit: int = 8) -> List[Skill]:
    """Search SkillDB for an idea and return mapped Skill objects (unverified).

    Runs several short topic queries derived from the idea and merges the
    unique results, since the SkillDB search favours keywords over sentences.
    """
    per_query = max(2, limit // 2)
    merged: Dict[str, Dict[str, Any]] = {}

    # First try the raw query (works when the user already typed keywords).
    for item in _search_one(query, per_query):
        merged[item["id"]] = item
    # Then topic-based queries derived from the idea.
    for q in _topic_queries(query):
        for item in _search_one(q, per_query):
            merged.setdefault(item["id"], item)
        if len(merged) >= limit * 2:
            break

    skills = []
    for item in list(merged.values())[: limit * 2]:
        instructions = item.get("content_preview") or item.get("description") or ""
        skills.append(_to_skill(item, instructions=instructions))
    return skills


def fetch_detail(skill_id_path: str) -> Dict[str, Any]:
    """Fetch a single skill's detail (incl. content_preview + upgrade_note)."""
    enc = urllib.parse.quote(skill_id_path, safe="")
    return _get(f"/skills/{enc}")


def ping() -> bool:
    """Lightweight reachability check against the SkillDB API."""
    try:
        _get("/skills", {"search": "react", "limit": 1})
        return True
    except Exception:
        return False
