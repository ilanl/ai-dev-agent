import type { ReviewInterruptPayload } from "../integrations/human-review.js";
import type { RunMeta } from "../integrations/run-registry.js";
import type { RunStatusResult } from "../run-coordinator.js";

export type TicketPhase = "needs_you" | "running" | "done" | "idle";

export interface TicketSummary {
  threadId: string;
  agentId: string;
  issueKey: string;
  updatedAt: string;
  status?: "running" | "blocked" | "shipped" | "failed" | "rejected";
  phase: TicketPhase;
  awaiting?: ReviewInterruptPayload["gate"];
  next: string[];
  error?: string;
  branchName?: string;
  planPath?: string;
  activeRepoPath?: string;
  interrupt?: ReviewInterruptPayload;
  busy: boolean;
}

const DONE_STATUSES = new Set<TicketSummary["status"]>(["shipped", "rejected", "failed"]);

export function deriveTicketPhase(
  status: RunStatusResult,
  busy: boolean
): TicketPhase {
  if (status.awaiting) return "needs_you";
  if (busy || status.next.length > 0) return "running";
  if (status.status && DONE_STATUSES.has(status.status)) return "done";
  if (status.next.length === 0 && !status.status) return "idle";
  if (status.next.length === 0) return "done";
  return "idle";
}

const PHASE_ORDER: Record<TicketPhase, number> = {
  needs_you: 0,
  running: 1,
  idle: 2,
  done: 3,
};

export function mergeTicketSummary(
  meta: RunMeta,
  status: RunStatusResult,
  busy: boolean
): TicketSummary {
  const summary: TicketSummary = {
    threadId: meta.threadId,
    agentId: meta.agentId,
    issueKey: meta.issueKey,
    updatedAt: meta.updatedAt,
    phase: deriveTicketPhase(status, busy),
    next: status.next,
    busy,
  };

  if (status.status) summary.status = status.status;
  if (status.error) summary.error = status.error;
  if (status.branchName) summary.branchName = status.branchName;
  if (status.planPath) summary.planPath = status.planPath;
  if (status.activeRepoPath) summary.activeRepoPath = status.activeRepoPath;
  if (status.awaiting) summary.awaiting = status.awaiting;
  if (status.interrupt) summary.interrupt = status.interrupt;

  return summary;
}

export function sortTicketSummaries(summaries: TicketSummary[]): TicketSummary[] {
  return [...summaries].sort((a, b) => {
    const phaseDiff = PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase];
    if (phaseDiff !== 0) return phaseDiff;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
