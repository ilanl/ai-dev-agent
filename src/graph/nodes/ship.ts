import { buildCommitSubject, slugFromBranch } from "../../config/repos.js";
import { logNodeDone, logNodeStart } from "../../integrations/agent-log.js";
import {
  branchExistsOnRemote,
  commitAndPush,
  getChangedFiles,
  getFilesChangedSinceBase,
  hasChanges,
} from "../../integrations/git.js";
import { createDraftMergeRequest } from "../../integrations/gitlab.js";
import { jiraCodeReview } from "../../integrations/ticket-solver.js";
import type { AgentStateType } from "../state.js";

export async function ship(state: AgentStateType): Promise<Partial<AgentStateType>> {
  logNodeStart("ship", { threadId: state.threadId, issueKey: state.jiraIssueKey });
  const changed = await hasChanges(state.activeRepoPath);
  const onRemote = await branchExistsOnRemote(state.activeRepoPath, state.branchName);

  if (!changed && !onRemote) {
    logNodeDone("ship", { threadId: state.threadId, status: "failed", error: "no changes" });
    return {
      status: "failed",
      error: "No changes to ship",
    };
  }

  const filesChanged = changed
    ? await getChangedFiles(state.activeRepoPath)
    : await getFilesChangedSinceBase(state.activeRepoPath, state.baseBranch);

  const slug = slugFromBranch(state.branchName, state.jiraIssueKey);
  const commitSubject = buildCommitSubject(state.scope, slug, state.jiraIssueKey);
  const mrTitle = `Draft: ${commitSubject}`;

  const jiraUrl = state.jira?.jira.browseUrl ?? state.jiraIssueKey;
  const mrDescription = [
    `Jira: ${jiraUrl}`,
    "",
    "## Summary",
    state.implementationPlan.slice(0, 2000),
    "",
    "## Testing",
    `- Lint: ${state.lintResult?.ok ? "pass" : "fail"}`,
    `- Tests: ${state.testResult?.ok ? "pass" : "fail"}`,
    state.e2eResult ? `- E2E: ${state.e2eResult.ok ? "pass" : "fail"}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (changed) {
    await commitAndPush({
      repoPath: state.activeRepoPath,
      branchName: state.branchName,
      subject: commitSubject,
      files: filesChanged,
    });
  }

  const mr = await createDraftMergeRequest({
    repoPath: state.activeRepoPath,
    title: mrTitle,
    description: mrDescription,
    sourceBranch: state.branchName,
    targetBranch: state.baseBranch,
  });

  await jiraCodeReview(state.jiraIssueKey);

  logNodeDone("ship", {
    threadId: state.threadId,
    status: "shipped",
    branch: state.branchName,
    mr: mr.url,
  });

  return {
    filesChanged,
    commitSubject,
    mrUrls: [mr.url],
    status: "shipped",
  };
}
