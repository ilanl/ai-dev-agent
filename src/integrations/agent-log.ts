import { format } from "node:util";
import type { RunStatusResult } from "../run-coordinator.js";
import { publishAgentLog, type AgentLogLine } from "./agent-log-bus.js";

const PREFIX = "[agentd]";

export type AgentLogLevel = "off" | "info" | "debug";

let level: AgentLogLevel = resolveLogLevel();

const origLog = console.log.bind(console);
const origError = console.error.bind(console);
const origWarn = console.warn.bind(console);

let consolePatched = false;

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

function formatConsoleArgs(args: unknown[]): string {
  if (!args.length) return "";
  return format(...args);
}

function publishLine(event: string, logLevel: AgentLogLine["level"], message: string): void {
  if (level === "off" || !message) return;
  publishAgentLog({
    ts: new Date().toISOString(),
    level: logLevel,
    event,
    message,
  });
}

function publishConsole(event: string, logLevel: AgentLogLine["level"], args: unknown[]): void {
  const message = formatConsoleArgs(args);
  if (!message) return;
  publishLine(event, logLevel, message);
}

function write(event: string, fields: Record<string, unknown>, minLevel: AgentLogLevel): void {
  if (level === "off") return;
  if (minLevel === "debug" && level !== "debug") return;
  const message = `${PREFIX} ${event} ${fmt(fields)}`;
  origLog(message);
  publishLine(event, minLevel === "debug" ? "debug" : "info", message);
}

export function patchConsoleForAgentLog(): void {
  if (consolePatched) return;
  consolePatched = true;

  console.log = (...args: unknown[]) => {
    origLog(...args);
    publishConsole("console.log", "info", args);
  };

  console.error = (...args: unknown[]) => {
    origError(...args);
    publishConsole("console.error", "info", args);
  };

  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    publishConsole("console.warn", "info", args);
  };
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
