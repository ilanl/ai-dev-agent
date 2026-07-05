import type { AgentRecord, TicketSummary } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return body;
}

export async function fetchHealth(): Promise<{ agentd: "ok" | "down"; agentId: string }> {
  try {
    return await request("/api/health");
  } catch {
    return { agentd: "down", agentId: "" };
  }
}

export async function fetchAgents(): Promise<{
  agents: AgentRecord[];
  runs: unknown[];
}> {
  return request("/api/agents");
}

export async function setAgent(agentId: string): Promise<{ agentId: string }> {
  return request("/api/agents", {
    method: "POST",
    body: JSON.stringify({ agentId }),
  });
}

export async function fetchTickets(): Promise<{
  agentId: string;
  tickets: TicketSummary[];
}> {
  return request("/api/tickets");
}

export async function startTicket(issueKey: string): Promise<unknown> {
  return request(`/api/tickets/${issueKey}/start`, { method: "POST" });
}

export async function respondTicket(
  issueKey: string,
  action: "approve" | "reject" | "ship" | "comment",
  text?: string
): Promise<unknown> {
  return request(`/api/tickets/${issueKey}/respond`, {
    method: "POST",
    body: JSON.stringify({ action, ...(text ? { text } : {}) }),
  });
}

export async function resumeTicket(issueKey: string, message: string): Promise<unknown> {
  return request(`/api/tickets/${issueKey}/resume`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function resetTicket(issueKey: string): Promise<unknown> {
  return request(`/api/tickets/${issueKey}/reset`, { method: "POST" });
}
