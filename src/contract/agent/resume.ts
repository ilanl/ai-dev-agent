import type { ReviewGate } from "./review.js";

/** Structured respond API / daemon `ticket.respond` actions. */
export type RespondAction = "approve" | "reject" | "ship" | "comment";

/** Resume `-m` messages accepted by the agent runner. */
export const RESUME_MESSAGE = {
  IMPLEMENT: "implement",
  SHIP: "ship",
  REJECT: "reject",
  APPROVE: "approve",
} as const;

export type ResumeMessage =
  (typeof RESUME_MESSAGE)[keyof typeof RESUME_MESSAGE];

export const actionToMessage = (
  action: RespondAction,
  text: string | undefined,
  _gate: ReviewGate,
): string => {
  switch (action) {
    case "approve":
      return RESUME_MESSAGE.APPROVE;
    case "reject":
      return RESUME_MESSAGE.REJECT;
    case "ship":
      return RESUME_MESSAGE.SHIP;
    case "comment":
      if (!text?.trim()) {
        throw new Error("text is required for comment action");
      }
      return text.trim();
    default:
      throw new Error(`Unknown action: ${action satisfies never}`);
  }
};
