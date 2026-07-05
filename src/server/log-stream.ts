import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getAgentLogBuffer,
  subscribeAgentLog,
  type AgentLogLine,
} from "../integrations/agent-log-bus.js";

const resolveCorsOrigin = (origin: string | undefined): string => {
  const configured = process.env.AGENT_HTTP_CORS?.trim();
  if (configured) return configured;
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin;
  }
  return "http://localhost:5173";
};

const writeSse = (res: ServerResponse, line: AgentLogLine): void => {
  res.write(`data: ${JSON.stringify(line)}\n\n`);
};

export const handleLogsStream = (req: IncomingMessage, res: ServerResponse): void => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": resolveCorsOrigin(req.headers.origin),
  });

  for (const line of getAgentLogBuffer()) {
    writeSse(res, line);
  }

  const unsubscribe = subscribeAgentLog((line) => writeSse(res, line));

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
};
