import { isRepoPath } from "../../config/cli-args.js";
import { logNodeDone, logNodeStart } from "../../integrations/agent-log.js";
import {
  createBranchAtHead,
  isDetachedAtBase,
  resolveAgentWorktrees,
} from "../../integrations/agent-worktree.js";
import { createBranches } from "../../integrations/ticket-solver.js";
import type { AgentStateType } from "../state.js";

export async function prepareWorktree(state: AgentStateType): Promise<Partial<AgentStateType>> {
  logNodeStart("prepareWorktree", { threadId: state.threadId, scope: state.scope });
  const worktrees = await resolveAgentWorktrees({
    threadId: state.threadId,
    clientPath: state.clientPath,
    serverPath: state.serverPath,
    scope: state.scope,
    ...(state.clientBase ? { clientBase: state.clientBase } : {}),
    ...(state.serverBase ? { serverBase: state.serverBase } : {}),
  });

  const branchArgs: Parameters<typeof createBranches>[0] = {
    issueKey: state.jiraIssueKey,
  };

  if (state.scope === "client") {
    if (!worktrees.clientPath || !isRepoPath(worktrees.clientPath) || !state.clientBase) {
      throw new Error("Missing client repo path or base branch for worktree preparation");
    }
    branchArgs.clientPath = worktrees.clientPath;
    branchArgs.clientBase = state.clientBase;
  } else {
    if (!worktrees.serverPath || !isRepoPath(worktrees.serverPath) || !state.serverBase) {
      throw new Error("Missing server repo path or base branch for worktree preparation");
    }
    branchArgs.serverPath = worktrees.serverPath;
    branchArgs.serverBase = state.serverBase;
  }

  const branchName = state.branchName || state.jira?.suggestedBranch;
  if (!branchName) {
    throw new Error("Missing suggested branch name (expected from fetchJira)");
  }

  const mainRepoPath = state.scope === "client" ? state.clientPath : state.serverPath;
  const worktreePath = state.scope === "client" ? worktrees.clientPath : worktrees.serverPath;
  const baseBranch = state.scope === "client" ? state.clientBase! : state.serverBase!;
  const usingAgentWorktree = worktreePath !== mainRepoPath;

  let repoPath = worktreePath;
  let branchCreateError: string | null = null;

  if (usingAgentWorktree && (await isDetachedAtBase(worktreePath, baseBranch))) {
    const created = await createBranchAtHead(worktreePath, branchName);
    if (!created.success) {
      branchCreateError = created.error;
    }
  } else {
    const result = await createBranches(branchArgs);
    const op = result.operations.find((o) => o.role === state.scope);
    repoPath = op?.repoPath ?? worktreePath;
    if (!op?.branchCreate.success) {
      branchCreateError = op?.branchCreate.error ?? "unknown error";
    }
  }

  if (branchCreateError) {
    throw new Error(`Branch creation failed: ${branchCreateError}`);
  }

  logNodeDone("prepareWorktree", {
    threadId: state.threadId,
    branch: branchName,
    repo: repoPath,
  });

  return {
    clientPath: worktrees.clientPath,
    serverPath: worktrees.serverPath,
    worktreeRoot: worktrees.worktreeRoot,
    branchName,
    baseBranch,
    activeRepoPath: repoPath,
  };
}
