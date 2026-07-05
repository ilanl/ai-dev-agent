import { interrupt } from "@langchain/langgraph";
import {
  parseHumanMessage,
  type ReviewInterruptPayload,
} from "../../integrations/human-review.js";
import type { AgentStateType } from "../state.js";

function buildPlanPayload(state: AgentStateType): ReviewInterruptPayload {
  const meta = [
    `Ticket: ${state.jiraIssueKey}`,
    state.jira?.jira.browseUrl ? `URL: ${state.jira.jira.browseUrl}` : "",
    `Scope: ${state.scope}`,
    `Repo: ${state.activeRepoPath}`,
    `Branch (after implement): ${state.branchName}`,
    state.cli.dryRun
      ? "DRY RUN: implement stops before branch creation and coding."
      : "",
  ].filter(Boolean);

  return {
    gate: "plan",
    title: "PLAN REVIEW",
    body: meta.join("\n"),
    plan: state.implementationPlan,
    ...(state.planPath ? { planPath: state.planPath } : {}),
    ...(state.openRisks.length ? { openRisks: state.openRisks } : {}),
    threadId: state.threadId,
  };
}

export async function planApproval(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const payload = buildPlanPayload(state);
  const resumeValue = interrupt(payload);
  const decision = parseHumanMessage(String(resumeValue), "plan");

  if (decision.action === "approve") {
    return { planApproved: true, planFeedback: undefined };
  }

  if (decision.action === "reject") {
    return {
      planApproved: false,
      status: "rejected",
      error: "Plan rejected by user",
    };
  }

  return {
    planApproved: false,
    planFeedback: decision.text,
    humanAnswers: [{ question: "Plan discussion", answer: decision.text }],
    status: "running",
  };
}
