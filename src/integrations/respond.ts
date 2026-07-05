export type RespondAction = "approve" | "reject" | "ship" | "comment";

import type { ReviewGate } from "./human-review.js";

export function actionToMessage(
  action: RespondAction,
  text: string | undefined,
  gate: ReviewGate
): string {
  switch (action) {
    case "approve":
      // Plan gate only accepts "implement" as approval (see parseHumanMessage).
      return gate === "plan" ? "implement" : "approve";
    case "reject":
      return "reject";
    case "ship":
      return "ship";
    case "comment":
      if (!text?.trim()) {
        throw new Error("text is required for comment action");
      }
      return text.trim();
    default:
      throw new Error(`Unknown action: ${action satisfies never}`);
  }
}
