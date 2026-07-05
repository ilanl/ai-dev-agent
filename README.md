# ai-dev-agent

LangGraph orchestrator + Cursor Agent CLI (or Codex fallback) for Jira tickets. Includes a long-lived daemon (`agentd`), CLI, optional Slack bot, and a React web UI for managing runs.

## Architecture

```
┌─────────────┐     unix NDJSON      ┌──────────────┐
│  dev-agent  │ ───────────────────► │   agentd     │
│  (CLI)      │                      │              │
└─────────────┘                      │ RunCoordinator│◄── LangGraph + checkpoints
                                     │              │
┌─────────────┐     HTTP REST        │  http-api    │
│  web app    │ ───────────────────► │  (port 9478) │
│ src/apps/web│                      └──────────────┘
└─────────────┘

Shared types & routes: src/contract/
```

- **`agentd`** — Unix socket (default `.agent-runs/agent.sock`) for CLI/Slack, plus the HTTP API on `AGENT_HTTP_PORT` for the web UI.
- **`RunCoordinator`** — Starts, resumes, and resets ticket runs; persists checkpoint state in SQLite.
- **`src/contract/`** — Single source of truth for HTTP DTOs (Zod), API routes, CLI commands, resume messages, review gates, daemon methods, and web action buttons.
- **`src/apps/web/`** — Vite + React ticket table and detail panel (pnpm workspace package).

## Quick start

```bash
cp .env.example .env
# Set OPENAI_API_KEY, CLIENT_REPO_PATH, SERVER_REPO_PATH, AGENT_ID

cp src/apps/web/.env.example src/apps/web/.env
# Set API_BASE_URL and WEB_APP_PORT (both required)

pnpm install

pnpm run agentd   # terminal 1 — daemon + HTTP API
pnpm run web      # terminal 2 — web UI
```

## CLI

Repo paths come from root `.env`. The CLI talks to `agentd` over the Unix socket unless `--local` is used.

```bash
# Start ticket (pauses at plan review)
pnpm run agent -- AE-1234

# Resume (gate-specific messages)
pnpm run agent -- AE-1234 resume -m "implement"   # approve plan → start coding
pnpm run agent -- AE-1234 resume -m "ship"      # approve ship review
pnpm run agent -- AE-1234 resume -m "reject"      # stop the run
pnpm run agent -- AE-1234 resume -m "focus on portal module"  # feedback (revises plan)

# Status / list / reset
pnpm run agent -- AE-1234 status
pnpm run agent -- AE-1234 reset
pnpm run agent -- list

# Multi-agent
pnpm run agent -- AE-1234 --agent-id ilan

# In-process without daemon
pnpm run agent -- AE-1234 --local
```

### Run flow

1. **Plan** — Cursor Agent `--plan` mode on main clone (read-only)
2. **Plan review** — checkpoint interrupt; `resume -m implement` or free-text feedback
3. **Worktree + branch** — `.agent-runs/<agent>:<AE-KEY>/worktrees/`
4. **Implement** + validate (Cursor Agent with `--force`)
5. **Ship review** — `resume -m ship` or feedback

Review gates: `plan`, `ship`, `question`. Resume message constants live in `src/contract/agent/resume.ts`.

## Daemon protocol

NDJSON over Unix socket. Method names are defined in `src/contract/daemon/methods.ts`.

| Method | Description |
|--------|-------------|
| `ticket.start` | Start run `{ issueKey, agentId?, ... }` |
| `ticket.resume` | `{ threadId \| issueKey, message }` |
| `ticket.respond` | `{ threadId, action, text? }` — structured approve/reject/ship/comment |
| `ticket.status` | Checkpoint + interrupt state |
| `ticket.reset` | Delete checkpoint, meta, and artifacts for thread |
| `ticket.list` | List runs for agent |
| `session.focus` | Switch active `{ agentId, issueKey? }` |
| `session.current` | Current focus |
| `agent.register` | Register agent slot |
| `agent.list` | Agents + runs |

Events: `run.started`, `interrupt`, `run.completed`, `run.error`

Optional TCP listener via `AGENT_SERVER_PORT` (must differ from `AGENT_HTTP_PORT`).

## HTTP API

Started by `agentd` on `AGENT_HTTP_PORT` (default `9478`). Standalone: `pnpm run httpd`.

Routes (`src/contract/http/routes.ts`):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tickets` | List runs for default agent |
| `GET` | `/api/tickets/:issueKey` | Ticket detail (Jira + run state) |
| `POST` | `/api/tickets` | Start run `{ issueKey }` |
| `POST` | `/api/tickets/:issueKey` | Start run for issue key |
| `POST` | `/api/tickets/:issueKey/resume` | Resume `{ message }` |
| `POST` | `/api/tickets/:issueKey/respond` | Structured `{ action, text? }` |
| `POST` | `/api/tickets/:issueKey/reset` | Reset thread |

Request/response shapes are validated with Zod schemas in `src/contract/http/tickets.schemas.ts`.

## Web app

`src/apps/web` — React 19, Tailwind v4, shadcn/ui, TanStack Query, Axios.

**Run:**

```bash
pnpm run agentd    # HTTP API must be up
pnpm run web       # Vite dev server
```

**`src/apps/web/.env` (required):**

| Variable | Purpose |
|----------|---------|
| `API_BASE_URL` | HTTP API base URL (e.g. `http://127.0.0.1:9478`) |
| `WEB_APP_PORT` | Vite dev server port (e.g. `8083`) |

**UI behavior:**

- Tickets table (left) + resizable detail panel (right)
- Selected ticket synced to URL (`?ticket=AE-1234`); panel width persisted in `localStorage`
- Detail actions mirror CLI gates (no free-text chat): **Implement** / **Reject** (plan), **Ship** / **Reject** (ship), **Approve** / **Reject** (question), **Start**, **Reset**
- Network errors surface as toast notifications (Sonner)
- Jira descriptions/comments rendered as formatted bullet lists

**Scripts:**

```bash
pnpm run web          # dev server
pnpm run web:build    # production build
pnpm run typecheck:web
```

## Agent skills

Bundled under `.cursor/skills/` (override with `AGENT_SKILLS_PATH`):

| Skill | Purpose |
|-------|---------|
| `strict-explicit-mode` | Work only from user-provided files |
| `ticket-solver-investigate` | Phase 1 — Jira fetch only |
| `ticket-solver-paths` | Phase 2 — repo paths & investigation |
| `ticket-solver-ship` | Phase 3 — branch, MR, Jira code review |

Loaded by `src/integrations/agent-skills.ts`. Set `AGENT_FULL_SKILLS=1` to inline full skill bodies.

## Slack

```bash
pnpm run slack
```

Socket Mode bot — configure `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`, and `SLACK_ALLOWED_CHANNEL_IDS` in root `.env`.

## Environment (root `.env`)

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | LangGraph plan LLM |
| `CLIENT_REPO_PATH` / `SERVER_REPO_PATH` | Main clones (or `N/A`) |
| `AGENT_SERVER_SOCKET` | Unix socket path |
| `AGENT_HTTP_PORT` | HTTP API port (default `9478`) |
| `AGENT_SERVER_PORT` | Optional NDJSON TCP (≠ `AGENT_HTTP_PORT`) |
| `AGENT_HTTP_CORS` | Override CORS origin (default: reflect localhost) |
| `AGENT_ID` | Default agent id |
| `AGENT_RUNTIME` | `cursor` (default) or `codex` |
| `CURSOR_AGENT_BIN` / `CURSOR_AGENT_MODEL` | Cursor Agent CLI |
| `AGENT_SKILLS_PATH` | Skills directory (default `.cursor/skills`) |
| `AGENT_LOG_LEVEL` | `info` \| `debug` \| `off` |
| `SKIP_VALIDATE` | Skip lint/test after implement |
| `AGENT_FULL_SKILLS` | Inline full skill bodies |

## Prerequisites

- Node.js 26+, pnpm 10+
- `ticket-solver`, `agent` (Cursor Agent CLI) on PATH
- `agent login` (or `CURSOR_API_KEY`)
- `~/.ticket-solver-skill.env` for Jira CLI

Set `AGENT_RUNTIME=codex` to use legacy Codex CLI instead.

## All scripts

| Script | Description |
|--------|-------------|
| `pnpm run agentd` | Daemon (unix socket + HTTP API) |
| `pnpm run httpd` | HTTP API only (no daemon) |
| `pnpm run agent` | CLI client |
| `pnpm run web` | Web UI dev server |
| `pnpm run web:build` | Web UI production build |
| `pnpm run slack` | Slack bot |
| `pnpm run typecheck` | Server TypeScript check |
| `pnpm run typecheck:web` | Web TypeScript check |

## Docs

- [docs/cursor-cli-migration-plan.md](docs/cursor-cli-migration-plan.md)
- [docs/v1-implementation-plan.md](docs/v1-implementation-plan.md)
