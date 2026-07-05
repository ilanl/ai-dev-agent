# Cursor Agent CLI migration

Switch from OpenAI **Codex CLI** (`codex exec`) to **Cursor Agent CLI** (`agent -p`).

## Status

| Phase | Status |
|-------|--------|
| Phase 1 — Adapter + `AGENT_RUNTIME` switch | **Done** |
| Phase 2 — Session resume on retries | **Done** (`--resume <session_id>`) |
| Phase 3 — Deprecate Codex path | Optional (`AGENT_RUNTIME=codex`) |
| Phase 4 — Native plan mode prompts | Future (lean on `--plan` vs custom prompts) |
| Phase 5 — Cursor built-in worktrees | Future (evaluate `-w/--worktree` vs orchestrator worktrees) |

## CLI mapping

| Codex | Cursor Agent (`agent`) |
|-------|------------------------|
| `codex exec -C <repo>` | `agent -p --workspace <repo> --trust` |
| `-s read-only` | `--plan` |
| `-s workspace-write` | `--force` (default agent mode with writes) |
| `--add-dir <path>` | `--add-dir <path>` |
| `--json` (verbose) | `--output-format stream-json` |
| quiet `-o file.md` | `--output-format json` → parse `result` field |
| session from JSONL | `session_id` in JSON → `--resume <id>` |
| `CODEX_API_KEY` | `CURSOR_API_KEY` or `agent login` |
| `--dangerously-bypass-approvals` | `--trust --force` |

## Smoke tests (logged in)

```bash
agent status
# ✓ Logged in as ...

# Plan mode (read-only)
agent -p --plan --trust --workspace . --output-format json "Reply with exactly: PLAN_OK"
# → {"type":"result","result":"PLAN_OK","session_id":"..."}

# Implement mode
agent -p --trust --force --workspace . --output-format json "Reply with exactly: IMPL_OK"

# Resume session
agent -p --trust --resume <session_id> --workspace . --output-format json "..."
```

## Code layout

```
src/config/developer-runtime.ts     # AGENT_RUNTIME=cursor|codex
src/integrations/developer-agent.ts # runDeveloperAgent() dispatcher
src/integrations/cursor-agent.ts    # Cursor Agent CLI wrapper
src/integrations/codex.ts           # Legacy Codex wrapper (unchanged API)
```

Graph nodes `codex-plan` and `invoke-codex` call `runDeveloperAgent()`.

## Environment

```bash
AGENT_RUNTIME=cursor          # default
CURSOR_AGENT_BIN=agent        # ~/.local/bin/agent after installer
CURSOR_AGENT_MODEL=           # optional, e.g. composer-2.5
CURSOR_API_KEY=               # optional if agent login done
AGENT_RUNTIME=codex           # fallback to codex exec
```

## Auth

1. Install: Cursor Agent installer → `agent` on PATH (`~/.local/bin/agent`)
2. Login: `agent login`
3. Verify: `agent status`

## Output parsing

**Quiet (daemon default):** single JSON line per run:

```json
{
  "type": "result",
  "subtype": "success",
  "result": "<final text>",
  "session_id": "<uuid>",
  "is_error": false
}
```

**Verbose (`AGENT_VERBOSE=1`):** `stream-json` lines; final `type=result` wins.

**Blocked questions:** prompt still uses `BLOCKED: <question>`; parsed from `result` text.

## Session continuity

State fields unchanged for checkpoint compat:

- `codexPlanSessionId` — plan phase session
- `codexSessionId` — implement phase session

Cursor `session_id` is stored in these fields and passed as `--resume`.

## What stays orchestrator-owned

LangGraph still owns:

- Jira fetch, repo routing, human gates (plan / implement / ship)
- Worktree creation under `.agent-runs/<thread>/worktrees/`
- Lint / test / e2e after implement (Option B: after implement approval)
- Git commit, push, MR (`ship` node)

Cursor Agent must **not** commit, push, or open MRs (enforced in prompts).

## Future considerations

### Native `--plan` mode

Cursor `--plan` is read-only by design. We may shorten `buildCodexPlanPrompt` over time and rely more on Cursor's plan mode behavior + `.cursor/skills`.

### Built-in worktrees

`agent -w/--worktree` creates worktrees under `~/.cursor/worktrees/`. Our orchestrator uses `.agent-runs/<thread>/worktrees/` for multi-agent isolation. **Keep orchestrator worktrees** until we can map thread → Cursor worktree name deterministically.

### React review app

Ship / implement approval gates can link to a review UI; `session_id` + `threadId` are the correlation keys.

## Rollback

```bash
AGENT_RUNTIME=codex
```

Ensure `codex` is on PATH and `CODEX_API_KEY` or Codex auth is configured.
