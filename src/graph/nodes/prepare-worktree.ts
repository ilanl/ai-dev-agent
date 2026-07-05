import { isRepoPath } from "../../config/cli-args.js";
import { logAgentInfo, logNodeDone, logNodeStart } from "../../integrations/agent-log.js";
import {
  createBranchAtHead,
  ensureDetachedAtBase,
  resolveAgentWorktrees,
} from "../../integrations/agent-worktree.js";
import { isBranchNameTakenError } from "../../integrations/branch-fallback.js";
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

  const preferredBranch = state.branchName || state.jira?.suggestedBranch;
  if (!preferredBranch) {
    throw new Error("Missing suggested branch name (expected from fetchJira)");
  }

  const mainRepoPath = state.scope === "client" ? state.clientPath : state.serverPath;
  const worktreePath = state.scope === "client" ? worktrees.clientPath : worktrees.serverPath;
  const baseBranch = state.scope === "client" ? state.clientBase! : state.serverBase!;
  const usingAgentWorktree = worktreePath !== mainRepoPath;
  const branchOptions = {
    agentId: state.agentId,
    issueKey: state.jiraIssueKey,
  };

  let repoPath = worktreePath;
  let resolvedBranch = preferredBranch;
  let branchCreateError: string | null = null;

  const applyBranchResult = (
    result: Awaited<ReturnType<typeof createBranchAtHead>>,
  ): boolean => {
    if (!result.success || !result.branchName) {
      branchCreateError = result.error;
      return false;
    }

    resolvedBranch = result.branchName;
    if (result.usedFallback) {
      logAgentInfo("branch.fallback", {
        threadId: state.threadId,
        preferred: preferredBranch,
        branch: resolvedBranch,
      });
    }
    return true;
  };

  const createBranchWithFallbacks = async (targetRepo: string): Promise<boolean> => {
    await ensureDetachedAtBase(targetRepo, baseBranch);
    return applyBranchResult(
      await createBranchAtHead(targetRepo, preferredBranch, branchOptions),
    );
  };

  if (usingAgentWorktree) {
    if (!(await createBranchWithFallbacks(worktreePath))) {
      branchCreateError ??= "Branch creation failed in agent worktree";
    }
  } else {
    let ticketSolverFailed = false;

    try {
      const result = await createBranches(branchArgs);
      const op = result.operations.find((o) => o.role === state.scope);
      repoPath = op?.repoPath ?? worktreePath;

      if (op?.branchCreate.success) {
        resolvedBranch = op.suggestedBranch || preferredBranch;
      } else {
        ticketSolverFailed = true;
        branchCreateError = op?.branchCreate.error ?? "unknown error";
      }
    } catch (err) {
      ticketSolverFailed = true;
      branchCreateError = err instanceof Error ? err.message : String(err);
    }

    if (ticketSolverFailed) {
      const shouldFallback =
        !branchCreateError || isBranchNameTakenError(branchCreateError);
      if (shouldFallback) {
        branchCreateError = null;
        if (!(await createBranchWithFallbacks(repoPath))) {
          branchCreateError ??= "Branch creation failed after ticket-solver error";
        }
      }
    }
  }

  if (branchCreateError) {
    throw new Error(`Branch creation failed: ${branchCreateError}`);
  }

  logNodeDone("prepareWorktree", {
    threadId: state.threadId,
    branch: resolvedBranch,
    repo: repoPath,
    ...(resolvedBranch !== preferredBranch ? { preferredBranch } : {}),
  });

  return {
    clientPath: worktrees.clientPath,
    serverPath: worktrees.serverPath,
    worktreeRoot: worktrees.worktreeRoot,
    branchName: resolvedBranch,
    baseBranch,
    activeRepoPath: repoPath,
  };
}
