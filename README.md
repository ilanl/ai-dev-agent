# ai-dev-agent

LangGraph orchestrator + Cursor Agent CLI (or Codex fallback) for Jira tickets.

## Quick start

```bash
cp .env.example .env
# Set OPENAI_API_KEY, CLIENT_REPO_PATH, SERVER_REPO_PATH

pnpm install
pppnpm run agentd    # terminal 1 — long-lived daemon
```

## Usage

Repo paths come from `.env`. The CLI talks to `agentd` over a Unix socket.

```bash
# Start ticket (pauses at plan review)
pnpm run agent -- AE-1234

# Resume
pnpm run agent -- AE-1234 resume -m "approve"
pnpm run agent -- AE-1234 resume -m "focus on portal module"
pnpm run agent -- AE-1234 resume -m "ship"

# Status / list / reset
pnpm run agent -- AE-1234 status
pnpm run agent -- AE-1234 reset   # clear checkpoint + plan, start fresh
pnpm run agent -- list

# Multi-agent
pnpm run agent -- AE-1234 --agent-id ilan
pnpm run agent -- AE-1234 --agent-id bob

# In-process without daemon
pnpm run agent -- AE-1234 --local
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

- `pnpm` 10+ (`corepack enable` or `npm i -g pnpm`)
- `ticket-solver`, `agent` (Cursor Agent CLI), `glab` on PATH
- `agent login` (or `CURSOR_API_KEY`)
- `~/.ticket-solver-skill.env`

Set `AGENT_RUNTIME=codex` to use legacy Codex CLI instead.

See [docs/cursor-cli-migration-plan.md](docs/cursor-cli-migration-plan.md) and [docs/v1-implementation-plan.md](docs/v1-implementation-plan.md).

## Web app

Ticket management UI lives in `src/apps/web`. It talks to the HTTP API (`src/server/http-api.ts`), which wraps the same Jira ticket resolver and run coordinator as the CLI.

```bash
# terminal 1 — agent daemon (unix socket + HTTP API on AGENT_HTTP_PORT)
pnpm run agentd

# terminal 2 — Vite dev server
pnpm run web
```

Set `API_BASE_URL=http://127.0.0.1:9478` in `src/apps/web/.env` (must match `AGENT_HTTP_PORT`).
`pnpm run httpd` is still available if you only want the HTTP API without the daemon.

Open http://localhost:5173 (or your `WEB_APP_PORT`). The layout matches the Figma reference: tickets table on the left, detail panel on the right when a row is selected (no sidebar for now).

| Variable | Purpose |
|----------|---------|
| `AGENT_HTTP_PORT` | HTTP API port (default `9478`) — web UI `API_BASE_URL` |
| `AGENT_SERVER_PORT` | Optional NDJSON tcp for remote clients (must differ from `AGENT_HTTP_PORT`) |
| `AGENT_HTTP_CORS` | Override CORS origin (default: reflect localhost origins) |
