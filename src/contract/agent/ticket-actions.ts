import type { TicketDetail } from "../http/tickets.types.js";
import { RESUME_MESSAGE } from "./resume.js";

export type TicketActionKind = "resume" | "start" | "reset";

export type TicketDetailAction = {
  id: string;
  label: string;
  kind: TicketActionKind;
  message?: string;
  variant?: "default" | "destructive" | "outline" | "secondary";
};

export const getTicketDetailActions = (
  ticket: TicketDetail,
): TicketDetailAction[] => {
  if (ticket.awaiting && ticket.interrupt) {
    switch (ticket.awaiting) {
      case "plan":
        return [
          {
            id: "implement",
            label: "Implement",
            kind: "resume",
            message: RESUME_MESSAGE.IMPLEMENT,
          },
          {
            id: "reject",
            label: "Reject",
            kind: "resume",
            message: RESUME_MESSAGE.REJECT,
            variant: "destructive",
          },
        ];
      case "ship":
        return [
          {
            id: "ship",
            label: "Ship",
            kind: "resume",
            message: RESUME_MESSAGE.SHIP,
          },
          {
            id: "reject",
            label: "Reject",
            kind: "resume",
            message: RESUME_MESSAGE.REJECT,
            variant: "destructive",
          },
        ];
      case "question":
        return [
          {
            id: "approve",
            label: "Approve",
            kind: "resume",
            message: RESUME_MESSAGE.APPROVE,
          },
          {
            id: "reject",
            label: "Reject",
            kind: "resume",
            message: RESUME_MESSAGE.REJECT,
            variant: "destructive",
          },
        ];
    }
  }

  if (!ticket.status) {
    return [{ id: "start", label: "Start", kind: "start" }];
  }

  if (
    ticket.status === "failed" ||
    ticket.status === "rejected" ||
    ticket.status === "shipped"
  ) {
    const actions: TicketDetailAction[] = [
      { id: "reset", label: "Reset", kind: "reset", variant: "outline" },
    ];
    if (ticket.status === "failed") {
      actions.push({ id: "start", label: "Start", kind: "start" });
    }
    return actions;
  }

  return [];
};
