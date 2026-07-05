import type { RunStatusResult } from "../run-coordinator.js";

const PREFIX = "[agentd]";

export type AgentLogLevel = "off" | "info" | "debug";

let level: AgentLogLevel = resolveLogLevel();

function resolveLogLevel(): AgentLogLevel {
  const raw = process.env.AGENT_LOG_LEVEL?.trim().toLowerCase();
  if (raw === "off" || raw === "0" || raw === "false") return "off";
  if (raw === "debug") return "debug";
  return "info";
}

function fmt(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v) : String(v)}`)
    .join(" ");
}

function write(event: string, fields: Record<string, unknown>, minLevel: AgentLogLevel): void {
  if (level === "off") return;
  if (minLevel === "debug" && level !== "debug") return;
  console.log(`${PREFIX} ${event} ${fmt(fields)}`);
}

export function logAgentInfo(event: string, fields: Record<string, unknown> = {}): void {
  write(event, fields, "info");
}

export function logAgentDebug(event: string, fields: Record<string, unknown> = {}): void {
  write(event, fields, "debug");
}

export function formatStatusFields(status: RunStatusResult): Record<string, unknown> {
  return {
    threadId: status.threadId,
    ...(status.agentId ? { agentId: status.agentId } : {}),
    ...(status.issueKey ? { issueKey: status.issueKey } : {}),
    ...(status.status ? { status: status.status } : {}),
    ...(status.next.length ? { next: status.next.join(",") } : { next: "(finished)" }),
    ...(status.awaiting ? { awaiting: status.awaiting } : {}),
    ...(status.error ? { error: trunc(status.error) } : {}),
    ...(status.planPath ? { planPath: status.planPath } : {}),
    ...(status.branchName ? { branch: status.branchName } : {}),
  };
}

export function extractThreadFields(
  params: Record<string, unknown>
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const threadId = optionalString(params, "threadId");
  const issueKey = optionalString(params, "issueKey");
  const agentId = optionalString(params, "agentId");
  if (threadId) fields.threadId = threadId;
  if (issueKey) fields.issueKey = issueKey.toUpperCase();
  if (agentId) fields.agentId = agentId;
  return fields;
}

function optionalString(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function trunc(text: string, max = 200): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}…`;
}

export function logNodeStart(
  node: string,
  fields: Record<string, unknown> = {}
): void {
  logAgentInfo(`node.${node}`, { phase: "start", ...fields });
}

export function logNodeDone(
  node: string,
  fields: Record<string, unknown> = {}
): void {
  logAgentInfo(`node.${node}`, { phase: "done", ...fields });
}
