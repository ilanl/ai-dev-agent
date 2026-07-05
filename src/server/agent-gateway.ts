import { buildThreadId } from "../integrations/run-registry.js";
import type {
  ResetResult,
  RunResult,
  RunStatusResult,
} from "../run-coordinator.js";
import type { RunMeta } from "../integrations/run-registry.js";
import { AgentSocketClient } from "./client.js";
import type { EventMessage } from "./protocol.js";

export type RunEventHandler = (event: EventMessage) => void;

export class AgentGateway {
  private client: AgentSocketClient | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly agentId: string,
    private readonly onRunEvent?: RunEventHandler,
  ) {}

  private eventHandler(): RunEventHandler | undefined {
    if (!this.onRunEvent) return undefined;
    return (event) => this.onRunEvent!(event);
  }

  private async ensureConnected(): Promise<AgentSocketClient> {
    if (this.client) return this.client;
    const client = new AgentSocketClient();
    const ok = await client.connect();
    if (!ok) {
      throw new Error("agentd is not running. Start it with: pnpm run agentd");
    }
    await client.hello({ client: "slack", agentId: this.agentId });
    this.client = client;
    return client;
  }

  private run<T>(fn: (client: AgentSocketClient) => Promise<T>): Promise<T> {
    const task = this.chain.then(() => this.ensureConnected()).then(fn);
    this.chain = task.catch(() => undefined);
    return task;
  }

  threadId(issueKey: string): string {
    return buildThreadId(this.agentId, issueKey.toUpperCase());
  }

  async start(issueKey: string): Promise<RunResult> {
    return this.run(async (client) => {
      const res = await client.request<RunResult>(
        "ticket.start",
        {
          issueKey: issueKey.toUpperCase(),
          agentId: this.agentId,
        },
        this.eventHandler(),
      );
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.start failed");
      return res.result as RunResult;
    });
  }

  async resume(issueKey: string, message: string): Promise<RunResult> {
    return this.run(async (client) => {
      const threadId = this.threadId(issueKey);
      const res = await client.request<RunResult>(
        "ticket.resume",
        { threadId, message },
        this.eventHandler(),
      );
      if (!res.ok)
        throw new Error(res.error?.message ?? "ticket.resume failed");
      return res.result as RunResult;
    });
  }

  async status(issueKey: string): Promise<RunStatusResult> {
    return this.run(async (client) => {
      const res = await client.request<RunStatusResult>("ticket.status", {
        threadId: this.threadId(issueKey),
      });
      if (!res.ok)
        throw new Error(res.error?.message ?? "ticket.status failed");
      return res.result as RunStatusResult;
    });
  }

  async reset(issueKey: string): Promise<ResetResult> {
    return this.run(async (client) => {
      const res = await client.request<ResetResult>("ticket.reset", {
        threadId: this.threadId(issueKey),
      });
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.reset failed");
      return res.result as ResetResult;
    });
  }

  async list(): Promise<RunMeta[]> {
    return this.run(async (client) => {
      const res = await client.request<RunMeta[]>("ticket.list", {
        agentId: this.agentId,
      });
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.list failed");
      return res.result as RunMeta[];
    });
  }
}
