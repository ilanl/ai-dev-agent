import type { TicketSummary } from "./types";

export function formatBusyMessage(ticket: TicketSummary): string {
  const next = ticket.next.join(" ");
  if (next.includes("prepareWorktree") || next.includes("invokeCodex")) {
    return "Implementing approved plan — this may take several minutes.";
  }
  if (next.includes("validate") || next.includes("buildRetryFeedback")) {
    return "Running lint and tests…";
  }
  if (next.includes("ship")) {
    return "Creating branch and opening MR…";
  }
  if (next.includes("codexPlan")) {
    return "Revising the plan…";
  }
  return "Agent is working — this may take a few minutes.";
}

export function formatTicketStatus(ticket: TicketSummary): string {
  if (ticket.busy) return formatBusyMessage(ticket);
  if (ticket.awaiting === "plan") return "Waiting for plan approval";
  if (ticket.awaiting === "ship") return "Waiting for ship approval";
  if (ticket.awaiting === "question") return "Waiting for your answer";
  if (ticket.phase === "running") return "Run in progress";
  if (ticket.status === "shipped") return "Shipped — review the MR in GitLab";
  if (ticket.status === "rejected") return "Rejected";
  if (ticket.status === "failed") {
    return ticket.error ? `Failed — ${ticket.error}` : "Failed — see error below";
  }
  if (ticket.phase === "idle") return "Idle — start or reset to continue";
  if (ticket.phase === "done") return "Done";
  return "No action needed";
}

export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409 && err.message.includes("THREAD_BUSY")) {
      return "This ticket is still running. Wait for the current step to finish.";
    }
    if (err.status === 409) {
      return "This ticket is busy. Wait for the current step to finish.";
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}
