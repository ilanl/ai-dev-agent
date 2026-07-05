import type { AgentStatus } from "@/api/types";

export type StatusTab = "all" | AgentStatus;

export const STATUS_TABS: Array<{ key: StatusTab; label: string }> = [
  { key: "all", label: "All active tickets" },
  { key: "running", label: "Running" },
  { key: "blocked", label: "Blocked" },
  { key: "failed", label: "Failed" },
  { key: "shipped", label: "Shipped" },
];

export const STATUS_LABEL: Record<AgentStatus, string> = {
  running: "Running",
  blocked: "Blocked",
  failed: "Failed",
  shipped: "Shipped",
  rejected: "Rejected",
};

export const statusBadgeClass: Record<AgentStatus, string> = {
  running: "bg-primary/10 text-primary",
  blocked: "bg-secondary text-secondary-foreground",
  failed: "bg-destructive/10 text-destructive",
  shipped: "bg-muted text-muted-foreground",
  rejected: "bg-muted text-muted-foreground",
};
