import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import { END, START, StateGraph } from "@langchain/langgraph";
import { routeAfterCodex, askQuestion, routeAfterAsk } from "./nodes/ask-question.js";
import { codexPlan, routeAfterCodexPlan } from "./nodes/codex-plan.js";
import { dryRunComplete } from "./nodes/dry-run-complete.js";
import { fetchJira } from "./nodes/fetch-jira.js";
import { fetchLogs } from "./nodes/fetch-logs.js";
import { invokeCodex } from "./nodes/invoke-codex.js";
import { planApproval } from "./nodes/plan-approval.js";
import { prepareWorktree } from "./nodes/prepare-worktree.js";
import { resolveRepo } from "./nodes/resolve-repo.js";
import { ship } from "./nodes/ship.js";
import { shipApproval } from "./nodes/ship-approval.js";
import { skipValidateNode } from "./nodes/skip-validate.js";
import { summarize } from "./nodes/summarize.js";
import { buildRetryFeedback, routeAfterValidate, validate } from "./nodes/validate.js";
import { AgentState, type AgentStateType } from "./state.js";

function routeAfterPlanApproval(state: AgentStateType): string {
  if (state.planApproved) {
    if (state.cli.dryRun) return "dryRunComplete";
    return "prepareWorktree";
  }
  if (state.planFeedback) return "codexPlan";
  return "summarize";
}

function routeAfterShipApproval(state: AgentStateType): string {
  if (state.shipApproved) return "ship";
  if (state.shipFeedback) return "invokeCodex";
  return "summarize";
}

export function buildGraph(checkpointer: BaseCheckpointSaver) {
  const graph = new StateGraph(AgentState)
    .addNode("fetchJira", fetchJira)
    .addNode("fetchLogs", fetchLogs)
    .addNode("resolveRepo", resolveRepo)
    .addNode("codexPlan", codexPlan)
    .addNode("planApproval", planApproval)
    .addNode("dryRunComplete", dryRunComplete)
    .addNode("prepareWorktree", prepareWorktree)
    .addNode("invokeCodex", invokeCodex)
    .addNode("askQuestion", askQuestion)
    .addNode("validate", validate)
    .addNode("skipValidate", skipValidateNode)
    .addNode("buildRetryFeedback", async (state: AgentStateType) => buildRetryFeedback(state))
    .addNode("shipApproval", shipApproval)
    .addNode("ship", ship)
    .addNode("summarize", summarize)
    .addEdge(START, "fetchJira")
    .addEdge("fetchJira", "fetchLogs")
    .addEdge("fetchLogs", "resolveRepo")
    .addEdge("resolveRepo", "codexPlan")
    .addConditionalEdges("codexPlan", routeAfterCodexPlan, {
      askQuestion: "askQuestion",
      planApproval: "planApproval",
      summarize: "summarize",
    })
    .addConditionalEdges("planApproval", routeAfterPlanApproval, {
      prepareWorktree: "prepareWorktree",
      dryRunComplete: "dryRunComplete",
      codexPlan: "codexPlan",
      summarize: "summarize",
    })
    .addEdge("prepareWorktree", "invokeCodex")
    .addEdge("dryRunComplete", "summarize")
    .addConditionalEdges("invokeCodex", routeAfterCodex, {
      validate: "validate",
      skipValidate: "skipValidate",
      askQuestion: "askQuestion",
    })
    .addConditionalEdges("askQuestion", routeAfterAsk, {
      codexPlan: "codexPlan",
      invokeCodex: "invokeCodex",
    })
    .addEdge("skipValidate", "shipApproval")
    .addConditionalEdges("validate", routeAfterValidate, {
      shipApproval: "shipApproval",
      summarize: "summarize",
      retryCodex: "buildRetryFeedback",
    })
    .addEdge("buildRetryFeedback", "invokeCodex")
    .addConditionalEdges("shipApproval", routeAfterShipApproval, {
      ship: "ship",
      invokeCodex: "invokeCodex",
      summarize: "summarize",
    })
    .addEdge("ship", "summarize")
    .addEdge("summarize", END);

  return graph.compile({ checkpointer });
}
