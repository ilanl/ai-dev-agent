# Dashboard — Ticket Management Plan

**Status:** Plan (not yet implemented)  
**Audience:** Operators using the dashboard; engineers improving it

---

## 1. Purpose

The dashboard is the **local control surface** for AI Dev Agent runs — not a Jira replacement.

| Dashboard owns | External systems own |
|----------------|-------------------|
| Start / resume / reset agent runs | Jira ticket fields & workflow |
| Human gates (plan, ship, question) | GitLab MR review & merge |
| Inbox by phase (`needs_you`, `running`, `done`) | Slack notifications (parallel path) |
| Per-agent run isolation | Repo source of truth |

**Mental model:** one inbox row = one LangGraph thread (`<agentId>:<AE-KEY>`) with checkpoint state.

---

## 2. Architecture (how data flows)

```
Browser (Vite :5173/5174 or static on :9478)
  │  GET /api/*          initial load + actions
  │  WS  /ws             live ticket.updated pushes
  ▼
Dashboard server (:9478) — DashboardBridge
  │  Unix socket NDJSON
  ▼
agentd — RunCoordinator + LangGraph checkpointer
  │
  ├── run registry (issue key, thread id, timestamps)
  ├── ticket.listWithStatus → merge meta + status + busy
  └── events: run.started | interrupt | run.completed | run.error
```

### Key files

| Layer | Path |
|-------|------|
| UI inbox + actions | `app-ui/src/App.tsx`, `TicketInbox.tsx`, `TicketDetail.tsx`, `ActionBar.tsx` |
| WebSocket client | `app-ui/src/useDashboardSocket.ts` |
| HTTP API | `src/app-server/http.ts` |
| Bridge + broadcast | `src/app-server/bridge.ts` |
| agentd gateway | `src/server/agent-gateway.ts` |
| Ticket view model | `src/server/ticket-views.ts` |
| Run lifecycle | `src/run-coordinator.ts`, `src/graph/build-graph.ts` |

### Phases (derived, not stored)

| Phase | Rule (`ticket-views.ts`) |
|-------|--------------------------|
| `needs_you` | `status.awaiting` is set (human gate open) |
| `running` | `busy` or `status.next.length > 0` |
| `done` | `status` is shipped / rejected / failed |
| `idle` | otherwise |

### Human gates

| Gate | Graph node | Dashboard actions |
|------|------------|-------------------|
| `plan` | `planApproval` | Implement, Reject, Send feedback |
| `ship` | `shipApproval` | Ship, Reject, Send feedback |
| `question` | `askQuestion` | Submit answer (resume) |

---

## 3. Operator runbook (today)

### Prerequisites

```bash
npm run agentd          # terminal 1 — required
npm run dashboard:dev   # terminal 2 — UI hot reload + API :9478
# Or: npm run dashboard — single port :9478 (prod-like)
```

Confirm in the top bar:

- Green **agentd** dot
- **live** WebSocket indicator (not "reconnecting…")

### Daily workflow

1. **Open inbox** — default filter **Needs you** is the action queue.
2. **Select agent** — dropdown scopes runs to one `agentId` slot.
3. **Start** — enter `AE-1234`, click Start. One thread per `agentId + issueKey`.
4. **Plan gate** — read plan + risks → **Implement** | **Send feedback** | **Reject**.
5. **Wait** — while `busy` or phase `running`, do not spam actions (`THREAD_BUSY`).
6. **Question gate** — read interrupt body → **Submit answer**.
7. **Ship gate** — **Ship** | **Send feedback** | **Reject** → follow up in GitLab.
8. **Done** — shipped / rejected / failed. **Reset** only for a clean retry.

### Decision playbook

```
Needs you
  awaiting: plan    → Implement | feedback | Reject
  awaiting: ship    → Ship      | feedback | Reject
  awaiting: question → Submit answer

running + busy      → Wait

done                → GitLab / Jira follow-up; Reset if retrying

agentd down         → npm run agentd; reload page
reconnecting…       → reload if inbox stale >30s
```

### Multi-ticket discipline

- One active implement per agent (thread lock during runs).
- Clear **Needs you** before starting more tickets.
- Use **Running** tab for monitoring only.
- **Reset** sparingly — prefer feedback at plan/ship gates.

---

## 4. Gap analysis (today)

| Gap | Impact | Workaround |
|-----|--------|------------|
| Full `load()` after every action | Slow inbox, races with WS | Wait for reload spinner |
| `run.event` triggers full inbox refetch | Extra agentd load | — |
| `refreshAfterEvent` lists all tickets to find one | O(n) on every event | — |
| No per-ticket activity log | Hard to debug long runs | Tail agentd terminal |
| No MR / Jira links in UI | Manual navigation | Open by issue key / branch |
| `busy` disables actions without explanation | Operator confusion | Know to wait |
| Vite WS proxy EPIPE/ECONNRESET in dev | Noisy logs | Harmless if data updates |
| No dry-run toggle in UI | Plan-only runs need CLI | `npm run agent -- AE-1234 --dry-run` |
| Two terminals minimum | Setup friction | Document clearly |

---

## 5. Implementation plan

### Phase 0 — Documentation & linking (this PR)

- [x] `docs/dashboard-plan.md` (this file)
- [x] Link from `README.md` dashboard section

### Phase 1 — Operator clarity (P0)

**Goal:** Reduce "why won't it work?" moments without changing agentd protocol.

| Task | File(s) | Notes |
|------|---------|-------|
| Plain-English status line per ticket | `TicketDetail.tsx`, `ticketStatus.ts` | e.g. "Waiting for plan approval" |
| Busy-state message when actions disabled | `ActionBar.tsx` | "Agent is working — wait for the current step" |
| Surface 409 `THREAD_BUSY` as friendly copy | `ActionBar.tsx`, `api.ts` | Server already returns 409 |
| Manual **Refresh** button | `App.tsx` topbar | Calls `load()`; banner when WS disconnected |
| Link README → this plan | `README.md` | — |

**Done when:** Operator can triage a stuck ticket without reading source code.

### Phase 2 — Lighter, faster updates (P1)

**Goal:** Less load on agentd; snappier UI.

| Task | File(s) | Notes |
|------|---------|-------|
| Stop `load()` on every `run.event` | `App.tsx`, `useDashboardSocket.ts` | Trust `ticket.updated`; reload only on WS reconnect |
| Exponential backoff on WS reconnect | `useDashboardSocket.ts` | 1s → 2s → 4s … cap 30s |
| Patch ticket from action response instead of full reload | `ActionBar.tsx`, `http.ts`, `bridge.ts` | Return `ticket` from start/respond/resume |
| `refreshAfterEvent`: `ticket.summary` not `listWithStatus` | `bridge.ts`, `connection.ts` | Single-ticket refresh |
| Direct WS to `:9478` in dev | `useDashboardSocket.ts` | Reduces proxy EPIPE noise |

**Done when:** Approving a plan updates one row instantly; agentd log shows no full list on every event.

### Phase 3 — Visibility (P2)

**Goal:** Long runs are understandable.

| Task | File(s) | Notes |
|------|---------|-------|
| Per-ticket activity feed from `run.event` | New `TicketActivity.tsx`, `App.tsx` | Append events for selected thread |
| Show Jira browse URL when in state | `TicketDetail.tsx` | From `jira` in checkpoint if exposed via status |
| Show branch + MR URL after ship | `TicketDetail.tsx` | From `mrUrls` in status |
| Idle polling fallback while any ticket `running`/`busy` | `App.tsx` | 15–30s interval only when WS down or runs active |

**Done when:** Operator can see what the agent did without leaving the dashboard.

### Phase 4 — DevEx & power features (P3)

| Task | Notes |
|------|-------|
| `npm run dashboard:all` — concurrently `agentd` + `dashboard:dev` | One command dev |
| Dry-run checkbox on Start | Maps to `ticket.start` `dryRun` param |
| Cross-agent "all needs_you" view | Needs API filter by phase across agents |
| Slack ping on interrupt; dashboard for rich review | Aligns with v1 plan |

---

## 6. Success criteria

| Metric | Target |
|--------|--------|
| Time to act on plan gate | < 3 clicks from inbox open |
| Stale inbox after action | < 2s without full page reload (after Phase 2) |
| operator questions about `busy` / `THREAD_BUSY` | Zero after Phase 1 |
| Dev WS proxy errors | Cosmetic only; no functional impact |

---

## 7. Out of scope (dashboard)

- Jira field editing or sprint management
- GitLab MR diff review (link only)
- Replacing Slack as primary notification channel
- Custom code editing in the UI
- Multi-repo ticket routing UI (stays in agent graph + CLI)

---

## 8. Next step

Phases 1–2 are implemented. Next: **Phase 3** (activity feed, Jira/MR links, polling fallback).
