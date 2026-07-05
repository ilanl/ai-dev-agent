import type { Socket } from "node:net";
import { loadServerEnv } from "../config/server-env.js";
import {
  extractThreadFields,
  formatStatusFields,
  logAgentDebug,
  logAgentInfo,
} from "../integrations/agent-log.js";
import { buildThreadId } from "../integrations/run-registry.js";
import { actionToMessage } from "../integrations/respond.js";
import {
  CoordinatorError,
  getRunCoordinator,
  type RunEvent,
  type RunStatusResult,
} from "../run-coordinator.js";
import { ensureAgent, listAgents, registerAgent } from "./agent-registry.js";
import {
  CLIENT_MESSAGE_TYPE,
  encodeOutbound,
  PROTOCOL_VERSION,
  ProtocolError,
  SERVER_MESSAGE_TYPE,
  type EventMessage,
  type HelloMessage,
  type InboundMessage,
  type RequestMessage,
  type ResponseMessage,
  type WelcomeMessage,
} from "./protocol.js";
import type { RunResult, StartRunParams } from "../run-coordinator.js";

export interface SessionFocus {
  agentId: string;
  issueKey?: string;
  threadId?: string;
}

export class ClientConnection {
  private buffer = "";
  private greeted = false;
  focus: SessionFocus;
  private readonly subscriptions = new Set<string>();

  constructor(
    private readonly socket: Socket,
    defaultAgentId: string,
  ) {
    this.focus = { agentId: defaultAgentId };
  }

  attach(): void {
    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => {
      this.buffer += chunk;
      this.flushLines();
    });
    this.socket.on("error", () => {
      this.socket.destroy();
    });
  }

  private flushLines(): void {
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      void this.handleLine(line);
    }
  }

  private async handleLine(line: string): Promise<void> {
    try {
      const message = JSON.parse(line) as InboundMessage;
      if (message.type === CLIENT_MESSAGE_TYPE.HELLO) {
        await this.handleHello(message as HelloMessage);
        return;
      }
      if (!this.greeted) {
        await this.sendWelcome(this.focus.agentId);
      }
      if (message.type === CLIENT_MESSAGE_TYPE.REQ) {
        await this.handleRequest(message as RequestMessage);
        return;
      }
      throw new ProtocolError(
        "INVALID_MESSAGE",
        `Unknown message type: ${JSON.stringify(message)}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.write({
        type: SERVER_MESSAGE_TYPE.RES,
        id: "0",
        ok: false,
        error: { code: "INVALID_MESSAGE", message: msg },
      });
    }
  }

  private async handleHello(msg: HelloMessage): Promise<void> {
    if (msg.agentId) {
      this.focus.agentId = msg.agentId;
      await ensureAgent(msg.agentId, msg.client ?? "hello");
    }
    logAgentInfo("client.hello", {
      client: msg.client ?? "unknown",
      agentId: this.focus.agentId,
    });
    await this.sendWelcome(this.focus.agentId);
  }

  private async sendWelcome(agentId: string): Promise<void> {
    const env = loadServerEnv();
    this.write({
      type: SERVER_MESSAGE_TYPE.WELCOME,
      version: PROTOCOL_VERSION,
      server: "ai-dev-agent",
      defaultAgentId: agentId,
      repos: {
        client: env.clientRepoPath,
        server: env.serverRepoPath,
      },
    });
    this.greeted = true;
  }

  private async handleRequest(req: RequestMessage): Promise<void> {
    const params = req.params ?? {};
    const threadFields = extractThreadFields(params);
    const startedAt = Date.now();

    logAgentInfo("req.start", {
      method: req.method,
      client: this.focus.agentId,
      ...threadFields,
    });

    try {
      const result = await this.dispatch(req.method, params);
      const doneFields: Record<string, unknown> = {
        method: req.method,
        durationMs: Date.now() - startedAt,
        ok: true,
        ...threadFields,
      };
      if (
        req.method === "ticket.status" &&
        result &&
        typeof result === "object"
      ) {
        Object.assign(
          doneFields,
          formatStatusFields(result as RunStatusResult),
        );
      }
      if (
        (req.method === "ticket.start" || req.method === "ticket.resume") &&
        result &&
        typeof result === "object"
      ) {
        const run = result as RunResult;
        Object.assign(doneFields, {
          threadId: run.threadId,
          phase: run.phase,
          status: run.status,
          interrupted: run.interrupted,
          ...(run.interrupt?.gate ? { awaiting: run.interrupt.gate } : {}),
          ...(run.error ? { error: run.error } : {}),
        });
      }
      logAgentInfo("req.done", doneFields);
      this.write({
        type: SERVER_MESSAGE_TYPE.RES,
        id: req.id,
        ok: true,
        result,
      });
    } catch (err) {
      const code =
        err instanceof CoordinatorError || err instanceof ProtocolError
          ? err.code
          : "INTERNAL_ERROR";
      const message = err instanceof Error ? err.message : String(err);
      logAgentInfo("req.done", {
        method: req.method,
        durationMs: Date.now() - startedAt,
        ok: false,
        code,
        error: message,
        ...threadFields,
      });
      if (err instanceof CoordinatorError || err instanceof ProtocolError) {
        this.write({
          type: SERVER_MESSAGE_TYPE.RES,
          id: req.id,
          ok: false,
          error: { code: err.code, message: err.message },
        });
        return;
      }
      this.write({
        type: SERVER_MESSAGE_TYPE.RES,
        id: req.id,
        ok: false,
        error: { code: "INTERNAL_ERROR", message },
      });
    }
  }

  private async dispatch(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (method) {
      case "agent.register":
        return this.agentRegister(params);
      case "agent.list":
        return this.agentList();
      case "session.focus":
        return this.sessionFocus(params);
      case "session.current":
        return this.sessionCurrent();
      case "session.subscribe":
        return this.sessionSubscribe(params);
      case "ticket.start":
        return this.ticketStart(params);
      case "ticket.resume":
        return this.ticketResume(params);
      case "ticket.respond":
        return this.ticketRespond(params);
      case "ticket.status":
        return this.ticketStatus(params);
      case "ticket.list":
        return this.ticketList(params);
      case "ticket.reset":
        return this.ticketReset(params);
      default:
        throw new ProtocolError("UNKNOWN_METHOD", `Unknown method: ${method}`);
    }
  }

  private async agentRegister(params: Record<string, unknown>) {
    const agentId = requireString(params, "agentId");
    const label = optionalString(params, "label");
    const source = optionalString(params, "source") ?? "register";
    const record = await registerAgent({
      agentId,
      registeredAt: new Date().toISOString(),
      ...(label !== undefined ? { label } : {}),
      ...(source !== undefined ? { source } : {}),
    });
    this.focus.agentId = agentId;
    return record;
  }

  private async agentList() {
    const agents = await listAgents();
    const coordinator = getRunCoordinator();
    const runs = await coordinator.list();
    return { agents, runs };
  }

  private async sessionFocus(params: Record<string, unknown>) {
    const agentId = optionalString(params, "agentId") ?? this.focus.agentId;
    const issueKey = optionalString(params, "issueKey")?.toUpperCase();
    await ensureAgent(agentId, "focus");
    this.focus = {
      agentId,
      ...(issueKey !== undefined ? { issueKey } : {}),
      ...(issueKey !== undefined
        ? { threadId: buildThreadId(agentId, issueKey) }
        : {}),
    };

    if (issueKey) {
      const coordinator = getRunCoordinator();
      const status = await coordinator.status(buildThreadId(agentId, issueKey));
      return { focus: this.focus, status };
    }

    return { focus: this.focus };
  }

  private sessionCurrent() {
    return { focus: this.focus };
  }

  private sessionSubscribe(params: Record<string, unknown>) {
    const threadIds = params.threadIds;
    if (Array.isArray(threadIds)) {
      for (const id of threadIds) {
        if (typeof id === "string") this.subscriptions.add(id);
      }
    }
    const agentId = optionalString(params, "agentId");
    if (agentId) {
      this.focus.agentId = agentId;
    }
    return { subscriptions: [...this.subscriptions] };
  }

  private async ticketStart(params: Record<string, unknown>) {
    const issueKey = requireString(params, "issueKey").toUpperCase();
    const agentId = optionalString(params, "agentId") ?? this.focus.agentId;
    await ensureAgent(agentId, "ticket.start");

    const coordinator = getRunCoordinator();
    const threadId = buildThreadId(agentId, issueKey);
    this.focus = { agentId, issueKey, threadId };
    this.subscriptions.add(threadId);

    const startParams = this.buildStartParams(params, issueKey, agentId);
    return coordinator.start(startParams, (event) => this.emitRunEvent(event));
  }

  private buildStartParams(
    params: Record<string, unknown>,
    issueKey: string,
    agentId: string,
  ): StartRunParams {
    const start: StartRunParams = { issueKey, agentId };
    const scopeParam = optionalString(params, "scope");
    if (scopeParam === "client" || scopeParam === "server")
      start.scope = scopeParam;

    const clientBase = optionalString(params, "clientBase");
    if (clientBase) start.clientBase = clientBase;

    const serverBase = optionalString(params, "serverBase");
    if (serverBase) start.serverBase = serverBase;

    if (typeof params.dryRun === "boolean") start.dryRun = params.dryRun;
    if (typeof params.verbose === "boolean") start.verbose = params.verbose;
    if (typeof params.fullSkills === "boolean")
      start.fullSkills = params.fullSkills;
    if (typeof params.maxAttempts === "number")
      start.maxAttempts = params.maxAttempts;

    const lint = optionalString(params, "lint");
    if (lint) start.lint = lint;
    const test = optionalString(params, "test");
    if (test) start.test = test;
    const e2e = optionalString(params, "e2e");
    if (e2e) start.e2e = e2e;

    return start;
  }

  private async ticketResume(params: Record<string, unknown>) {
    const threadId = this.resolveThreadId(params);
    const message =
      optionalString(params, "message") ??
      (() => {
        throw new ProtocolError(
          "MISSING_MESSAGE",
          "message is required for ticket.resume",
        );
      })();

    const coordinator = getRunCoordinator();
    this.subscriptions.add(threadId);
    return coordinator.resume({ threadId, message }, (event) =>
      this.emitRunEvent(event),
    );
  }

  private async ticketRespond(params: Record<string, unknown>) {
    const threadId = this.resolveThreadId(params);
    const action = requireString(params, "action") as
      | "approve"
      | "reject"
      | "ship"
      | "comment";
    const text = optionalString(params, "text");
    const gate =
      action === "ship"
        ? "ship"
        : action === "comment"
          ? "plan"
          : action === "approve"
            ? "plan"
            : "plan";

    const coordinator = getRunCoordinator();
    const current = await coordinator.status(threadId);
    const resolvedGate = current.awaiting ?? gate;
    const message = actionToMessage(action, text, resolvedGate);

    this.subscriptions.add(threadId);
    return coordinator.resume({ threadId, message }, (event) =>
      this.emitRunEvent(event),
    );
  }

  private async ticketStatus(params: Record<string, unknown>) {
    const threadId = this.resolveThreadId(params);
    const coordinator = getRunCoordinator();
    const status = await coordinator.status(threadId);
    logAgentInfo("status", {
      ...formatStatusFields(status),
      busy: coordinator.isThreadBusy(threadId),
    });
    return status;
  }

  private async ticketList(params: Record<string, unknown>) {
    const agentId = optionalString(params, "agentId") ?? this.focus.agentId;
    return getRunCoordinator().list(agentId);
  }

  private async ticketReset(params: Record<string, unknown>) {
    const threadId = this.resolveThreadId(params);
    const result = await getRunCoordinator().reset(threadId);
    if (this.focus.threadId === threadId) {
      this.focus = { agentId: this.focus.agentId };
    }
    this.subscriptions.delete(threadId);
    return result;
  }

  private resolveThreadId(params: Record<string, unknown>): string {
    const explicit = optionalString(params, "threadId");
    if (explicit) return explicit;

    const issueKey = (
      optionalString(params, "issueKey") ?? this.focus.issueKey
    )?.toUpperCase();
    const agentId = optionalString(params, "agentId") ?? this.focus.agentId;

    if (!issueKey) {
      throw new ProtocolError(
        "MISSING_THREAD",
        "Provide threadId, issueKey, or session.focus first",
      );
    }

    return buildThreadId(agentId, issueKey);
  }

  private emitRunEvent(event: RunEvent): void {
    const threadId = event.data.threadId;
    if (!this.subscriptions.has(threadId)) {
      this.subscriptions.add(threadId);
    }

    const fields: Record<string, unknown> = { threadId };
    if (event.event === "interrupt" && "gate" in event.data) {
      fields.gate = event.data.gate;
      fields.title = event.data.title;
    }
    if (event.event === "run.completed" && "status" in event.data) {
      fields.status = event.data.status;
    }
    if (event.event === "run.error" && "message" in event.data) {
      fields.error = event.data.message;
    }
    logAgentInfo(`run.${event.event}`, fields);
    logAgentDebug("run.event", { event: event.event, threadId });

    const payload: EventMessage = {
      type: SERVER_MESSAGE_TYPE.EVENT,
      event: event.event,
      data: event.data,
    };
    this.write(payload);
  }

  private write(
    message: ResponseMessage | EventMessage | WelcomeMessage,
  ): void {
    this.socket.write(
      encodeOutbound(message as Parameters<typeof encodeOutbound>[0]),
    );
  }
}

function requireString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ProtocolError(
      "INVALID_PARAMS",
      `Missing or invalid param: ${key}`,
    );
  }
  return value.trim();
}

function optionalString(
  params: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
