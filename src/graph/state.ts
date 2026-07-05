import { Annotation } from "@langchain/langgraph";
import type { CliArgs } from "../config/cli-args.js";
import type { RepoScope } from "../config/repos.js";
import type { TicketSolverGetJiraResult } from "../integrations/ticket-solver.js";

export interface ValidationResult {
  ok: boolean;
  output: string;
}

export interface HumanAnswer {
  question: string;
  answer: string;
}

export const AgentState = Annotation.Root({
  cli: Annotation<CliArgs>(),

  agentId: Annotation<string>(),
  threadId: Annotation<string>(),

  jiraIssueKey: Annotation<string>(),
  jira: Annotation<TicketSolverGetJiraResult | null>(),
  jiraText: Annotation<string>(),
  coralogixContext: Annotation<string>(),

  scope: Annotation<RepoScope>(),
  clientPath: Annotation<string>(),
  serverPath: Annotation<string>(),
  clientBase: Annotation<string | undefined>(),
  serverBase: Annotation<string | undefined>(),
  activeRepoPath: Annotation<string>(),
  baseBranch: Annotation<string>(),
  branchName: Annotation<string>(),

  lintCommand: Annotation<string>(),
  testCommand: Annotation<string>(),
  e2eCommand: Annotation<string | undefined>(),
  codingRules: Annotation<string>(),
  skillsContext: Annotation<string>(),
  agentSkillsDir: Annotation<string>(),
  nodeVersion: Annotation<string | undefined>(),

  implementationPlan: Annotation<string>(),
  planPath: Annotation<string | undefined>(),
  planApproved: Annotation<boolean>(),
  planFeedback: Annotation<string | undefined>(),
  shipApproved: Annotation<boolean>(),
  shipFeedback: Annotation<string | undefined>(),
  worktreeRoot: Annotation<string | undefined>(),

  codexPlanSessionId: Annotation<string | undefined>(),
  codexSessionId: Annotation<string | undefined>(),
  codexAttempts: Annotation<number>(),
  codexLastOutput: Annotation<string>(),
  retryFeedback: Annotation<string | undefined>(),
  humanAnswers: Annotation<HumanAnswer[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  lintResult: Annotation<ValidationResult | null>(),
  testResult: Annotation<ValidationResult | null>(),
  e2eResult: Annotation<ValidationResult | null>(),

  filesChanged: Annotation<string[]>(),
  commitSubject: Annotation<string>(),
  mrUrls: Annotation<string[]>(),
  openRisks: Annotation<string[]>(),

  status: Annotation<"running" | "blocked" | "shipped" | "failed" | "rejected">(),
  error: Annotation<string | undefined>(),
});

export type AgentStateType = typeof AgentState.State;
