import type { AgentStateType } from "../state.js";
import { logNodeDone, logNodeStart } from "../../integrations/agent-log.js";
import {
  formatCoralogixContext,
  formatJiraForPrompt,
  getJira,
} from "../../integrations/ticket-solver.js";

export async function fetchJira(state: AgentStateType): Promise<Partial<AgentStateType>> {
  logNodeStart("fetchJira", { issueKey: state.jiraIssueKey, threadId: state.threadId });
  const jira = await getJira(state.jiraIssueKey);
  logNodeDone("fetchJira", { issueKey: state.jiraIssueKey, branch: jira.suggestedBranch });
  return {
    jira,
    jiraText: formatJiraForPrompt(jira),
    coralogixContext: formatCoralogixContext(jira),
    branchName: jira.suggestedBranch,
  };
}
