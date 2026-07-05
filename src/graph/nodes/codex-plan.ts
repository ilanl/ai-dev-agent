import { isVerbose, logStep } from "../../config/verbosity.js";
import { logNodeDone, logNodeStart } from "../../integrations/agent-log.js";
import {
  buildCodexPlanPrompt,
  extractRisksFromPlan,
  writePlanArtifact,
} from "../../integrations/codex.js";
import { runDeveloperAgent } from "../../integrations/developer-agent.js";
import type { AgentStateType } from "../state.js";

export async function codexPlan(state: AgentStateType): Promise<Partial<AgentStateType>> {
  logNodeStart("codexPlan", { threadId: state.threadId, repo: state.activeRepoPath });
  if (isVerbose()) {
    logStep("Developer agent: scanning repo and building plan…");
  }

  const prompt = buildCodexPlanPrompt({
    jiraText: state.jiraText,
    coralogixContext: state.coralogixContext,
    repoPath: state.activeRepoPath,
    baseBranch: state.baseBranch,
    branchName: state.branchName,
    scope: state.scope,
    clientPath: state.clientPath,
    serverPath: state.serverPath,
    codingRules: state.codingRules,
    skillsContext: state.skillsContext,
    ...(state.nodeVersion ? { nodeVersion: state.nodeVersion } : {}),
    lintCommand: state.lintCommand,
    testCommand: state.testCommand,
    ...(state.e2eCommand ? { e2eCommand: state.e2eCommand } : {}),
    ...(state.humanAnswers.length ? { humanAnswers: state.humanAnswers } : {}),
    ...(state.planFeedback ? { planFeedback: state.planFeedback } : {}),
  });

  const result = await runDeveloperAgent({
    repoPath: state.activeRepoPath,
    prompt,
    sandbox: "read-only",
    extraReadDirs: [state.globalSkillsDir],
    ...(state.codexPlanSessionId ? { sessionId: state.codexPlanSessionId } : {}),
  });

  if (result.blocked) {
    logNodeDone("codexPlan", { threadId: state.threadId, status: "blocked" });
    return {
      codexLastOutput: result.output,
      ...(result.sessionId ? { codexPlanSessionId: result.sessionId } : {}),
      status: "blocked",
      ...(result.blockedQuestion ? { error: result.blockedQuestion } : {}),
    };
  }

  if (!result.ok) {
    logNodeDone("codexPlan", { threadId: state.threadId, status: "failed" });
    return {
      status: "failed",
      error: result.output,
      codexLastOutput: result.output,
      ...(result.sessionId ? { codexPlanSessionId: result.sessionId } : {}),
    };
  }

  const plan = result.output.trim();
  if (!plan) {
    return {
      status: "failed",
      error: "Developer agent returned an empty plan",
    };
  }

  const planPath = await writePlanArtifact(state.threadId, plan);

  logNodeDone("codexPlan", { threadId: state.threadId, planPath, status: "running" });
  if (!isVerbose()) {
    logStep(`Plan ready: ${planPath}`);
  }

  return {
    implementationPlan: plan,
    openRisks: extractRisksFromPlan(plan),
    codexLastOutput: result.output,
    planPath,
    planFeedback: undefined,
    ...(result.sessionId ? { codexPlanSessionId: result.sessionId } : {}),
    status: "running",
  };
}

export function routeAfterCodexPlan(state: AgentStateType): string {
  if (state.status === "blocked") return "askQuestion";
  if (state.status === "failed") return "summarize";
  return "planApproval";
}
