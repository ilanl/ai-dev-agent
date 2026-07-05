import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAgents,
  fetchHealth,
  fetchTickets,
  resetTicket,
  setAgent,
  startTicket,
} from "./api";
import { TicketDetail } from "./components/TicketDetail";
import { TicketInbox } from "./components/TicketInbox";
import type { AgentRecord, TicketPhase, TicketSummary } from "./types";
import { formatApiError } from "./ticketStatus";
import { useDashboardSocket } from "./useDashboardSocket";
import "./App.css";

type Filter = "all" | TicketPhase;

export function App() {
  const [agentId, setAgentId] = useState("");
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("needs_you");
  const [agentdOk, setAgentdOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTicket, setNewTicket] = useState("");
  const [starting, setStarting] = useState(false);
  const [actingThreadId, setActingThreadId] = useState<string | null>(null);
  const handleActingChange = useCallback((threadId: string, acting: boolean) => {
    if (acting) {
      setActingThreadId(threadId);
      return;
    }
    setActingThreadId((prev) => (prev === threadId ? null : prev));
  }, []);

  const selected = useMemo(
    () => tickets.find((t) => t.issueKey === selectedKey) ?? null,
    [tickets, selectedKey]
  );

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setError(null);
    try {
      const health = await fetchHealth();
      setAgentdOk(health.agentd === "ok");
      if (health.agentId) setAgentId(health.agentId);

      const agentData = await fetchAgents();
      setAgents(agentData.agents);

      const data = await fetchTickets();
      setAgentId(data.agentId);
      setTickets(data.tickets);
    } catch (err) {
      setError(formatApiError(err));
      setAgentdOk(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchTicket = useCallback((updated: TicketSummary) => {
    setTickets((prev) => {
      const idx = prev.findIndex((t) => t.threadId === updated.threadId);
      if (idx < 0) return [...prev, updated];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }, []);

  const removeTicket = useCallback((issueKey: string) => {
    setTickets((prev) => prev.filter((t) => t.issueKey !== issueKey));
  }, []);

  const { connected } = useDashboardSocket({
    onTicketUpdated: patchTicket,
    onAgentChanged: (id) => {
      setAgentId(id);
      void load({ silent: true });
    },
    onReconnect: () => void load({ silent: true }),
  });

  function handleRefresh() {
    setRefreshing(true);
    void load();
  }

  async function handleAgentChange(id: string) {
    setActingThreadId(null);
    setLoading(true);
    try {
      await setAgent(id);
      setAgentId(id);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleStart() {
    const key = newTicket.trim().toUpperCase();
    if (!/^AE-\d+$/.test(key)) {
      setError("Enter a valid ticket key, e.g. AE-1234");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const { ticket } = await startTicket(key);
      setNewTicket("");
      setSelectedKey(key);
      if (ticket) patchTicket(ticket);
      else await load({ silent: true });
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setStarting(false);
    }
  }

  async function handleReset() {
    if (!selectedKey) return;
    if (!window.confirm(`Reset ${selectedKey}? This clears checkpoint and artifacts.`)) return;
    try {
      await resetTicket(selectedKey);
      removeTicket(selectedKey);
      setSelectedKey(null);
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  const agentOptions = useMemo(() => {
    const ids = new Set(agents.map((a) => a.agentId));
    if (agentId) ids.add(agentId);
    return [...ids].sort();
  }, [agents, agentId]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>AI Dev Agent</h1>
          <span className={`dot ${agentdOk ? "ok" : "down"}`} title={agentdOk ? "agentd ok" : "agentd down"} />
          <span className={`ws ${connected ? "ok" : ""}`}>{connected ? "live" : "reconnecting…"}</span>
        </div>

        <button
          className="secondary"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          title={connected ? "Refresh inbox" : "WebSocket disconnected — refresh inbox"}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>

        <label className="agent-picker">
          Agent
          <select
            value={agentId}
            onChange={(e) => void handleAgentChange(e.target.value)}
            disabled={loading}
          >
            {agentOptions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>

        <div className="start-row">
          <input
            value={newTicket}
            onChange={(e) => setNewTicket(e.target.value)}
            placeholder="AE-1234"
            disabled={starting}
          />
          <button disabled={starting || !agentdOk} onClick={() => void handleStart()}>
            Start
          </button>
        </div>
      </header>

      {!agentdOk && (
        <div className="banner">
          agentd is not running. Start it with <code>npm run agentd</code>
        </div>
      )}

      {!connected && agentdOk && (
        <div className="banner">
          Live updates disconnected — inbox may be stale. Click <strong>Refresh</strong> or reload the page.
        </div>
      )}

      {error && <div className="banner error">{error}</div>}

      <main className="layout">
        <TicketInbox
          tickets={tickets}
          selectedKey={selectedKey}
          filter={filter}
          onFilterChange={setFilter}
          onSelect={setSelectedKey}
        />
        <div className="detail-pane">
          <TicketDetail
            ticket={selected}
            onTicketUpdated={patchTicket}
            actingThreadId={actingThreadId}
            onActingChange={handleActingChange}
          />
          {selected && (
            <footer className="detail-footer">
              <button className="danger" onClick={() => void handleReset()}>
                Reset ticket
              </button>
            </footer>
          )}
        </div>
      </main>

      {loading && <div className="loading">Loading…</div>}
    </div>
  );
}
