import { interrupt } from "@langchain/langgraph";
import { getChangedFiles } from "../../integrations/git.js";
import {
  formatInterruptNotice,
  parseHumanMessage,
  type ReviewInterruptPayload,
} from "../../integrations/human-review.js";
import type { AgentStateType } from "../state.js";

function buildShipPayload(state: AgentStateType, files: string[]): ReviewInterruptPayload {
  const body = [
    `Ticket: ${state.jiraIssueKey}`,
    `Agent: ${state.agentId}`,
    `Thread: ${state.threadId}`,
    `Branch: ${state.branchName}`,
    `Repo: ${state.activeRepoPath}`,
    "",
    `Lint: ${state.lintResult?.ok ? "PASS" : "FAIL"}`,
    `Tests: ${state.testResult?.ok ? "PASS" : "FAIL"}`,
    state.e2eResult ? `E2E: ${state.e2eResult.ok ? "PASS" : "FAIL"}` : "",
    "",
    `Files changed (${files.length}):`,
    files.length ? files.map((f) => `- ${f}`).join("\n") : "(none)",
    "",
    `Commit subject: ${state.commitSubject || "(will be generated)"}`,
    "",
    "Reply ship to commit, push, and open a draft merge request.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    gate: "ship",
    title: "SHIP APPROVAL REQUIRED",
    body,
    threadId: state.threadId,
  };
}

export async function shipApproval(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const files = await getChangedFiles(state.activeRepoPath);
  const payload = buildShipPayload(state, files);
  const resumeValue = interrupt(payload);
  const decision = parseHumanMessage(String(resumeValue), "ship");

  if (decision.action === "approve") {
    return { shipApproved: true, shipFeedback: undefined };
  }

  if (decision.action === "reject") {
    return {
      shipApproved: false,
      status: "rejected",
      error: "Ship rejected by user",
    };
  }

  return {
    shipApproved: false,
    shipFeedback: decision.text,
    retryFeedback: `Before shipping, address this feedback:\n${decision.text}`,
    status: "running",
  };
}

export function printShipInterrupt(payload: ReviewInterruptPayload): void {
  console.log(formatInterruptNotice(payload));
}
