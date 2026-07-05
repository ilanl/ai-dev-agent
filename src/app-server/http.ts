import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import type { RespondAction } from "../integrations/respond.js";
import type { DashboardBridge } from "./bridge.js";
import type { DashboardEnv } from "../config/dashboard-env.js";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw) as unknown;
}

function parseTicketPath(pathname: string): { issueKey: string; action?: string } | null {
  const match = pathname.match(/^\/api\/tickets\/(AE-\d+)(?:\/([\w-]+))?$/i);
  if (!match?.[1]) return null;
  const issueKey = match[1].toUpperCase();
  const action = match[2];
  return action ? { issueKey, action } : { issueKey };
}

function isCoordinatorBusy(err: unknown): boolean {
  return err instanceof Error && err.message.includes("THREAD_BUSY");
}

export function createDashboardServer(
  bridge: DashboardBridge,
  env: DashboardEnv
): ReturnType<typeof createServer> {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const { pathname } = url;

    try {
      if (pathname === "/api/health" && req.method === "GET") {
        const health = await bridge.health();
        const status = health.agentd === "ok" ? 200 : 503;
        json(res, status, health);
        return;
      }

      if (pathname === "/api/agents" && req.method === "GET") {
        const data = await bridge.listAgents();
        json(res, 200, data);
        return;
      }

      if (pathname === "/api/agents" && req.method === "POST") {
        const body = (await readBody(req)) as { agentId?: string };
        if (!body.agentId?.trim()) {
          json(res, 400, { error: "agentId is required" });
          return;
        }
        await bridge.setAgentId(body.agentId.trim());
        json(res, 200, { agentId: bridge.getAgentId() });
        return;
      }

      if (pathname === "/api/tickets" && req.method === "GET") {
        const tickets = await bridge.listTickets();
        json(res, 200, { agentId: bridge.getAgentId(), tickets });
        return;
      }

      const ticketPath = parseTicketPath(pathname);
      if (ticketPath) {
        const { issueKey, action } = ticketPath;

        if (!action && req.method === "GET") {
          const ticket = await bridge.getTicket(issueKey);
          if (!ticket) {
            json(res, 404, { error: "Ticket not found" });
            return;
          }
          json(res, 200, ticket);
          return;
        }

        if (action === "start" && req.method === "POST") {
          const { result, ticket } = await bridge.startTicket(issueKey);
          json(res, 200, { ...result, ticket });
          return;
        }

        if (action === "resume" && req.method === "POST") {
          const body = (await readBody(req)) as { message?: string };
          if (!body.message?.trim()) {
            json(res, 400, { error: "message is required" });
            return;
          }
          const { result, ticket } = await bridge.resumeTicket(issueKey, body.message.trim());
          json(res, 200, { ...result, ticket });
          return;
        }

        if (action === "respond" && req.method === "POST") {
          const body = (await readBody(req)) as { action?: RespondAction; text?: string };
          const respondAction = body.action;
          if (!respondAction || !["approve", "reject", "ship", "comment"].includes(respondAction)) {
            json(res, 400, { error: "action must be approve, reject, ship, or comment" });
            return;
          }
          if (respondAction === "comment" && !body.text?.trim()) {
            json(res, 400, { error: "text is required for comment" });
            return;
          }
          const { result, ticket } = await bridge.respondTicket(
            issueKey,
            respondAction,
            body.text?.trim()
          );
          json(res, 200, { ...result, ticket });
          return;
        }

        if (action === "reset" && req.method === "POST") {
          const result = await bridge.resetTicket(issueKey);
          json(res, 200, result);
          return;
        }
      }

      if (req.method === "GET") {
        await serveStatic(res, env.staticDir, pathname === "/" ? "/index.html" : pathname);
        return;
      }

      json(res, 404, { error: "Not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = isCoordinatorBusy(err) ? 409 : 500;
      json(res, status, { error: message });
    }
  });
}

async function serveStatic(
  res: ServerResponse,
  staticDir: string,
  pathname: string
): Promise<void> {
  const safePath = pathname.split("?")[0] ?? "/index.html";
  const filePath = join(staticDir, safePath === "/" ? "index.html" : safePath);

  try {
    const content = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
    res.end(content);
  } catch {
    try {
      const fallback = await readFile(join(staticDir, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(fallback);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Dashboard UI not built. Run: npm run dashboard:build");
    }
  }
}
