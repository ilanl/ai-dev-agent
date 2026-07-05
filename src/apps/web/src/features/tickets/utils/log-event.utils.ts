import type { AgentLogLine } from "@contract";

export type LogEventCategory = "node" | "http" | "run" | "request" | "system";

const CATEGORY_LABELS: Record<LogEventCategory, string> = {
  node: "Node",
  http: "HTTP",
  run: "Run",
  request: "Request",
  system: "System",
};

export const LOG_EVENT_CATEGORIES: LogEventCategory[] = [
  "node",
  "http",
  "run",
  "request",
  "system",
];

export const getLogEventCategory = (event: string): LogEventCategory => {
  if (event.startsWith("node.")) return "node";
  if (event.startsWith("http.")) return "http";
  if (event.startsWith("run.")) return "run";
  if (event.startsWith("console.")) return "system";
  if (
    event.startsWith("req.") ||
    event.startsWith("client.") ||
    event === "status"
  ) {
    return "request";
  }
  return "system";
};

export const getLogEventCategoryLabel = (category: LogEventCategory): string =>
  CATEGORY_LABELS[category];

export const getLogEventSummary = (line: AgentLogLine): string => {
  const category = getLogEventCategory(line.event);
  const fields = parseLogFields(line.message);

  if (category === "node") {
    const node = line.event.replace(/^node\./, "");
    const phase = fields.phase ?? "";
    const issueKey = fields.issueKey;
    const status = fields.status;
    const parts = [node, phase, issueKey, status].filter(Boolean);
    return parts.join(" · ") || line.event;
  }

  if (fields.issueKey) return String(fields.issueKey);
  if (fields.threadId) return String(fields.threadId);
  if (fields.method) return `${fields.method} ${fields.path ?? ""}`.trim();

  return line.event;
};

export const parseLogFields = (message: string): Record<string, string> => {
  const body = message.replace(/^\[agentd\]\s+\S+\s*/, "");
  const fields: Record<string, string> = {};
  const pattern = /(\w+)=("([^"]*)"|(\S+))/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const key = match[1];
    if (!key) continue;
    fields[key] = match[3] ?? match[4] ?? "";
  }

  return fields;
};

export const toLogEventDetail = (line: AgentLogLine) => ({
  ts: line.ts,
  level: line.level,
  event: line.event,
  category: getLogEventCategory(line.event),
  fields: parseLogFields(line.message),
  message: line.message,
});

export const formatElapsed = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `0:${String(seconds).padStart(2, "0")}`;
};

export const formatEventOffset = (eventTs: string, originTs: number): string => {
  const delta = new Date(eventTs).getTime() - originTs;
  return formatElapsed(delta);
};
