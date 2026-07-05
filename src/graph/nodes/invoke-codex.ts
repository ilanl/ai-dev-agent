import { isVerbose, logStep } from "../../config/verbosity.js";
import { logNodeDone, logNodeStart } from "../../integrations/agent-log.js";
import { buildCodexPrompt } from "../../integrations/codex.js";
import { runDeveloperAgent } from "../../integrations/developer-agent.js";
import type { AgentStateType } from "../state.js";

export async function invokeCodex(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const attempt = state.codexAttempts + 1;
  logNodeStart("invokeCodex", {
    threadId: state.threadId,
    attempt,
    maxAttempts: state.cli.maxAttempts,
  });
  if (isVerbose()) {
    logStep(`Developer agent: implementing (attempt ${attempt}/${state.cli.maxAttempts})…`);
  }

  const prompt = buildCodexPrompt({
    jiraText: state.jiraText,
    implementationPlan: state.implementationPlan,
    coralogixContext: state.coralogixContext,
    repoPath: state.activeRepoPath,
    baseBranch: state.baseBranch,
    branchName: state.branchName,
    codingRules: state.codingRules,
    skillsContext: state.skillsContext,
    ...(state.nodeVersion ? { nodeVersion: state.nodeVersion } : {}),
    lintCommand: state.lintCommand,
    testCommand: state.testCommand,
    ...(state.e2eCommand ? { e2eCommand: state.e2eCommand } : {}),
    ...(state.retryFeedback ? { retryFeedback: state.retryFeedback } : {}),
    ...(state.humanAnswers.length ? { humanAnswers: state.humanAnswers } : {}),
  });

  const result = await runDeveloperAgent({
    repoPath: state.activeRepoPath,
    prompt,
    extraReadDirs: [state.agentSkillsDir],
    ...(state.codexSessionId ? { sessionId: state.codexSessionId } : {}),
  });

  const nextStatus = result.blocked
    ? "blocked"
    : !result.ok
      ? "failed"
      : state.status;

  logNodeDone("invokeCodex", {
    threadId: state.threadId,
    attempt,
    status: nextStatus,
    blocked: result.blocked,
  });

  return {
    codexAttempts: attempt,
    codexLastOutput: result.output,
    ...(result.sessionId ? { codexSessionId: result.sessionId } : {}),
    retryFeedback: undefined,
    status: nextStatus,
    ...(result.blocked && result.blockedQuestion
      ? { error: result.blockedQuestion }
      : {}),
    ...(!result.ok && !result.blocked ? { error: result.output } : {}),
  };
}
