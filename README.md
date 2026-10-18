# 🌶️ Lao Gan Ma — AI Project Agent

> *ai-gnition sim hackathon · "1 less thing" — an autonomous AI agent that gives people their time back.*

Lao Gan Ma turns a natural-language **project idea** into a structured, phased
**development plan**. It discovers relevant skills, recommends technologies,
**adapts** when things change, and **seeks human approval** before consequential
actions — all while **verifying** skills before any external instruction is
allowed to influence the plan.

## Why it fits the problem statement

| Challenge ask | How Lao Gan Ma answers it |
| --- | --- |
| **Plans & completes a meaningful task** | Converts an idea into a 9-phase software project plan (requirements → design → frontend → backend → database → security → ML → testing → deploy), each phase backed by matched skills and technologies. |
| **Adapts when things change** | `/api/plan/adapt` re-discovers skills and re-plans when a constraint or scope change arrives, flagging exactly which phases moved. |
| **Seeks human approval before consequential actions** | Security, database, and deployment phases are gated. Nothing consequential proceeds without an explicit human `approve`/`reject`. |
| **Trustworthy** | Every skill is run through a **verification engine** (signature/allowlist + prompt-injection + dangerous-command screening). Unverified skills are treated as inert data; malicious skills are **blocked** and can never reach the planner. |

## Architecture

```
Lao-Gan-Ma/
├── backend/                 # FastAPI agent
│   ├── app/
│   │   ├── main.py          # REST API
│   │   ├── models.py        # Pydantic schemas
│   │   ├── agent.py         # plan() / adapt() / approve()
│   │   ├── skilldb.py       # seeded skill store + discovery
│   │   ├── verification.py  # trust/verification engine (the trust boundary)
│   │   ├── llm.py           # pluggable LLM + offline mock fallback
│   │   └── data/skills.json # seeded skills (incl. one malicious sample)
│   ├── smoke_test.py
│   └── requirements.txt
└── frontend/                # React + Vite + TypeScript + Tailwind
    └── src/{App.tsx, api.ts, main.tsx}
```

### The trust boundary
The planner only ever reads skill guidance through
`verification.safe_instructions()`, which returns text **only** for `verified`
skills. This guarantees unverified or blocked instructions (e.g. the seeded
prompt-injection sample `skill-untrusted-sample`) can never influence a
generated plan.

## Run it

```bash
./run.sh
```

Then open http://127.0.0.1:5173. The Vite dev server proxies `/api` to the
backend on port 8000.

### Run manually
```bash
# backend
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000

# frontend (new terminal)
cd frontend && npm install && npm run dev
```

### Optional: real LLM (Groq)
The agent uses **Groq** (via its OpenAI-compatible endpoint) for narration.
Groq offers a free developer tier with open-weight models; the default is the
free `llama-3.1-8b-instant`.

Add your key either way:
- **Env var (recommended):** `export GROQ_API_KEY=gsk_...`
- **Inline:** set the `GROQ_API_KEY` constant in `backend/app/llm.py` (look for
  the `# add credentials` comment).

Optionally override the model with `LGM_LLM_MODEL`. Without a key, a
deterministic offline mock is used so the demo always runs. Get a free key at
https://console.groq.com/keys

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/api/health` | Liveness check |
| `GET`  | `/api/skills` | All skills with verification status |
| `GET`  | `/api/skills/discover?idea=…` | Rank skills for an idea |
| `POST` | `/api/skills/{id}/verify` | Re-run verification on a skill |
| `POST` | `/api/plan` | Create a plan from an idea |
| `GET`  | `/api/plan/{id}` | Fetch a plan |
| `POST` | `/api/plan/adapt` | Re-plan after a change |
| `POST` | `/api/plan/approve` | Approve/reject a gated action |

## Tests
```bash
cd backend && .venv/bin/python smoke_test.py
```
Covers: verification blocks the malicious skill, blocked guidance never leaks
into a plan, adaptation reduces scope, and approval clears a gate.
