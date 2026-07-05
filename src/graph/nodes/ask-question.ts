import { interrupt } from "@langchain/langgraph";
import { skipValidate } from "../../config/validate-env.js";
import {
  formatInterruptNotice,
  type ReviewInterruptPayload,
} from "../../integrations/human-review.js";
import type { AgentStateType } from "../state.js";

export async function askQuestion(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const question = state.error ?? "Codex is blocked. Please provide guidance.";
  const payload: ReviewInterruptPayload = {
    gate: "question",
    title: "CODEX BLOCKED",
    body: question,
    threadId: state.threadId,
  };

  const answer = String(interrupt(payload)).trim();

  return {
    humanAnswers: [{ question, answer }],
    status: "running",
    error: undefined,
  };
}

export function printQuestionInterrupt(payload: ReviewInterruptPayload): void {
  console.log(formatInterruptNotice(payload));
}

export function routeAfterCodex(state: AgentStateType): string {
  if (state.status === "blocked") {
    return "askQuestion";
  }
  if (skipValidate()) {
    return "skipValidate";
  }
  return "validate";
}

export function routeAfterAsk(state: AgentStateType): string {
  return state.planApproved ? "invokeCodex" : "codexPlan";
}
