# ai-dev-agent

LangGraph orchestrator + Cursor Agent CLI (or Codex fallback) for Jira tickets.

## Quick start

```bash
cp .env.example .env
# Set OPENAI_API_KEY, CLIENT_REPO_PATH, SERVER_REPO_PATH

npm install
npm run agentd    # terminal 1 — long-lived daemon
```

## Usage

Repo paths come from `.env`. The CLI talks to `agentd` over a Unix socket.

```bash
# Start ticket (pauses at plan review)
npm run agent -- AE-1234

# Resume
npm run agent -- AE-1234 resume -m "approve"
npm run agent -- AE-1234 resume -m "focus on portal module"
npm run agent -- AE-1234 resume -m "ship"

# Status / list / reset
npm run agent -- AE-1234 status
npm run agent -- AE-1234 reset   # clear checkpoint + plan, start fresh
npm run agent -- list

# Multi-agent
npm run agent -- AE-1234 --agent-id ilan
npm run agent -- AE-1234 --agent-id bob

# In-process without daemon
npm run agent -- AE-1234 --local
```

### Flow

1. **Plan** — Cursor Agent `--plan` mode on main clone (read-only)
2. **Plan review** — checkpoint interrupt; `resume -m implement` or feedback
3. **Agent worktree + branch** — `.agent-runs/<agent>:<AE-KEY>/worktrees/`
4. **Implement** + validate (Cursor Agent with `--force`)
5. **Ship review** — `resume -m ship`

### Daemon protocol

NDJSON over Unix socket (default `.agent-runs/agent.sock`). Methods:

| Method | Description |
|--------|-------------|
| `ticket.start` | Start run `{ issueKey, agentId?, dryRun?, ... }` |
| `ticket.resume` | `{ threadId \| issueKey, message }` |
| `ticket.respond` | `{ threadId, action, text? }` — structured approve/reject/ship/comment |
| `ticket.status` | Checkpoint + interrupt state |
| `ticket.reset` | Delete checkpoint, meta, and artifacts for thread |
| `ticket.list` | List runs for agent |
| `ticket.listWithStatus` | List runs with live status, phase, and awaiting gate |
| `session.focus` | Switch active `{ agentId, issueKey? }` |
| `session.current` | Current focus |
| `agent.register` | Register agent slot |
| `agent.list` | Agents + runs |

Events: `run.started`, `interrupt`, `run.completed`, `run.error`

### Environment

| Variable | Purpose |
|----------|---------|
| `CLIENT_REPO_PATH` | Main client clone (or `N/A`) |
| `SERVER_REPO_PATH` | Main server clone (or `N/A`) |
| `AGENT_SERVER_SOCKET` | Unix socket path |
| `AGENT_ID` | Default agent id |
| `AGENT_RUNTIME` | `cursor` (default) or `codex` |
| `CURSOR_AGENT_BIN` | Path to `agent` CLI (default: `agent`) |
| `CURSOR_AGENT_MODEL` | Optional model override |
| `CURSOR_API_KEY` | Optional; `agent login` also works |

### Prerequisites

- `ticket-solver`, `agent` (Cursor Agent CLI), `glab` on PATH
- `agent login` (or `CURSOR_API_KEY`)
- `~/.ticket-solver-skill.env`

Set `AGENT_RUNTIME=codex` to use legacy Codex CLI instead.

## Dashboard

Local web UI for ticket inbox, status, and human gates (implement / ship).

```bash
npm run agentd          # terminal 1
npm run dashboard       # terminal 2 — build UI + serve on http://127.0.0.1:9478

# Dev (hot reload UI, API on :9478, UI on :5173)
npm run dashboard:dev
```

| Variable | Purpose |
|----------|---------|
| `DASHBOARD_HOST` | Bind host (default `127.0.0.1`) |
| `DASHBOARD_PORT` | HTTP + WebSocket port (default `9478`) |
| `DASHBOARD_AGENT_ID` | Default agent in picker |

See [docs/cursor-cli-migration-plan.md](docs/cursor-cli-migration-plan.md) and [docs/v1-implementation-plan.md](docs/v1-implementation-plan.md).
