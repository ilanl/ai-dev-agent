import { connect, type Socket } from "node:net";
import { loadServerEnv, resolveSocketPath } from "../config/server-env.js";
import {
  CLIENT_MESSAGE_TYPE,
  SERVER_MESSAGE_TYPE,
  type EventMessage,
  type ResponseMessage,
  type WelcomeMessage,
} from "../server/protocol.js";

export interface RpcResult<T = unknown> {
  ok: boolean;
  result?: T;
  error?: { code: string; message: string };
  events: EventMessage[];
}

export class AgentSocketClient {
  private socket: Socket | null = null;
  private buffer = "";
  private pending = new Map<
    string,
    {
      resolve: (value: RpcResult) => void;
      reject: (err: Error) => void;
      events: EventMessage[];
      onEvent?: (event: EventMessage) => void;
    }
  >();
  private nextId = 1;
  private welcome: WelcomeMessage | null = null;

  async connect(socketPath?: string): Promise<boolean> {
    const path = resolveSocketPath(socketPath ?? loadServerEnv().socketPath);
    return new Promise((resolve) => {
      const socket = connect(path);
      const onFail = () => {
        socket.destroy();
        resolve(false);
      };
      socket.setTimeout(2000, onFail);
      socket.once("error", onFail);
      socket.once("connect", () => {
        socket.setTimeout(0);
        this.socket = socket;
        this.socket.setEncoding("utf8");
        this.socket.on("data", (chunk) => this.onData(String(chunk)));
        this.socket.on("error", () => this.socket?.destroy());
        this.socket.on("close", () => {
          this.socket = null;
        });
        resolve(true);
      });
    });
  }

  async hello(options?: { client?: string; agentId?: string }): Promise<WelcomeMessage> {
    await this.write({
      type: CLIENT_MESSAGE_TYPE.HELLO,
      version: 1,
      ...(options?.client !== undefined ? { client: options.client } : {}),
      ...(options?.agentId !== undefined ? { agentId: options.agentId } : {}),
    });
    const welcome = await this.waitForWelcome();
    this.welcome = welcome;
    return welcome;
  }

  async request<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    onEvent?: (event: EventMessage) => void
  ): Promise<RpcResult<T>> {
    if (!this.socket) {
      throw new Error("Not connected");
    }

    const id = String(this.nextId++);
    const payload = {
      type: CLIENT_MESSAGE_TYPE.REQ,
      id,
      method,
      params: params ?? {},
    };

    return new Promise<RpcResult<T>>((resolve, reject) => {
      const entry = {
        resolve: (value: RpcResult) => resolve(value as RpcResult<T>),
        reject,
        events: [] as EventMessage[],
        ...(onEvent ? { onEvent } : {}),
      };
      this.pending.set(id, entry);
      this.socket!.write(`${JSON.stringify(payload)}\n`);
    });
  }

  disconnect(): void {
    this.socket?.destroy();
    this.socket = null;
  }

  getWelcome(): WelcomeMessage | null {
    return this.welcome;
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      this.dispatch(JSON.parse(line) as ResponseMessage | EventMessage | WelcomeMessage);
    }
  }

  private dispatch(message: ResponseMessage | EventMessage | WelcomeMessage): void {
    if (message.type === SERVER_MESSAGE_TYPE.WELCOME) {
      this.welcome = message;
      return;
    }

    if (message.type === SERVER_MESSAGE_TYPE.EVENT) {
      for (const [, pending] of this.pending) {
        pending.events.push(message);
        pending.onEvent?.(message);
      }
      return;
    }

    if (message.type === SERVER_MESSAGE_TYPE.RES) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      pending.resolve({
        ok: message.ok,
        result: message.result,
        events: pending.events,
        ...(message.error ? { error: message.error } : {}),
      });
    }
  }

  private write(message: Record<string, unknown>): Promise<void> {
    if (!this.socket) throw new Error("Not connected");
    this.socket.write(`${JSON.stringify(message)}\n`);
    return new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }

  private waitForWelcome(timeoutMs = 3000): Promise<WelcomeMessage> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        if (this.welcome) {
          resolve(this.welcome);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for welcome"));
          return;
        }
        setTimeout(tick, 20);
      };
      tick();
    });
  }
}

export async function tryConnectClient(agentId?: string): Promise<AgentSocketClient | null> {
  const client = new AgentSocketClient();
  const ok = await client.connect();
  if (!ok) return null;
  await client.hello({ client: "cli", ...(agentId !== undefined ? { agentId } : {}) });
  return client;
}
