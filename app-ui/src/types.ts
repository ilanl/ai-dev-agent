export type TicketPhase = "needs_you" | "running" | "done" | "idle";

export interface ReviewInterrupt {
  gate: "plan" | "ship" | "question";
  title: string;
  body: string;
  plan?: string;
  planPath?: string;
  openRisks?: string[];
}

export interface TicketSummary {
  threadId: string;
  agentId: string;
  issueKey: string;
  updatedAt: string;
  status?: "running" | "blocked" | "shipped" | "failed" | "rejected";
  phase: TicketPhase;
  awaiting?: "plan" | "ship" | "question";
  next: string[];
  error?: string;
  branchName?: string;
  planPath?: string;
  activeRepoPath?: string;
  interrupt?: ReviewInterrupt;
  busy: boolean;
}

export interface AgentRecord {
  agentId: string;
  label?: string;
  registeredAt: string;
}
