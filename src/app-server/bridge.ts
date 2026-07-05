import type { WebSocket } from "ws";
import type { RespondAction } from "../integrations/respond.js";
import { AgentGateway } from "../server/agent-gateway.js";
import type { TicketSummary } from "../server/ticket-views.js";
import type { EventMessage } from "../server/protocol.js";

export type WsOutbound =
  | { type: "ticket.updated"; data: TicketSummary }
  | { type: "run.event"; data: EventMessage }
  | { type: "agent.changed"; data: { agentId: string } }
  | { type: "error"; data: { message: string } };

export class DashboardBridge {
  private gateway: AgentGateway;
  private readonly clients = new Set<WebSocket>();
  private agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
    this.gateway = this.createGateway(agentId);
  }

  private createGateway(agentId: string): AgentGateway {
    return new AgentGateway(agentId, {
      clientName: "dashboard",
      onRunEvent: (event) => {
        this.broadcast({ type: "run.event", data: event });
        void this.refreshAfterEvent(event);
      },
    });
  }

  getAgentId(): string {
    return this.agentId;
  }

  async setAgentId(agentId: string): Promise<void> {
    this.agentId = agentId;
    this.gateway.disconnect();
    this.gateway = this.createGateway(agentId);
    this.broadcast({ type: "agent.changed", data: { agentId } });
    await this.resubscribeAll();
  }

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    ws.on("close", () => this.clients.delete(ws));
  }

  private broadcast(message: WsOutbound): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  }

  private async refreshAfterEvent(event: EventMessage): Promise<void> {
    const data = event.data as { threadId?: string };
    if (!data.threadId) return;
    try {
      const tickets = await this.gateway.listWithStatus(this.agentId);
      const match = tickets.find((t) => t.threadId === data.threadId);
      if (match) {
        this.broadcast({ type: "ticket.updated", data: match });
      }
    } catch {
      // agentd may be briefly busy
    }
  }

  async health(): Promise<{
    agentd: "ok" | "down";
    agentId: string;
  }> {
    try {
      await this.gateway.listWithStatus(this.agentId);
      return { agentd: "ok", agentId: this.agentId };
    } catch {
      return { agentd: "down", agentId: this.agentId };
    }
  }

  async listAgents() {
    return this.gateway.listAgents();
  }

  async listTickets(): Promise<TicketSummary[]> {
    const tickets = await this.gateway.listWithStatus(this.agentId);
    await this.gateway.subscribe(tickets.map((t) => t.threadId));
    return tickets;
  }

  async getTicket(issueKey: string): Promise<TicketSummary | null> {
    const tickets = await this.gateway.listWithStatus(this.agentId);
    return tickets.find((t) => t.issueKey === issueKey.toUpperCase()) ?? null;
  }

  async startTicket(issueKey: string) {
    const result = await this.gateway.start(issueKey, this.agentId);
    await this.gateway.subscribe([result.threadId]);
    const ticket = await this.getTicket(issueKey);
    if (ticket) this.broadcast({ type: "ticket.updated", data: ticket });
    return result;
  }

  async resumeTicket(issueKey: string, message: string) {
    const result = await this.gateway.resume(issueKey, message, this.agentId);
    const ticket = await this.getTicket(issueKey);
    if (ticket) this.broadcast({ type: "ticket.updated", data: ticket });
    return result;
  }

  async respondTicket(issueKey: string, action: RespondAction, text?: string) {
    const result = await this.gateway.respond(issueKey, action, text, this.agentId);
    const ticket = await this.getTicket(issueKey);
    if (ticket) this.broadcast({ type: "ticket.updated", data: ticket });
    return result;
  }

  async resetTicket(issueKey: string) {
    return this.gateway.reset(issueKey, this.agentId);
  }

  private async resubscribeAll(): Promise<void> {
    try {
      const tickets = await this.gateway.listWithStatus(this.agentId);
      if (tickets.length) {
        await this.gateway.subscribe(tickets.map((t) => t.threadId));
      }
    } catch {
      // agentd down
    }
  }
}
