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
  const [error, setError] = useState<string | null>(null);
  const [newTicket, setNewTicket] = useState("");
  const [starting, setStarting] = useState(false);

  const selected = useMemo(
    () => tickets.find((t) => t.issueKey === selectedKey) ?? null,
    [tickets, selectedKey]
  );

  const load = useCallback(async () => {
    setError(null);
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
      setError(err instanceof Error ? err.message : String(err));
      setAgentdOk(false);
    } finally {
      setLoading(false);
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

  const { connected } = useDashboardSocket({
    onTicketUpdated: patchTicket,
    onAgentChanged: (id) => {
      setAgentId(id);
      void load();
    },
    onReconnect: () => void load(),
  });

  async function handleAgentChange(id: string) {
    setLoading(true);
    try {
      await setAgent(id);
      setAgentId(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
      await startTicket(key);
      setNewTicket("");
      setSelectedKey(key);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  async function handleReset() {
    if (!selectedKey) return;
    if (!window.confirm(`Reset ${selectedKey}? This clears checkpoint and artifacts.`)) return;
    try {
      await resetTicket(selectedKey);
      setSelectedKey(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
          <TicketDetail ticket={selected} onAction={() => void load()} />
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
