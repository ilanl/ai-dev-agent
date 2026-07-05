import type { ReviewGate, ReviewInterruptPayload } from "../contract/agent/review.js";

export type { ReviewGate, ReviewInterruptPayload };

export type HumanDecision =
  | { action: "approve" }
  | { action: "reject" }
  | { action: "comment"; text: string };

const APPROVE = new Set(["y", "yes", "approve", "approved", "ok", "lgtm"]);
const REJECT = new Set(["n", "no", "reject", "rejected", "cancel", "stop"]);

export function parseHumanMessage(message: string, gate: ReviewGate): HumanDecision {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) return { action: "reject" };
  if (gate === "plan" && lower === "implement") return { action: "approve" };
  if (gate === "ship" && (lower === "ship" || lower === "ship it")) return { action: "approve" };
  // Plan gate: only "implement" approves. Ship gate: only "ship" / "ship it" approves.
  if (gate === "question" && APPROVE.has(lower)) return { action: "approve" };
  if (REJECT.has(lower)) return { action: "reject" };

  return { action: "comment", text: trimmed };
}

export function formatPlanReview(payload: ReviewInterruptPayload): string {
  const lines = [
    `\n=== ${payload.title} ===\n`,
    payload.body,
    "",
  ];

  if (payload.plan?.trim()) {
    lines.push("--- Plan ---", "", payload.plan.trim(), "");
  } else if (payload.planPath) {
    lines.push(`(Plan file: ${payload.planPath})`, "");
  }

  if (payload.openRisks?.length) {
    lines.push("Open risks:", ...payload.openRisks.map((r) => `- ${r}`), "");
  }

  const hints = payload.hints ?? defaultHints("plan");
  lines.push(
    "Discuss the plan — reply with feedback and the plan will be revised.",
    'When ready, reply: implement',
    "",
    "Or resume non-interactively:",
    ...hints.map((h) => `  ${h}`),
    ""
  );
  return lines.join("\n");
}

export function formatInterruptNotice(payload: ReviewInterruptPayload): string {
  if (payload.gate === "plan") {
    return formatPlanReview(payload);
  }

  const hints = payload.hints ?? defaultHints(payload.gate);
  const lines = [
    `\n=== ${payload.title} ===\n`,
    payload.body,
    "",
    "Waiting for your input. Resume with:",
    ...hints.map((h) => `  ${h}`),
    "",
  ];
  return lines.join("\n");
}

function defaultHints(gate: ReviewGate): string[] {
  const base = 'pnpm run agent -- <AE-KEY> resume -m "<message>"';
  if (gate === "plan") {
    return [
      `${base}`,
      '  implement — approve plan and start coding',
      '  reject — stop the run',
      '  any other text — feedback; Codex revises the plan',
    ];
  }
  if (gate === "ship") {
    return [
      `${base}`,
      '  ship — commit, push, and open draft MR',
      '  reject — stop without shipping',
      '  any other text — feedback; Codex will fix before shipping',
    ];
  }
  return [`${base}`, "  type your answer to unblock Codex"];
}
