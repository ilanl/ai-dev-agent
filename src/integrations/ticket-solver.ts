import { execa } from "execa";

const JIRA_COMMAND = "ticket-solver";

export interface JiraCommentEntry {
  id: string;
  authorDisplayName: string | null;
  created: string | null;
  bodyPlain: string;
}

export interface TicketSolverGetJiraResult {
  schemaVersion: number;
  mode: "get-jira";
  ticketId: string;
  jiraKey: string;
  summary: string;
  descriptionPlain: string;
  suggestedBranch: string;
  branchNaming: { username: string; slugMaxLength: number };
  coralogix: {
    linksDetected: string[];
    mcpHints: Array<{ kind: string; url: string; queryHint: string }>;
    useCoralogixMcp: boolean;
  };
  jira: {
    browseUrl: string | null;
    fetched: boolean;
    error: string | null;
    comments: JiraCommentEntry[];
    commentsError: string | null;
  };
  workflowHints: {
    mergeRequestTitlePrefix: string;
    jiraTransitionToCodeReviewCommand: string;
  };
}

export interface BranchOperation {
  role: "client" | "server";
  repoPath: string;
  baseBranch: string;
  suggestedBranch: string;
  branchCreate: { executed: boolean; success: boolean; error: string | null };
}

export interface TicketSolverBranchResult {
  schemaVersion: number;
  mode: "explicit-branch";
  ticketId: string;
  jiraKey: string;
  suggestedBranch: string;
  operations: BranchOperation[];
  workflowHints: Record<string, string>;
}

export async function getJira(issueKey: string): Promise<TicketSolverGetJiraResult> {
  const { stdout } = await execa(JIRA_COMMAND, ["--get-jira", issueKey]);
  return JSON.parse(stdout) as TicketSolverGetJiraResult;
}

export async function createBranches(options: {
  issueKey: string;
  clientPath?: string;
  clientBase?: string;
  serverPath?: string;
  serverBase?: string;
}): Promise<TicketSolverBranchResult> {
  const args = [options.issueKey, "-y"];

  if (options.clientPath && options.clientBase) {
    args.push("--client-branch", options.clientPath, "--client-base", options.clientBase);
  }
  if (options.serverPath && options.serverBase) {
    args.push("--server-branch", options.serverPath, "--server-base", options.serverBase);
  }

  const { stdout } = await execa(JIRA_COMMAND, args);
  return JSON.parse(stdout) as TicketSolverBranchResult;
}

export async function jiraCodeReview(issueKey: string): Promise<unknown> {
  const { stdout } = await execa(JIRA_COMMAND, ["--jira-code-review", issueKey]);
  return JSON.parse(stdout);
}

export function formatJiraForPrompt(jira: TicketSolverGetJiraResult): string {
  const comments = jira.jira.comments
    .map((c) => `[${c.authorDisplayName ?? "unknown"} ${c.created ?? ""}]\n${c.bodyPlain}`)
    .join("\n\n---\n\n");

  return [
    `Key: ${jira.jiraKey}`,
    `Summary: ${jira.summary}`,
    jira.jira.browseUrl ? `URL: ${jira.jira.browseUrl}` : "",
    "",
    "Description:",
    jira.descriptionPlain,
    comments ? `\nComments:\n${comments}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatCoralogixContext(jira: TicketSolverGetJiraResult): string {
  if (jira.coralogix.linksDetected.length === 0) {
    return "";
  }

  const hints = jira.coralogix.mcpHints
    .map((h) => `- [${h.kind}] ${h.url}\n  Hint: ${h.queryHint}`)
    .join("\n");

  return [
    "Coralogix links from Jira (fetch logs/traces manually or via MCP in a later phase):",
    ...jira.coralogix.linksDetected.map((url) => `- ${url}`),
    hints ? `\nMCP hints:\n${hints}` : "",
  ].join("\n");
}
