import type { ResetResult, RunResult, RunStatusResult } from "../run-coordinator.js";
import { normalizeResetResult } from "../run-coordinator.js";
import type { RunMeta } from "../integrations/run-registry.js";
import type { ReviewInterruptPayload } from "../integrations/human-review.js";

const SLACK_TEXT_LIMIT = 3900;

export function splitSlackText(text: string, limit = SLACK_TEXT_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    chunks.push(rest.slice(0, limit));
    rest = rest.slice(limit);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function formatPlanForSlack(payload: ReviewInterruptPayload): string[] {
  const parts = [
    `*${payload.title}*`,
    payload.body,
    "",
  ];

  if (payload.plan?.trim()) {
    parts.push("*Plan*", "```", payload.plan.trim(), "```", "");
  } else if (payload.planPath) {
    parts.push(`_Plan file:_ \`${payload.planPath}\``, "");
  }

  if (payload.openRisks?.length) {
    parts.push("*Open risks*", ...payload.openRisks.map((r) => `• ${r}`), "");
  }

  parts.push(
    "_Discuss in this thread — I'll revise the plan on feedback._",
    "_Reply `implement` when ready to code._"
  );

  return splitSlackText(parts.join("\n"));
}

export function formatInterruptForSlack(payload: ReviewInterruptPayload): string[] {
  if (payload.gate === "plan") return formatPlanForSlack(payload);

  const text = [
    `*${payload.title}*`,
    payload.body,
    "",
    payload.gate === "ship"
      ? "_Reply `ship` to commit and open MR._"
      : "_Reply in thread to continue._",
  ].join("\n");

  return splitSlackText(text);
}

export function formatRunResult(result: RunResult): string[] {
  if (result.interrupted && result.interrupt) {
    return formatInterruptForSlack(result.interrupt);
  }
  if (result.phase === "failed" || result.status === "failed") {
    return splitSlackText(
      [`*Run failed* — \`${result.threadId}\``, result.error ?? result.status].join("\n")
    );
  }
  return splitSlackText(
    [`*Run ${result.status}* — \`${result.threadId}\``, result.error].filter(Boolean).join("\n")
  );
}

export function formatStatusForSlack(status: RunStatusResult): string[] {
  const lines = [
    `*Status* — \`${status.threadId}\``,
    status.status ? `State: \`${status.status}\`` : "",
    status.error ? `Error: ${status.error}` : "",
    `Next: ${status.next.join(", ") || "(finished)"}`,
    status.awaiting ? `Awaiting: *${status.awaiting}*` : "",
  ].filter(Boolean);

  if (status.interrupt) {
    return [...splitSlackText(lines.join("\n")), ...formatInterruptForSlack(status.interrupt)];
  }

  return splitSlackText(lines.join("\n"));
}

export function formatResetForSlack(result: ResetResult): string {
  const r = normalizeResetResult(result);
  const lines = [
    `*Reset* \`${r.threadId}\``,
    `checkpoint: ${r.checkpointDeleted ? "deleted" : "none"}`,
    `meta: ${r.metaDeleted ? "deleted" : "none"}`,
    `artifacts: ${r.artifactsDeleted ? "deleted" : "none"}`,
    `worktrees removed: ${r.worktreesRemoved}`,
    `branches deleted: ${r.branchesDeleted}`,
  ];
  if (r.gitCleanupErrors.length) {
    lines.push(`git cleanup: ${r.gitCleanupErrors.join("; ")}`);
  }
  return lines.join("\n");
}

export function formatListForSlack(runs: RunMeta[]): string {
  if (!runs.length) return "_No saved runs._";
  return runs.map((r) => `• \`${r.threadId}\` — ${r.issueKey} (${r.updatedAt})`).join("\n");
}
