import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import {
  respondTicketBodySchema,
  resumeTicketBodySchema,
  startTicketBodySchema,
} from "../contract/http/tickets.schemas.js";
import {
  API_ROUTES,
  type TicketDetail,
  type TicketListItem,
} from "../contract/index.js";
import { defaultAgentId } from "../config/cli-args.js";
import { actionToMessage } from "../integrations/respond.js";
import { buildThreadId } from "../integrations/run-registry.js";
import { getJira } from "../integrations/ticket-solver.js";
import {
  CoordinatorError,
  getRunCoordinator,
  type RunResult,
  type RunStatusResult,
} from "../run-coordinator.js";
import type { RunMeta } from "../integrations/run-registry.js";

const DEFAULT_PORT = 9478;

const resolveCorsOrigin = (origin: string | undefined): string => {
  const configured = process.env.AGENT_HTTP_CORS?.trim();
  if (configured) return configured;
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin;
  }
  return "http://localhost:5173";
};

const sendJson = (
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  body: unknown,
): void => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": resolveCorsOrigin(req.headers.origin),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(status === 204 ? "" : JSON.stringify(body));
};

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
};

const resolveAgentId = (value: string | undefined): string =>
  value?.trim() || defaultAgentId();

const toListItem = (meta: RunMeta, status: RunStatusResult): TicketListItem => {
  const item: TicketListItem = { ...meta };
  if (status.status) item.status = status.status;
  if (status.scope) item.scope = status.scope;
  if (status.awaiting) item.awaiting = status.awaiting;
  if (status.branchName) item.branchName = status.branchName;
  if (status.summary) item.summary = status.summary;
  if (status.browseUrl !== undefined) item.browseUrl = status.browseUrl;
  return item;
};

const buildDetail = async (
  meta: RunMeta,
  status: RunStatusResult,
): Promise<TicketDetail> => {
  let summary = status.summary ?? "";
  let descriptionPlain = "";
  let browseUrl = status.browseUrl ?? null;
  let suggestedBranch: string | undefined;
  let comments: TicketDetail["comments"] = [];

  try {
    const jira = await getJira(meta.issueKey);
    summary = summary || jira.summary;
    descriptionPlain = jira.descriptionPlain;
    browseUrl = jira.jira.browseUrl;
    suggestedBranch = jira.suggestedBranch;
    comments = jira.jira.comments;
  } catch {
    summary = summary || meta.issueKey;
  }

  return {
    threadId: meta.threadId,
    issueKey: meta.issueKey,
    agentId: meta.agentId,
    summary,
    descriptionPlain,
    updatedAt: meta.updatedAt,
    comments,
    browseUrl,
    ...(suggestedBranch ? { suggestedBranch } : {}),
    ...(status.status ? { status: status.status } : {}),
    ...((status.scope ?? meta.scope)
      ? { scope: (status.scope ?? meta.scope)! }
      : {}),
    ...(status.branchName ? { branchName: status.branchName } : {}),
    ...(status.activeRepoPath ? { activeRepoPath: status.activeRepoPath } : {}),
    ...(status.awaiting ? { awaiting: status.awaiting } : {}),
    ...(status.interrupt ? { interrupt: status.interrupt } : {}),
    ...(status.error ? { error: status.error } : {}),
    ...(status.planPath ? { planPath: status.planPath } : {}),
  };
};

const toRunResultDto = (result: RunResult) => ({
  threadId: result.threadId,
  phase: result.phase,
  status: result.status,
  interrupted: result.interrupted,
  ...(result.error ? { error: result.error } : {}),
});

const handleList = async (
  req: IncomingMessage,
  res: ServerResponse,
  agentId: string,
): Promise<void> => {
  const coordinator = getRunCoordinator();
  const metas = await coordinator.list(agentId);

  const items = await Promise.all(
    metas.map(async (meta) => {
      const status = await coordinator.status(meta.threadId);
      return toListItem(meta, status);
    }),
  );

  sendJson(req, res, 200, items);
};

const handleDetail = async (
  req: IncomingMessage,
  res: ServerResponse,
  issueKey: string,
  agentId: string,
): Promise<void> => {
  const threadId = buildThreadId(agentId, issueKey);
  const coordinator = getRunCoordinator();
  const metas = await coordinator.list(agentId);
  const meta = metas.find((m) => m.threadId === threadId);

  if (!meta) {
    try {
      const jira = await getJira(issueKey);
      sendJson(req, res, 200, {
        threadId,
        issueKey: issueKey.toUpperCase(),
        agentId,
        summary: jira.summary,
        descriptionPlain: jira.descriptionPlain,
        updatedAt: new Date().toISOString(),
        comments: jira.jira.comments,
        browseUrl: jira.jira.browseUrl,
        suggestedBranch: jira.suggestedBranch,
      } satisfies TicketDetail);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(req, res, 404, { error: message });
      return;
    }
  }

  const status = await coordinator.status(threadId);
  const detail = await buildDetail(meta, status);
  sendJson(req, res, 200, detail);
};

const handleStart = async (
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
): Promise<void> => {
  const parsed = startTicketBodySchema.safeParse(body);
  if (!parsed.success) {
    sendJson(req, res, 400, { error: parsed.error.message });
    return;
  }

  const agentId = resolveAgentId(parsed.data.agentId);
  const coordinator = getRunCoordinator();

  try {
    const result = await coordinator.start({
      issueKey: parsed.data.issueKey.toUpperCase(),
      agentId,
    });
    sendJson(req, res, 200, toRunResultDto(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof CoordinatorError ? err.code : "START_FAILED";
    sendJson(req, res, code === "THREAD_EXISTS" ? 409 : 500, { error: message, code });
  }
};

const handleRespond = async (
  req: IncomingMessage,
  res: ServerResponse,
  issueKey: string,
  body: unknown,
  agentId: string,
): Promise<void> => {
  const parsed = respondTicketBodySchema.safeParse(body);
  if (!parsed.success) {
    sendJson(req, res, 400, { error: parsed.error.message });
    return;
  }

  const threadId = buildThreadId(agentId, issueKey);
  const coordinator = getRunCoordinator();
  const current = await coordinator.status(threadId);
  const gate = current.awaiting ?? "plan";
  const message = actionToMessage(parsed.data.action, parsed.data.text, gate);

  try {
    const result = await coordinator.resume({ threadId, message });
    sendJson(req, res, 200, toRunResultDto(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(req, res, 500, { error: message });
  }
};

const handleResume = async (
  req: IncomingMessage,
  res: ServerResponse,
  issueKey: string,
  body: unknown,
  agentId: string,
): Promise<void> => {
  const parsed = resumeTicketBodySchema.safeParse(body);
  if (!parsed.success) {
    sendJson(req, res, 400, { error: parsed.error.message });
    return;
  }

  const threadId = buildThreadId(agentId, issueKey);
  const coordinator = getRunCoordinator();

  try {
    const result = await coordinator.resume({
      threadId,
      message: parsed.data.message,
    });
    sendJson(req, res, 200, toRunResultDto(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(req, res, 500, { error: message });
  }
};

const handleReset = async (
  req: IncomingMessage,
  res: ServerResponse,
  issueKey: string,
  agentId: string,
): Promise<void> => {
  const threadId = buildThreadId(agentId, issueKey);
  const coordinator = getRunCoordinator();

  try {
    const result = await coordinator.reset(threadId);
    sendJson(req, res, 200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(req, res, 500, { error: message });
  }
};

const route = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  if (req.method === "OPTIONS") {
    sendJson(req, res, 204, null);
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const agentId = resolveAgentId(url.searchParams.get("agentId") ?? undefined);

  if (req.method === "GET" && url.pathname === API_ROUTES.tickets) {
    await handleList(req, res, agentId);
    return;
  }

  const ticketMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)$/);
  if (ticketMatch) {
    const issueKey = decodeURIComponent(ticketMatch[1] ?? "");
    if (req.method === "GET") {
      await handleDetail(req, res, issueKey, agentId);
      return;
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      await handleStart(req, res, { ...(body as object), issueKey });
      return;
    }
  }

  const respondMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/respond$/);
  if (respondMatch && req.method === "POST") {
    const issueKey = decodeURIComponent(respondMatch[1] ?? "");
    const body = await readBody(req);
    await handleRespond(req, res, issueKey, body, agentId);
    return;
  }

  const resumeMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/resume$/);
  if (resumeMatch && req.method === "POST") {
    const issueKey = decodeURIComponent(resumeMatch[1] ?? "");
    const body = await readBody(req);
    await handleResume(req, res, issueKey, body, agentId);
    return;
  }

  const resetMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/reset$/);
  if (resetMatch && req.method === "POST") {
    const issueKey = decodeURIComponent(resetMatch[1] ?? "");
    await handleReset(req, res, issueKey, agentId);
    return;
  }

  if (req.method === "POST" && url.pathname === API_ROUTES.tickets) {
    const body = await readBody(req);
    await handleStart(req, res, body);
    return;
  }

  sendJson(req, res, 404, { error: "Not found" });
};

export const startHttpServer = (port = Number(process.env.AGENT_HTTP_PORT ?? DEFAULT_PORT)) => {
  const server = createServer((req, res) => {
    route(req, res).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(req, res, 500, { error: message });
    });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`http api listening on http://127.0.0.1:${port}`);
  });

  return server;
};
