import { buildThreadId } from "../integrations/run-registry.js";
import type { AgentRecord } from "./agent-registry.js";
import type { RespondAction } from "../integrations/respond.js";
import type { ResetResult, RunResult, RunStatusResult } from "../run-coordinator.js";
import type { RunMeta } from "../integrations/run-registry.js";
import type { TicketSummary } from "./ticket-views.js";
import { mergeTicketSummary, sortTicketSummaries } from "./ticket-views.js";
import { AgentSocketClient } from "./client.js";
import type { EventMessage } from "./protocol.js";

export type RunEventHandler = (event: EventMessage) => void;

export interface AgentGatewayOptions {
  clientName?: string;
  onRunEvent?: RunEventHandler;
}

export class AgentGateway {
  private client: AgentSocketClient | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private readonly clientName: string;
  private readonly onRunEvent: RunEventHandler | undefined;

  constructor(
    private agentId: string,
    options?: AgentGatewayOptions | RunEventHandler
  ) {
    if (typeof options === "function") {
      this.onRunEvent = options;
      this.clientName = "client";
    } else {
      this.clientName = options?.clientName ?? "client";
      this.onRunEvent = options?.onRunEvent;
    }
  }

  getAgentId(): string {
    return this.agentId;
  }

  setAgentId(agentId: string): void {
    this.agentId = agentId;
  }

  private eventHandler(): RunEventHandler | undefined {
    if (!this.onRunEvent) return undefined;
    return (event) => this.onRunEvent!(event);
  }

  private async ensureConnected(): Promise<AgentSocketClient> {
    if (this.client?.isConnected()) return this.client;
    this.client = null;

    const client = new AgentSocketClient();
    const ok = await client.connect();
    if (!ok) {
      throw new Error("agentd is not running. Start it with: npm run agentd");
    }
    await client.hello({ client: this.clientName, agentId: this.agentId });
    if (this.onRunEvent) {
      client.setOnEvent((event) => this.onRunEvent!(event));
    }
    this.client = client;
    return client;
  }

  private run<T>(fn: (client: AgentSocketClient) => Promise<T>): Promise<T> {
    const task = this.chain.then(() => this.ensureConnected()).then(fn);
    this.chain = task.catch(() => undefined);
    return task;
  }

  threadId(issueKey: string, agentId?: string): string {
    return buildThreadId(agentId ?? this.agentId, issueKey.toUpperCase());
  }

  async listAgents(): Promise<{ agents: AgentRecord[]; runs: RunMeta[] }> {
    return this.run(async (client) => {
      const res = await client.request<{ agents: AgentRecord[]; runs: RunMeta[] }>("agent.list");
      if (!res.ok) throw new Error(res.error?.message ?? "agent.list failed");
      return res.result as { agents: AgentRecord[]; runs: RunMeta[] };
    });
  }

  async subscribe(threadIds: string[]): Promise<string[]> {
    return this.run(async (client) => {
      const res = await client.request<{ subscriptions: string[] }>("session.subscribe", {
        threadIds,
        agentId: this.agentId,
      });
      if (!res.ok) throw new Error(res.error?.message ?? "session.subscribe failed");
      return (res.result as { subscriptions: string[] }).subscriptions;
    });
  }

  async start(issueKey: string, agentId?: string): Promise<RunResult> {
    const resolvedAgentId = agentId ?? this.agentId;
    return this.run(async (client) => {
      const res = await client.request<RunResult>(
        "ticket.start",
        {
          issueKey: issueKey.toUpperCase(),
          agentId: resolvedAgentId,
        },
        this.eventHandler()
      );
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.start failed");
      return res.result as RunResult;
    });
  }

  async resume(issueKey: string, message: string, agentId?: string): Promise<RunResult> {
    return this.run(async (client) => {
      const threadId = this.threadId(issueKey, agentId);
      const res = await client.request<RunResult>(
        "ticket.resume",
        { threadId, message },
        this.eventHandler()
      );
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.resume failed");
      return res.result as RunResult;
    });
  }

  async respond(
    issueKey: string,
    action: RespondAction,
    text?: string,
    agentId?: string
  ): Promise<RunResult> {
    return this.run(async (client) => {
      const threadId = this.threadId(issueKey, agentId);
      const params: Record<string, unknown> = { threadId, action };
      if (text !== undefined) params.text = text;
      const res = await client.request<RunResult>("ticket.respond", params, this.eventHandler());
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.respond failed");
      return res.result as RunResult;
    });
  }

  async status(issueKey: string, agentId?: string): Promise<RunStatusResult> {
    return this.run(async (client) => {
      const res = await client.request<RunStatusResult>("ticket.status", {
        threadId: this.threadId(issueKey, agentId),
      });
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.status failed");
      return res.result as RunStatusResult;
    });
  }

  async statusByThreadId(threadId: string): Promise<RunStatusResult> {
    return this.run(async (client) => {
      const res = await client.request<RunStatusResult>("ticket.status", { threadId });
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.status failed");
      return res.result as RunStatusResult;
    });
  }

  async getTicketSummary(threadId: string): Promise<TicketSummary | null> {
    return this.run(async (client) => {
      const res = await client.request<TicketSummary>("ticket.summary", { threadId });
      if (!res.ok) {
        if (res.error?.code === "NOT_FOUND") return null;
        throw new Error(res.error?.message ?? "ticket.summary failed");
      }
      return res.result as TicketSummary;
    });
  }

  async reset(issueKey: string, agentId?: string): Promise<ResetResult> {
    return this.run(async (client) => {
      const res = await client.request<ResetResult>("ticket.reset", {
        threadId: this.threadId(issueKey, agentId),
      });
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.reset failed");
      return res.result as ResetResult;
    });
  }

  async list(agentId?: string): Promise<RunMeta[]> {
    return this.run(async (client) => {
      const res = await client.request<RunMeta[]>("ticket.list", {
        agentId: agentId ?? this.agentId,
      });
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.list failed");
      return res.result as RunMeta[];
    });
  }

  async listWithStatus(agentId?: string): Promise<TicketSummary[]> {
    return this.run(async (client) => {
      const resolvedAgentId = agentId ?? this.agentId;
      const res = await client.request<TicketSummary[]>("ticket.listWithStatus", {
        agentId: resolvedAgentId,
      });
      if (res.ok) return res.result as TicketSummary[];

      if (res.error?.code === "UNKNOWN_METHOD") {
        const listRes = await client.request<RunMeta[]>("ticket.list", {
          agentId: resolvedAgentId,
        });
        if (!listRes.ok) throw new Error(listRes.error?.message ?? "ticket.list failed");
        const metas = listRes.result as RunMeta[];
        const summaries = await Promise.all(
          metas.map(async (meta) => {
            const statusRes = await client.request<RunStatusResult>("ticket.status", {
              threadId: meta.threadId,
            });
            if (!statusRes.ok) {
              throw new Error(statusRes.error?.message ?? "ticket.status failed");
            }
            return mergeTicketSummary(meta, statusRes.result as RunStatusResult, false);
          })
        );
        return sortTicketSummaries(summaries);
      }

      throw new Error(res.error?.message ?? "ticket.listWithStatus failed");
    });
  }

  disconnect(): void {
    this.client?.disconnect();
    this.client = null;
  }
}
