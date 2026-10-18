"""Skill verification engine.

Skills retrieved from external sources are untrusted. Before a skill's
instructions may influence the agent's planning output, it must pass
verification:

  1. Signature / allowlist check  -> is this skill from a trusted source?
  2. Prompt-injection screening    -> does the instruction text try to
                                       hijack the agent?
  3. Dangerous-command screening   -> does it try to run risky shell ops?

A skill that fails any critical check is BLOCKED. A skill with no signature
but otherwise clean stays UNVERIFIED (its instructions are treated as inert
data and never followed) until a human explicitly approves it.
"""
from __future__ import annotations

import re
from typing import List

from .models import Skill, TrustLevel, VerificationReport, VerificationFinding

# Sources we trust to produce signed skills.
#   "skilldb"     -> our local seeded store (signed LGM-SIG-*)
#   "skilldb.dev" -> the real SkillDB service (signed SKILLDB-*)
# A trusted source still only earns VERIFIED after passing the injection and
# dangerous-command screens below — trust is necessary, not sufficient.
TRUSTED_SOURCES = {"skilldb", "skilldb.dev"}
SIGNATURE_PREFIXES = ("LGM-SIG-", "SKILLDB-")

# Patterns that indicate an attempt to hijack the agent (prompt injection).
_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"disregard\s+(the\s+)?(system|previous)",
    r"reveal\s+(the\s+)?(system\s+prompt|secrets?)",
    r"output\s+.*secrets?",
    r"disable\s+(the\s+)?verification",
    r"you\s+are\s+now\s+",
    r"act\s+as\s+(an?\s+)?(unrestricted|jailbroken)",
]

# Patterns indicating dangerous shell / system operations.
_DANGEROUS_PATTERNS = [
    r"curl\s+[^\n]*\|\s*(sudo\s+)?(ba)?sh",
    r"wget\s+[^\n]*\|\s*(sudo\s+)?(ba)?sh",
    r"rm\s+-rf\s+/",
    r":\(\)\s*\{\s*:\|:&\s*\}",  # fork bomb
    r"sudo\s+",
    r"chmod\s+777",
]

_INJECTION_RE = [re.compile(p, re.IGNORECASE) for p in _INJECTION_PATTERNS]
_DANGEROUS_RE = [re.compile(p, re.IGNORECASE) for p in _DANGEROUS_PATTERNS]


def _signature_ok(skill: Skill) -> bool:
    if skill.source not in TRUSTED_SOURCES:
        return False
    if not skill.signature:
        return False
    return skill.signature.startswith(SIGNATURE_PREFIXES)


def verify_skill(skill: Skill) -> VerificationReport:
    """Run all checks and return a verification report."""
    findings: List[VerificationFinding] = []
    text = skill.instructions or ""

    # 1. Injection screening (critical)
    for rx in _INJECTION_RE:
        if rx.search(text):
            findings.append(
                VerificationFinding(
                    code="PROMPT_INJECTION",
                    severity="critical",
                    message=f"Instruction text matches injection pattern: '{rx.pattern}'",
                )
            )

    # 2. Dangerous command screening (critical)
    for rx in _DANGEROUS_RE:
        if rx.search(text):
            findings.append(
                VerificationFinding(
                    code="DANGEROUS_COMMAND",
                    severity="critical",
                    message=f"Instruction text contains a dangerous operation: '{rx.pattern}'",
                )
            )

    # 3. Signature / source check
    sig_ok = _signature_ok(skill)
    if not sig_ok:
        findings.append(
            VerificationFinding(
                code="UNSIGNED_SOURCE",
                severity="warning",
                message=f"Skill source '{skill.source}' is not a trusted signed source.",
            )
        )

    has_critical = any(f.severity == "critical" for f in findings)
    if has_critical:
        trust = TrustLevel.BLOCKED
    elif sig_ok:
        trust = TrustLevel.VERIFIED
    else:
        trust = TrustLevel.UNVERIFIED

    return VerificationReport(
        skill_id=skill.id,
        trust_level=trust,
        signature_ok=sig_ok,
        findings=findings,
    )


def apply_verification(skill: Skill) -> Skill:
    """Return a copy of the skill with verification applied.

    For non-verified skills we neutralise the instruction text so it can be
    shown to the user as data but can never be fed to the planner as guidance.
    """
    report = verify_skill(skill)
    verified = skill.model_copy(deep=True)
    verified.trust_level = report.trust_level
    verified.verification = report
    return verified


def safe_instructions(skill: Skill) -> str:
    """Return instruction text only if the skill is verified; else empty.

    This is the enforcement boundary: the planner may ONLY ever read the
    output of this function, guaranteeing unverified/blocked instructions
    cannot influence generated plans.
    """
    if skill.trust_level == TrustLevel.VERIFIED:
        return skill.instructions
    return ""
