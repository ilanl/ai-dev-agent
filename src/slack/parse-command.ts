export type SlackCommand =
  | { type: "start"; issueKey: string }
  | { type: "status"; issueKey?: string }
  | { type: "reset"; issueKey: string }
  | { type: "list" }
  | { type: "help" }
  | { type: "message"; text: string };

const ISSUE_KEY = /\b(AE-\d+)\b/i;

export function stripBotMention(text: string): string {
  return text.replace(/<@[^>]+>/g, "").trim();
}

export function parseSlackText(text: string): SlackCommand {
  const trimmed = stripBotMention(text).trim();
  if (!trimmed) return { type: "help" };

  if (/^help$/i.test(trimmed)) return { type: "help" };
  if (/^list$/i.test(trimmed)) return { type: "list" };

  const resetMatch = trimmed.match(/^reset\s+(AE-\d+)\b/i);
  if (resetMatch?.[1]) return { type: "reset", issueKey: resetMatch[1].toUpperCase() };

  const statusOnly = trimmed.match(/^status$/i);
  if (statusOnly) return { type: "status" };

  const statusMatch = trimmed.match(/^status\s+(AE-\d+)\b/i);
  if (statusMatch?.[1]) return { type: "status", issueKey: statusMatch[1].toUpperCase() };

  const startMatch = trimmed.match(/^(?:start\s+)?(AE-\d+)\b$/i);
  if (startMatch?.[1]) return { type: "start", issueKey: startMatch[1].toUpperCase() };

  const inlineKey = trimmed.match(ISSUE_KEY);
  if (inlineKey?.[1] && trimmed.toLowerCase().startsWith("start")) {
    return { type: "start", issueKey: inlineKey[1].toUpperCase() };
  }

  return { type: "message", text: trimmed };
}

export function helpText(): string {
  return [
    "*AI Dev Agent*",
    "",
    "• `AE-1234` or `start AE-1234` — start a ticket run",
    "• Reply in the thread with feedback, or `implement` to code",
    "• `status` — status for this thread (or `status AE-1234`)",
    "• `reset AE-1234` — clear checkpoint and artifacts",
    "• `list` — list saved runs",
    "• `ship` — commit, push, and open draft MR (after implement)",
  ].join("\n");
}
